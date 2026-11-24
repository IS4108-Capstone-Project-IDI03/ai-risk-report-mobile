// MB-22: the words of an Inbox row and where a row opens. Pure functions, no gateway.
import { rowOf } from '../src/features/inbox/row'
import { whereTo } from '../src/features/inbox/openRow'
import type { Notification } from '../src/features/inbox/api'

const n = (purpose: string, message: string, context: Record<string, string> | null = null, details: string | null = null) =>
  ({ id: 'x', purpose, kind: 'inbox', message, details, context, read: false, done: false, createdAt: '2026-11-20T09:00:00Z' }) as Notification

describe('rowOf (the phone layout of web inbox/row.ts)', () => {
  it('names an assigned assessment by its site, with its due date', () => {
    expect(rowOf(n('assessment_assigned', 'New assessment: Marina Point', { site: 'Marina Point', reportDue: '2026-12-01' }))).toEqual({ task: 'New assessment', detail: 'Marina Point', tone: 'grey', due: '2026-12-01' })
  })

  it('names a ready walk by its site, and a failed walk by its reason in red', () => {
    expect(rowOf(n('site_walk_ready', 'Review site walk: Pasir Gudang', { site: 'Pasir Gudang' }))).toMatchObject({ task: 'Review site walk', detail: 'Pasir Gudang', tone: 'grey', due: null })
    expect(rowOf(n('site_walk_failed', 'Review site walk: Tuas Depot', { site: 'Tuas Depot', reportDue: '2026-12-05' }))).toMatchObject({ task: 'Review site walk', detail: "Couldn't read the recording", tone: 'red', due: '2026-12-05' })
  })

  it('counts a due date that cannot be read as none', () => {
    expect(rowOf(n('assessment_assigned', 'New assessment: A', { site: 'A', reportDue: 'soon' })).due).toBeNull()
  })

  it('shows a purpose it does not know as its message and details', () => {
    expect(rowOf(n('drafting_status', 'A part is drafted.', null, 'Section 3 is ready.'))).toEqual({ task: 'A part is drafted.', detail: 'Section 3 is ready.', tone: 'grey', due: null })
  })
})

describe('whereTo (web notifications/openSubject.ts)', () => {
  it('opens an assigned assessment, a ready walk and a failed walk', () => {
    expect(whereTo(n('assessment_assigned', 'x', { reference: 'R1' }))).toEqual({ pathname: '/assessment/[reference]', params: { reference: 'R1' } })
    expect(whereTo(n('site_walk_ready', 'x', { reference: 'R1', walkId: 'w1' }))).toEqual({ pathname: '/assessment/[reference]/site-walk-review', params: { reference: 'R1', walkId: 'w1' } })
    expect(whereTo(n('site_walk_failed', 'x', { reference: 'R1', walkId: 'w2' }))).toEqual({ pathname: '/assessment/[reference]/site-walks', params: { reference: 'R1' } })
  })

  it('opens nothing for a row with no reference, or a purpose the phone has no page for', () => {
    expect(whereTo(n('assessment_assigned', 'x', null))).toBeNull()
    expect(whereTo(n('site_walk_ready', 'x', { reference: 'R1' }))).toBeNull()
    expect(whereTo(n('drafting_status', 'x', { reference: 'R1' }))).toBeNull()
  })
})
