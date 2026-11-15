// Edits to a site walk's proposal (MB-16 AC13-AC31), as plain functions that each return a new
// proposal. Copied from the web client's site-walk/proposal.ts (same rules); keep the two in step.
// Called by useProposal and the review screens. Nothing here talks to the gateway.
import { groupLocations, locationLabel, samePlace, savedLevel, type Location } from '@/features/locations/locations'
import type { Proposal, ProposedLocation, ProposedObservation, SiteWalk } from './api'

// The chooser's two fixed entries: observations with no place yet, and every observation.
export const NEEDS_LOCATION = 'needs-location'
export const ALL = 'all'

// The next free ref, e.g. "obs-7", so refs stay unique inside the proposal.
function nextRef(prefix: string, used: { ref: string }[]) {
  let n = used.length + 1
  while (used.some((u) => u.ref === `${prefix}-${n}`)) n++
  return `${prefix}-${n}`
}

// A deleted observation moves to the deleted list (newest first), where it can be restored.
// Create all leaves it out.
export function removeObservation(p: Proposal, ref: string): Proposal {
  const o = p.observations.find((x) => x.ref === ref)
  if (!o) return p
  return { ...p, observations: p.observations.filter((x) => x !== o), removed: [o, ...(p.removed ?? [])] }
}

// Puts a deleted observation back, at `index` (Undo puts it where it was) or last. Its location
// stays only if the proposal still has it.
export function restoreObservation(p: Proposal, ref: string, index = Infinity): Proposal {
  const o = p.removed?.find((x) => x.ref === ref)
  if (!o) return p
  const observations = [...p.observations]
  const restored = {
    ...o,
    // Without a fresh ref a restored observation would share one with a new one.
    ref: observations.some((x) => x.ref === o.ref) ? nextRef('obs', observations) : o.ref,
    locationRef: p.locations.some((l) => l.ref === o.locationRef) ? o.locationRef : null,
  }
  observations.splice(Math.min(index, observations.length), 0, restored)
  return { ...p, observations, removed: p.removed!.filter((x) => x !== o) }
}

export function updateObservation(
  p: Proposal,
  ref: string,
  patch: Partial<Pick<ProposedObservation, 'note' | 'copeDimension' | 'severity' | 'locationRef'>>,
): Proposal {
  return { ...p, observations: p.observations.map((o) => (o.ref === ref ? { ...o, ...patch } : o)) }
}

type NewObservation = Pick<ProposedObservation, 'note' | 'copeDimension' | 'severity' | 'locationRef'>

// Adds an observation the engineer wrote by hand (MB-16 AC27); it has no recording clip or walk
// photos, only the files they added (`mediaIds`). Returns it with the proposal.
export function addObservation(p: Proposal, fields: NewObservation, mediaIds: string[] = []) {
  const observation: ProposedObservation = {
    // Deleted ones keep their refs, so a restore never clashes.
    ref: nextRef('obs', [...p.observations, ...(p.removed ?? [])]),
    ...fields,
    recordingSeq: null,
    start: null,
    end: null,
    photoIds: [],
    ...(mediaIds.length && { mediaIds }),
    check: { severity: false, category: false, location: false },
  }
  return { proposal: { ...p, observations: [...p.observations, observation] }, observation }
}

// ---- Locations (AC20, AC21) ----

// What the location form holds. A place with no building is "elsewhere on site".
export type LocationInput = { building: string; floor: string; name: string }

// The place as stored: trimmed, the level in its standard spelling, and no level without a building.
function placeOf(input: LocationInput) {
  const building = input.building.trim()
  const floor = input.floor.trim()
  return building
    ? { kind: 'building' as const, building, floor: floor ? savedLevel(floor) : null, name: input.name.trim() }
    : { kind: 'elsewhere' as const, building: null, floor: null, name: input.name.trim() }
}

// Why a place can't be saved, or null when it can. `ref` is the place being renamed, so it
// doesn't clash with itself.
export function locationProblem(p: Proposal, input: LocationInput, ref?: string) {
  const place = placeOf(input)
  if (!place.name) return 'Enter the location’s name.'
  if (p.locations.some((l) => l.ref !== ref && samePlace(l, place))) return 'This location is already in the proposal.'
  return null
}

// Adds a new place. One already on the assessment is linked to it instead of being added again.
export function addLocation(p: Proposal, input: LocationInput, existing: Location[]) {
  const place = placeOf(input)
  const match = existing.find((e) => samePlace(e, place))
  const location: ProposedLocation = { ref: nextRef('loc', p.locations), existingId: match?.id ?? null, ...place }
  return { proposal: { ...p, locations: [...p.locations, location] }, location }
}

export const renameLocation = (p: Proposal, ref: string, input: LocationInput): Proposal => ({
  ...p,
  locations: p.locations.map((l) => (l.ref === ref ? { ...l, ...placeOf(input) } : l)),
})

// Takes a place out; its observations, deleted ones too, go to "No location yet".
export function removeLocation(p: Proposal, ref: string): Proposal {
  const unplace = (o: ProposedObservation) => (o.locationRef === ref ? { ...o, locationRef: null } : o)
  return { locations: p.locations.filter((l) => l.ref !== ref), observations: p.observations.map(unplace), removed: p.removed?.map(unplace) }
}

// "Same as…": a new place is really one already on the assessment. Every observation at it moves in
// one change. When that place is already in the proposal they join it; otherwise this one becomes
// it. Returns the proposal and the ref the observations now use.
export function sameAs(p: Proposal, ref: string, existing: Location) {
  const linked = p.locations.find((l) => l.existingId === existing.id && l.ref !== ref)
  const move = (o: ProposedObservation) => (o.locationRef === ref ? { ...o, locationRef: linked!.ref } : o)
  if (linked)
    return {
      proposal: { locations: p.locations.filter((l) => l.ref !== ref), observations: p.observations.map(move), removed: p.removed?.map(move) },
      ref: linked.ref,
    }
  const kind: ProposedLocation['kind'] = existing.building || existing.floor ? 'building' : 'elsewhere'
  const become = (l: ProposedLocation) =>
    l.ref === ref ? { ...l, existingId: existing.id, kind, building: existing.building, floor: existing.floor, name: existing.name } : l
  return { proposal: { ...p, locations: p.locations.map(become) }, ref }
}

// The place as the form fills it in, for Rename.
export const inputOf = (l: ProposedLocation): LocationInput => ({ building: l.building ?? '', floor: l.floor ?? '', name: l.name })

// Offers one of the assessment's own locations in the proposal. Returns its ref there; one
// already in the proposal is reused, so Create all never adds a place twice.
export function linkLocation(p: Proposal, existing: Location): { proposal: Proposal; ref: string } {
  const have = p.locations.find((l) => l.existingId === existing.id || samePlace(l, existing))
  if (have) return { proposal: p, ref: have.ref }
  const ref = nextRef('loc', p.locations)
  const kind = existing.building || existing.floor ? ('building' as const) : ('elsewhere' as const)
  const location = { ref, existingId: existing.id, kind, building: existing.building, floor: existing.floor, name: existing.name }
  return { proposal: { ...p, locations: [...p.locations, location] }, ref }
}

// The place as a label: "Block A · Level 2 · Staircase".
export const placeName = (p: Proposal, ref: string | null) => {
  const l = p.locations.find((x) => x.ref === ref)
  return l ? locationLabel(l) : 'No location yet'
}

// ---- What the list shows (AC22) ----

// The proposal's places in the order the picker groups them: by building, then level, then name.
export const orderedLocations = (p: Proposal) =>
  groupLocations(p.locations.map((l) => ({ ...l, id: l.ref }))).flatMap((g) => g.levels.flatMap((level) => level.locations.map((l) => l.id)))

// The observations for a chosen place, for "No location yet", or all of them.
export const observationsAt = (p: Proposal, selected: string) =>
  selected === ALL ? p.observations : p.observations.filter((o) => (o.locationRef ?? NEEDS_LOCATION) === selected)

// The chosen entry's observations in sections, one per place (No location yet first). One section
// when a single place is chosen.
export function sectionsAt(p: Proposal, selected: string) {
  const items = observationsAt(p, selected)
  const order = selected === ALL ? [NEEDS_LOCATION, ...orderedLocations(p)] : [selected]
  return order
    .map((ref) => ({ ref, title: ref === NEEDS_LOCATION ? 'No location yet' : placeName(p, ref), items: items.filter((o) => (o.locationRef ?? NEEDS_LOCATION) === ref) }))
    .filter((s) => s.items.length)
}

// ---- What an observation still needs (AC13, AC18, AC24) ----

// No note: files added by hand stand in for one, as on the web.
const lacksNote = (o: ProposedObservation) => !o.note.trim() && !o.mediaIds?.length
const lacksValue = (o: ProposedObservation) => lacksNote(o) || !o.locationRef || !o.copeDimension || !o.severity

// An empty field is the only thing that asks for attention.
export const missingFields = (o: ProposedObservation) =>
  ([[!o.locationRef, 'location'], [!o.copeDimension, 'category'], [!o.severity, 'severity'], [lacksNote(o), 'note']] as const)
    .filter(([missing]) => missing)
    .map(([, name]) => name)

export const incompleteCount = (p: Proposal) => p.observations.filter(lacksValue).length

// The first observation, in list order, that still needs something: where "N to fix" goes.
export const firstIncomplete = (p: Proposal) => sectionsAt(p, ALL).flatMap((s) => s.items).find(lacksValue)

// What Create all would refuse, in words, or null when it can go ahead (the web's createProblem).
export function createProblem(p: Proposal) {
  const some = (n: number) => (n === 1 ? 'one observation' : `${n} observations`)
  if (!p.observations.length) return 'There are no observations to create.'
  const checks: [string, string][] = [
    ['note', 'Write a note for'],
    ['location', 'Choose a location for'],
    ['category', 'Choose a category for'],
    ['severity', 'Choose a severity for'],
  ]
  for (const [field, text] of checks) {
    const n = p.observations.filter((o) => missingFields(o).includes(field as never)).length
    if (n) return `${text} ${some(n)} first.`
  }
  return null
}

// ---- Filters (AC23) ----

// '' when not set. Same four as the web's Observations tab.
export type Filters = { cat: string; sev: string; type: string; status: string }
export const NO_FILTERS: Filters = { cat: '', sev: '', type: '', status: '' }
export const UNCATEGORISED = 'Uncategorised'
export const STATUSES = ['Needs details', 'Ready']
export const TYPES = ['Note', 'Voice', 'Photo', 'Scan']
export const proposalStatus = (o: ProposedObservation) => (lacksValue(o) ? 'Needs details' : 'Ready')

type Media = NonNullable<SiteWalk['media']>
// What it holds, in the filter's Type names: ["Note", "Voice", "Photo", "Scan"].
export function proposalTypes(o: ProposedObservation, media: Media = []) {
  const kinds = media.filter((m) => o.mediaIds?.includes(m.id)).map((m) => m.kind)
  return [
    ...(o.note.trim() ? ['Note'] : []),
    ...(o.recordingSeq !== null || kinds.includes('voice') ? ['Voice'] : []),
    ...(o.photoIds.length || kinds.includes('photo') ? ['Photo'] : []),
    ...(kinds.includes('page') ? ['Scan'] : []),
  ]
}

// Whether it matches every filter that is set.
export const matchesFilters = (o: ProposedObservation, f: Filters, media?: Media) =>
  (!f.cat || (f.cat === UNCATEGORISED ? !o.copeDimension : o.copeDimension === f.cat)) &&
  (!f.sev || o.severity === f.sev) &&
  (!f.type || proposalTypes(o, media).includes(f.type)) &&
  (!f.status || proposalStatus(o) === f.status)

export const filtersSet = (f: Filters) => Object.values(f).filter(Boolean).length

// What Create all adds, in words: "5 observations and 3 locations". Only new places count; ones already on the assessment are linked.
function addedWords(p: Proposal) {
  const places = p.locations.filter((l) => !l.existingId).length
  const n = p.observations.length
  const obs = `${n} ${n === 1 ? 'observation' : 'observations'}`
  return `${obs}${places ? ` and ${places} ${places === 1 ? 'location' : 'locations'}` : ''}`
}

// The words after Create all: what was added.
export const createdMessage = (p: Proposal) => `Created ${addedWords(p)}.`

// The question before Create all (MB-16 AC18, added 15 Nov).
export const confirmMessage = (p: Proposal) => `This adds ${addedWords(p)} to the assessment.`
