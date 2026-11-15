// MB-16 parts F to I: the plain functions that edit a site walk's proposal (src/features/sitewalk/proposal.ts).
// They mirror the web's proposal.ts; these tests mirror its proposal.test.ts. No screen, no gateway.
import type { Proposal, ProposedObservation } from '../src/features/sitewalk/api'
import {
  addLocation,
  addObservation,
  ALL,
  firstIncomplete,
  inputOf,
  locationProblem,
  matchesFilters,
  NEEDS_LOCATION,
  NO_FILTERS,
  observationsAt,
  proposalStatus,
  proposalTypes,
  removeLocation,
  renameLocation,
  sameAs,
  sectionsAt,
} from '../src/features/sitewalk/proposal'

const obs = (ref: string, extra: Partial<ProposedObservation> = {}): ProposedObservation => ({
  ref, note: `Note ${ref}`, copeDimension: 'Protection', severity: 'high', locationRef: 'loc-1',
  recordingSeq: 1, start: 1, end: 2, photoIds: [], check: { severity: false, category: false, location: false }, ...extra,
})
const place = (ref: string, name: string, extra: object = {}) => ({ ref, existingId: null, kind: 'building' as const, building: 'Block A', floor: 'Level 1', name, ...extra })
const proposal = (): Proposal => ({
  locations: [place('loc-1', 'Loading bay'), place('loc-2', 'Plant room')],
  observations: [obs('obs-1'), obs('obs-2', { locationRef: 'loc-2' }), obs('obs-3', { locationRef: null })],
})
const existing = (id: string, name: string, building: string | null = 'Block A', floor: string | null = 'Level 1') => ({ id, building, floor, name })

describe('locations (part F)', () => {
  it('adds a new place with the next free ref, the level in its standard spelling (AC20)', () => {
    const { proposal: p, location } = addLocation(proposal(), { building: 'Block B', floor: 'L2', name: ' Stairwell ' }, [])
    expect(location).toMatchObject({ ref: 'loc-3', existingId: null, kind: 'building', building: 'Block B', floor: 'Level 2', name: 'Stairwell' })
    expect(p.locations).toHaveLength(3)
  })

  it('a place with no building is "elsewhere on site", with no level', () => {
    const { location } = addLocation(proposal(), { building: '', floor: 'L2', name: 'Car park' }, [])
    expect(location).toMatchObject({ kind: 'elsewhere', building: null, floor: null, name: 'Car park' })
  })

  it('links a place that is already on the assessment instead of adding a new one (AC20)', () => {
    const { location } = addLocation(proposal(), { building: 'block a', floor: 'Level 3', name: 'Roof plant' }, [existing('l7', 'Roof plant', 'Block A', 'Level 3')])
    expect(location.existingId).toBe('l7')
  })

  it('says why a place cannot be saved: no name, the same place twice (AC20)', () => {
    expect(locationProblem(proposal(), { building: 'Block B', floor: '', name: '  ' })).toBe('Enter the location’s name.')
    expect(locationProblem(proposal(), { building: 'block a', floor: 'L1', name: 'loading BAY' })).toBe('This location is already in the proposal.')
    expect(locationProblem(proposal(), { building: 'Block A', floor: 'Level 1', name: 'Plant room' }, 'loc-2')).toBeNull()
    expect(locationProblem(proposal(), { building: 'Block B', floor: '', name: 'Lobby' })).toBeNull()
  })

  it('renames a new place', () => {
    const p = renameLocation(proposal(), 'loc-1', { building: 'Block C', floor: 'B1', name: 'Dock' })
    expect(p.locations[0]).toMatchObject({ ref: 'loc-1', building: 'Block C', floor: 'Basement 1', name: 'Dock', kind: 'building' })
    expect(inputOf(p.locations[0])).toEqual({ building: 'Block C', floor: 'Basement 1', name: 'Dock' })
  })

  it('deleting a place sends its observations, deleted ones too, to "No location yet" (AC21)', () => {
    const start = { ...proposal(), removed: [obs('obs-9', { locationRef: 'loc-1' })] }
    const p = removeLocation(start, 'loc-1')
    expect(p.locations.map((l) => l.ref)).toEqual(['loc-2'])
    expect(p.observations.find((o) => o.ref === 'obs-1')?.locationRef).toBeNull()
    expect(p.removed?.[0].locationRef).toBeNull()
  })

  it('"Same as…": a new place becomes an assessment place and keeps its observations (AC21)', () => {
    const { proposal: p, ref } = sameAs(proposal(), 'loc-1', existing('l5', 'Dock', 'Block C', 'Basement 1'))
    expect(ref).toBe('loc-1')
    expect(p.locations[0]).toMatchObject({ existingId: 'l5', building: 'Block C', floor: 'Basement 1', name: 'Dock' })
    expect(p.observations.find((o) => o.ref === 'obs-1')?.locationRef).toBe('loc-1')
  })

  it('"Same as…" an assessment place already in the proposal: the observations join it and the new one is dropped', () => {
    const start = proposal()
    start.locations[1] = place('loc-2', 'Plant room', { existingId: 'l5' })
    const { proposal: p, ref } = sameAs(start, 'loc-1', existing('l5', 'Plant room'))
    expect(ref).toBe('loc-2')
    expect(p.locations.map((l) => l.ref)).toEqual(['loc-2'])
    expect(p.observations.find((o) => o.ref === 'obs-1')?.locationRef).toBe('loc-2')
  })
})

describe('finding your way (part G)', () => {
  it('lists one place, "No location yet", or all (AC22)', () => {
    const p = proposal()
    expect(observationsAt(p, 'loc-2').map((o) => o.ref)).toEqual(['obs-2'])
    expect(observationsAt(p, NEEDS_LOCATION).map((o) => o.ref)).toEqual(['obs-3'])
    expect(observationsAt(p, ALL)).toHaveLength(3)
  })

  it('shows All in sections: No location yet first, then each place in order', () => {
    expect(sectionsAt(proposal(), ALL).map((s) => s.ref)).toEqual([NEEDS_LOCATION, 'loc-1', 'loc-2'])
  })

  it('filters by category, severity, type and status; Uncategorised matches none chosen (AC23)', () => {
    const p = proposal()
    p.observations.push(obs('obs-4', { copeDimension: null, severity: 'low', note: '', photoIds: ['p1'], recordingSeq: null }))
    const hit = (f: Partial<typeof NO_FILTERS>) => p.observations.filter((o) => matchesFilters(o, { ...NO_FILTERS, ...f })).map((o) => o.ref)
    expect(hit({ cat: 'Uncategorised' })).toEqual(['obs-4'])
    expect(hit({ sev: 'low' })).toEqual(['obs-4'])
    expect(hit({ type: 'Photo' })).toEqual(['obs-4'])
    expect(hit({ type: 'Note' })).toEqual(['obs-1', 'obs-2', 'obs-3'])
    expect(hit({ status: 'Needs details' })).toEqual(['obs-3', 'obs-4'])
    expect(hit({ status: 'Ready' })).toEqual(['obs-1', 'obs-2'])
    expect(proposalStatus(p.observations[0])).toBe('Ready')
    expect(proposalTypes(p.observations[3])).toEqual(['Photo'])
  })

  it('finds the first observation that still needs something, in list order (AC24)', () => {
    expect(firstIncomplete(proposal())?.ref).toBe('obs-3')
    expect(firstIncomplete({ ...proposal(), observations: [obs('obs-1')] })).toBeUndefined()
  })
})

describe('adding by hand (part H)', () => {
  it('adds an observation with the next free ref, no clip and no photos, and its media ids (AC27)', () => {
    const start = { ...proposal(), removed: [obs('obs-4')] }
    const { proposal: p, observation } = addObservation(start, { note: 'By hand', copeDimension: null, severity: 'low', locationRef: 'loc-1' }, ['m1'])
    // obs-4 is in the deleted list, so its ref is not reused.
    expect(observation).toMatchObject({ ref: 'obs-5', recordingSeq: null, start: null, end: null, photoIds: [], mediaIds: ['m1'] })
    expect(p.observations).toHaveLength(4)
  })
})
