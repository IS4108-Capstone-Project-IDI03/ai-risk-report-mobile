// How the checklist is laid out and worded (MB-05 AC2, AC4). Called by screens/Checklist.
import type { Item as QueueItem } from '@/features/offline/queue'
import type { Check, CheckResult, Checklist, ChecklistBody, Item, Standard } from './api'

export type Section = { id: string; title: string; data: Item[]; checked: number }

// Unchecked first (CP-31 AC1); the gateway's order is kept within each group.
const uncheckedFirst = (items: Item[]) =>
  [...items].sort((a, b) => Number(Boolean(a.check)) - Number(Boolean(b.check)))

// The facility's priority risks first, then each report area in report order (AC2).
// An area with no items is left out.
export function sections(checklist: Checklist): Section[] {
  const all = [
    { id: 'hazards', title: 'Priority risks' },
    ...checklist.areas,
  ]
  const known = new Set(all.map((a) => a.id))
  const groups = all.map(({ id, title }) => ({ id, title, items: checklist.items.filter((i) => i.area === id) }))
  // An item in an area the checklist doesn't list would never show, count or be answerable.
  groups.push({ id: 'other', title: 'Other', items: checklist.items.filter((i) => !known.has(i.area)) })
  return groups.flatMap(({ id, title, items }) =>
    items.length ? [{ id, title, data: uncheckedFirst(items), checked: items.filter((i) => i.check).length }] : [],
  )
}

export const heading = (s: Section) => `${s.title} · ${s.checked} of ${s.data.length} checked`

// The site's facility type or country changed since it was generated (CP-30 AC9).
export const outOfDate = ({ scope, checklist }: ChecklistBody) =>
  Boolean(checklist) && (scope.facilityType !== checklist!.facilityType || scope.jurisdiction !== checklist!.jurisdiction)

// Each answer's word and badge tone (the web's status pills: an icon and a word).
export const RESULT: Record<CheckResult, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  confirmed: { label: 'Confirmed', tone: 'success' },
  differs: { label: 'Differs', tone: 'warning' },
  not_seen: { label: 'Not seen', tone: 'neutral' },
  not_applicable: { label: 'Not applicable', tone: 'neutral' },
}

export const resultOf = (check: Check | null) => (check ? RESULT[check.result] : null)

// What is waiting to upload for an item (MB-05 AC16-AC18): a mark, or an observation
// that answers it, made with no signal. `result` is null for a cleared mark.
export type Pending = { id: string; kind: 'mark' | 'observation'; result: CheckResult | null; error?: string }

// The latest thing waiting for this item.
export function pendingFor(items: QueueItem[], reference: string, itemId: string): Pending | null {
  const mine = items.filter(
    (i) => i.reference === reference && ((i.kind === 'mark' && i.itemId === itemId) || (i.kind === 'observation' && i.draft.checklistItem?.itemId === itemId)),
  )
  const last = mine[mine.length - 1]
  if (!last) return null
  const result = last.kind === 'mark' ? last.mark : last.kind === 'observation' ? last.draft.checklistItem!.result : null
  return { id: last.id, kind: last.kind as 'mark' | 'observation', result, error: last.error }
}

// A standard as the generate box names it: its title and edition.
export const standardLabel = (s: Standard) => `${s.title}${s.edition ? ` (${s.edition})` : ''}`
