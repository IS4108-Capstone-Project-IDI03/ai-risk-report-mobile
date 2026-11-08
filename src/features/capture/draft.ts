// An observation being put together in the capture sheet (MB-03), and how it
// becomes the gateway's multipart upload (POST .../observations in the web
// repo's assessment.routes.ts: a `details` JSON part plus file parts).
import { File } from 'expo-file-system'
import type { Severity } from '@/features/observations/format'

// COPE categories in the gateway's order (COPE_DIMENSIONS in observation.model.ts).
export const COPE = ['Construction', 'Occupancy', 'Protection', 'Exposure'] as const
export type Cope = (typeof COPE)[number]

export type VoiceNote = { uri: string; durationMillis: number }

export type Draft = {
  photos: string[] // file URIs on the phone
  pages: string[]
  recordings: VoiceNote[]
  note: string
  cope: Cope[]
  severity: Severity | null
}

export const emptyDraft: Draft = { photos: [], pages: [], recordings: [], note: '', cope: [], severity: null }

const hasEvidence = (d: Draft) =>
  Boolean(d.note.trim() || d.photos.length || d.pages.length || d.recordings.length)

// Anything worth asking about before it's thrown away (AC13).
export const isBlank = (d: Draft) => !hasEvidence(d) && !d.cope.length && !d.severity

// What stops Save, in the order the engineer would fix it (AC10); null when ready.
// The gateway refuses an observation with neither, so the app says so first.
export function missing(d: Draft) {
  if (!hasEvidence(d)) return 'Add a note, photo, voice note or scan.'
  if (!d.severity) return 'Choose a severity to save.'
  return null
}

// "0:42", "12:05".
export function duration(ms: number) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const filePart = (uri: string, name: string, type: string) =>
  ({ uri, name, type, bytes: () => new File(uri).bytes() }) as unknown as Blob

// The same file parts for adding photos and voice notes to a saved observation
// (MB-12 AC20): POST /api/observations/:id/media takes `photo` and `recording` parts.
export function mediaToFormData(photos: string[], recordings: VoiceNote[]) {
  const form = new FormData()
  photos.forEach((uri, i) => form.append('photo', filePart(uri, `Photo ${i + 1}.jpg`, 'image/jpeg')))
  recordings.forEach((r, i) => form.append('recording', filePart(r.uri, `Voice note ${i + 1}.m4a`, 'audio/m4a')))
  return form
}

// The upload. Each file goes as { uri, name, type } plus bytes(). Expo's fetch
// (SDK 58) reads a part through bytes(), and without it the upload fails with
// "Unsupported FormDataPart implementation", which the app then shows as offline.
// Categories go in COPE order, and none is null,
// never [] (the web repo's CLAUDE.md: [] would count as categorised).
export function toFormData(d: Draft, locationId: string) {
  const form = new FormData()
  form.append(
    'details',
    JSON.stringify({
      ...(d.note.trim() && { note: d.note }),
      copeDimensions: d.cope.length ? COPE.filter((c) => d.cope.includes(c)) : null,
      severity: d.severity,
      locationId,
    }),
  )
  d.photos.forEach((uri, i) => form.append('photo', filePart(uri, `Photo ${i + 1}.jpg`, 'image/jpeg')))
  d.pages.forEach((uri, i) => form.append('page', filePart(uri, `Page ${i + 1}.jpg`, 'image/jpeg')))
  d.recordings.forEach((r, i) =>
    form.append('recording', filePart(r.uri, `Voice note ${i + 1}.m4a`, 'audio/m4a')),
  )
  return form
}
