// Display helpers for observation cards (MB-02 AC4). The type is the part of
// the gateway's ObservationDto (observation.service.ts) the app reads.
import type { BadgeProps } from '@/components/ui/badge'

export type Severity = 'critical' | 'high' | 'moderate' | 'low'

export type Observation = {
  id: string
  note: string | null
  // null until categorised; never [] (the web repo's CLAUDE.md).
  copeDimensions: string[] | null
  // Optional once MB-03's gateway change lands, so null is handled already.
  severity: Severity | null
  location: { id: string } | null
  recordings: unknown[]
  photos: unknown[]
  pages: unknown[]
  recordedAt: string
}

// Severity chip tone, from the design system's fixed four-step scale.
export const SEVERITY: Record<Severity, { label: string; tone: BadgeProps['variant'] }> = {
  critical: { label: 'Critical', tone: 'critical' },
  high: { label: 'High', tone: 'high' },
  moderate: { label: 'Moderate', tone: 'warning' },
  low: { label: 'Low', tone: 'success' },
}

const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`)

// The card's title: the note's first line, or what the observation holds,
// e.g. "2 photos · Voice note".
export function observationTitle(o: Observation) {
  const firstLine = o.note?.split('\n')[0].trim()
  if (firstLine) return firstLine
  const parts = [
    o.photos.length && count(o.photos.length, 'Photo', 'photos'),
    o.recordings.length && count(o.recordings.length, 'Voice note', 'voice notes'),
    o.pages.length && count(o.pages.length, 'Handwritten page', 'handwritten pages'),
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Observation'
}

export const categoriesText = (o: Observation) =>
  o.copeDimensions?.length ? o.copeDimensions.join(' · ') : 'Uncategorised'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

// When it was captured, in the phone's time zone: "09:42" today, else
// "11 Apr 09:42". Built by hand so it reads the same on every phone.
export function capturedAt(iso: string, now = new Date()) {
  const d = new Date(iso)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return d.toDateString() === now.toDateString() ? time : `${d.getDate()} ${MONTHS[d.getMonth()]} ${time}`
}
