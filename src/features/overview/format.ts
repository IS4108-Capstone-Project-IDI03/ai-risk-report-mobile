// What a gateway link means on the phone (MB-20). The gateway names a web tab; the phone has
// the checklist, the observations, one observation and the site walks, and nothing for
// Generate, Review, Export or the web's chat Overview. Called by components/OverviewCard.
import type { ItemLink, Summary, SummaryItem } from './api'

export type Target =
  | { kind: 'checklist' }
  | { kind: 'observations' }
  // The gateway's "Uncategorised Observations" gap: the first observation with no category opens.
  | { kind: 'uncategorised' }
  | { kind: 'observation'; id: string }
  | { kind: 'walks' }
  // Only on the web: greyed, with the words below.
  | { kind: 'web' }

export const WEB_ONLY = 'Continue on the web.'

/**
 * Returns where a link goes on the phone. A checklist link with an area opens the checklist (it has
 * no jump to an area yet). The gateway's link for the uncategorised gap is just the Observations tab,
 * with no ids, so that gap (item id 'uncategorised', server checks/uncategorised.ts) gets its own
 * target: the phone has every observation, and can list the ones with no category.
 */
export function targetOf(link: ItemLink | null, itemId?: string): Target {
  if (!link) return { kind: 'web' }
  if (link.tab === 'observations' && itemId === 'uncategorised') return { kind: 'uncategorised' }
  if (link.tab === 'checklist') return { kind: 'checklist' }
  if (link.tab === 'observations') {
    if (link.params?.obs) return { kind: 'observation', id: link.params.obs }
    if (link.params?.walk) return { kind: 'walks' }
    return { kind: 'observations' }
  }
  return { kind: 'web' }
}

// The words on the button for where a link goes (the gateway's own labels, summary.ts LABELS).
const OPEN: Record<ItemLink['tab'], string> = {
  overview: 'Open Overview',
  checklist: 'Open checklist',
  observations: 'Open observations',
  generate: 'Open Generation',
  review: 'Open Review',
  export: 'Open Export',
}

/**
 * Returns the next step for the phone. The gateway's next step is its most urgent item, which may be
 * a web-only one ("Report 12 days overdue") the engineer on site cannot act on; then it is the first
 * item the phone can act on, and only when there is none, the gateway's own.
 */
// What the phone shows as the next step: the gateway's shape, and the id of the item it came from when it did.
export type PhoneNext = Summary['next'] & { itemId?: string }

export function phoneNext(s: Summary): PhoneNext {
  if (targetOf(s.next.link).kind !== 'web') return s.next
  const mine = s.items.find((i) => targetOf(i.link).kind !== 'web')
  if (!mine) return s.next
  return { text: `${[mine.title, mine.detail].filter(Boolean).join(': ')}.`, link: mine.link, label: mine.id === 'uncategorised' ? 'Open the first one' : mine.link ? OPEN[mine.link.tab] : null, itemId: mine.id }
}

/** Returns what the phone's Overview button counts: the items the phone can act on, by urgency (a web-only item is not counted, so the count matches what the sheet lets you do). */
export function counts(s: Summary) {
  const mine = s.items.filter((i) => targetOf(i.link).kind !== 'web')
  return { toFix: mine.filter((i) => i.weight === 'fix_now').length, gaps: mine.filter((i) => i.weight === 'gap').length + s.areas.length }
}

/** Returns the sheet's groups: the items the phone can act on by weight, and those that only the web can do. */
export function grouped(items: SummaryItem[]) {
  const web = (i: SummaryItem) => targetOf(i.link).kind === 'web'
  return {
    toFix: items.filter((i) => !web(i) && i.weight === 'fix_now'),
    gaps: items.filter((i) => !web(i) && i.weight === 'gap'),
    reminders: items.filter((i) => !web(i) && i.weight === 'reminder'),
    onTheWeb: items.filter(web),
  }
}

// A row's colour by weight: red Fix now, amber gap, ink reminder (the web's tones).
export const WEIGHT_COLOR = { fix_now: '#ad2e2d', gap: '#8f5f13', reminder: '#2c5488' } as const
export const WEIGHT_LABEL = { fix_now: 'Fix now', gap: 'Gap', reminder: 'Reminder' } as const
export const TONE_COLOR = { normal: '#1a1f26', amber: '#8f5f13', red: '#ad2e2d', green: '#2f7049' } as const
