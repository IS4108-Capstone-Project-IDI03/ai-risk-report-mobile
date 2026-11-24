// Display helpers for observation cards (MB-02 AC4). The type is the part of
// the gateway's ObservationDto (observation.service.ts) the app reads.
import type { BadgeProps } from '@/components/ui/badge'

export type Severity = 'critical' | 'high' | 'moderate' | 'low'

// A transcript's progress, as the gateway reports it (TRANSCRIPTION_STATUSES in
// the web repo's observation.model.ts).
export type Transcription = {
  status: 'transcribing' | 'transcribed' | 'failed'
  transcript: string | null
  error: string | null
  // A voice note's correction made on the web, which replaces the transcript.
  correction?: { text: string } | null
}

// Media as the detail screen reads it (MB-11). A waiting observation (MB-10)
// fills `url` with a file on the phone and has no transcription yet.
export type Photo = { id?: string; url: string; name?: string }
export type Page = { id?: string; url: string; transcription?: Transcription | null }
export type Recording = { id: string; url: string; transcription?: Transcription | null }

// A photo or voice note an engineer removed (MB-12): kept by the gateway, and listed
// with who removed it and when, so it can be restored (CP-08 AC20, AC21).
export type Removed<T> = T & { removed: { at: string; by: { name: string } } }

// A category or severity the AI fills in when the engineer left it empty (MB-23, the web's CP-24).
// `reading` is queued or running, `failed` carries a short reason. A field's entry is present only
// while its value is still an unconfirmed suggestion; null once it is the engineer's, or while empty.
// Shape: SavedSuggestion in the web repo's client/src/features/assessments/api.ts.
export type SuggestionField = { notSure: boolean }
export type Suggestion = {
  status: 'reading' | 'done' | 'failed'
  error: string | null
  category: SuggestionField | null
  severity: SuggestionField | null
}

export type Observation = {
  id: string
  // Who captured it; a waiting observation doesn't have it.
  engineer?: string
  note: string | null
  // null until categorised; never [] (the web repo's CLAUDE.md).
  copeDimensions: string[] | null
  // Optional once MB-03's gateway change lands, so null is handled already.
  severity: Severity | null
  location: { id: string; building?: string | null; floor?: string | null; name?: string } | null
  recordings: Recording[]
  // Each served by the gateway behind the session cookie (MB-07 thumbnails).
  photos: Photo[]
  pages: Page[]
  recordedAt: string
  // Set while it is deleted, and who deleted it and when (CP-08 AC12); only the
  // gateway's `?include=deleted` list carries deleted ones.
  deleted?: { at: string; by: { name: string } } | null
  removedPhotos?: Removed<Photo>[]
  removedRecordings?: Removed<Recording>[]
  removedPages?: Removed<Page>[]
  // The latest change to its tags or note, and who made it (CP-08 AC11).
  edited?: { at: string; by: { name: string } } | null
  // The AI's suggestion for an empty category or severity (MB-23); null when nothing is suggested
  // and nothing is running. A waiting observation (MB-10) and an older gateway have none.
  suggestion?: Suggestion | null
  // Category or severity empty or not sure, or the suggestion failed (the gateway's own rule).
  toCheck?: boolean
  // Only the photo description can still be reading (`interpreting`); the phone shows no description.
  interpretation?: { photos: { status: string } | null } | null
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

// Where a photo, page or voice note loads from. The gateway sends a path
// ("/api/observations/..."), served behind the session cookie. Anything else is a
// full address already: a file on the phone while its observation waits (MB-10).
export const mediaUri = (url: string) => (url?.startsWith('/') ? `${process.env.EXPO_PUBLIC_API_URL}${url}` : url)
