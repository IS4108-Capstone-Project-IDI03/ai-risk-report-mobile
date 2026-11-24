// The gateway's observations for one assessment, newest first (MB-02). Shapes match
// ObservationDto in the web repo's observation.service.ts. MB-12 adds changing,
// deleting and restoring one, and adding and removing its photos and voice notes.
import { cached, request } from '@/lib/api'
import { mediaToFormData, type Cope, type VoiceNote } from '@/features/capture/draft'
import type { Observation, Severity } from './format'

export const listObservations = (reference: string) =>
  cached<Observation[]>(`/api/assessments/${encodeURIComponent(reference)}/observations`)

// What the editor can change (MB-12 AC1): a field left out stays as it is,
// `copeDimensions: null` uncategorises it, and `note: null` removes the note.
// PATCH /api/observations/:id in the web repo's observation.routes.ts.
// `confirm` keeps a field's AI suggestion as it is (MB-23 AC6): the gateway then treats the value as the engineer's.
export type Changes = {
  severity?: Severity
  copeDimensions?: Cope[] | null
  note?: string | null
  confirm?: ('category' | 'severity')[]
}

export const updateObservation = (id: string, changes: Changes) =>
  request<Observation>(`/api/observations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) })

// Keeps a field's suggested value as it is (MB-23 AC6). Returns the observation as it now is.
export const confirmField = (id: string, field: 'category' | 'severity') => updateObservation(id, { confirm: [field] })

// Asks the AI for a category and severity again after a failed suggestion (MB-23 AC8). One paid call. The
// gateway answers 202 with the observation, now reading, and works in the background (POST
// .../suggestion/retry in the web repo's observation.routes.ts); 409 unless the suggestion failed.
export const retrySuggestion = (id: string) =>
  request<Observation>(`/api/observations/${encodeURIComponent(id)}/suggestion/retry`, { method: 'POST' })

// A soft delete: the gateway marks it deleted and keeps it, so the web can restore it.
export const deleteObservation = (id: string) =>
  request<Observation>(`/api/observations/${encodeURIComponent(id)}`, { method: 'DELETE' })

// Photos, voice notes and handwritten pages inside a saved observation (MB-12 AC16-AC21, MB-17 AC16-AC19).
// Each returns the observation as it now is. Adding sends the files on Save, and each voice note and page is
// then read by the gateway (a paid call); removing is soft, so it can be restored.
export type MediaKind = 'photos' | 'recordings' | 'pages'

// New photos (file URIs), voice notes and pages waiting to be added: kept on the edit screen
// until Save, then sent together (MB-12 AC20), which is when each voice note and page is read.
export type NewMedia = { photos: string[]; recordings: VoiceNote[]; pages: string[] }
export const noNewMedia: NewMedia = { photos: [], recordings: [], pages: [] }

export const addMedia = (id: string, media: NewMedia) =>
  request<Observation>(`/api/observations/${encodeURIComponent(id)}/media`, {
    method: 'POST',
    body: mediaToFormData(media.photos, media.recordings, media.pages),
  })

const mediaPath = (id: string, kind: MediaKind, itemId: string) =>
  `/api/observations/${encodeURIComponent(id)}/${kind}/${encodeURIComponent(itemId)}`

export const removeMedia = (id: string, kind: MediaKind, itemId: string) =>
  request<Observation>(mediaPath(id, kind, itemId), { method: 'DELETE' })

// Starts a new attempt at a failed voice note or page (CP-03 AC6, CP-19 AC11). The gateway
// answers 202 with no body and works in the background, so the caller reads the list again.
export const retryTranscription = (id: string, kind: MediaKind, itemId: string) =>
  request<void>(`${mediaPath(id, kind, itemId)}/transcription/retry`, { method: 'POST' })

// Reads a page again although it was read already (MB-17 AC9, CP-20 AC1). One paid handwriting
// reading. The gateway replies with the observation, the page now Transcribing, and finishes in
// the background, so the caller reads the list again until the new text is there.
export const retranscribePage = (id: string, pageId: string) =>
  request<Observation>(`${mediaPath(id, 'pages', pageId)}/retranscribe`, { method: 'POST' })

// Saves the engineer's corrected text for a page that was read (MB-17 AC12, the web repo's CP-20).
// The gateway keeps its own reading as evidence and drafts from this. Returns the observation as it
// now is; a refusal carries `fields.text` (blank, or over 20,000 characters).
export const correctPageText = (id: string, pageId: string, text: string) =>
  request<Observation>(`${mediaPath(id, 'pages', pageId)}/transcript`, { method: 'PUT', body: JSON.stringify({ text }) })

export const restoreMedia = (id: string, kind: MediaKind, itemId: string) =>
  request<Observation>(`${mediaPath(id, kind, itemId)}/restore`, { method: 'POST' })

// The deleted observations of an assessment (MB-12 AC22): `?include=deleted` sends them
// with the live ones, so the deleted are picked out. Not cached: it needs the gateway now.
export async function listDeleted(reference: string) {
  const all = await request<Observation[]>(`/api/assessments/${encodeURIComponent(reference)}/observations?include=deleted`)
  return all.filter((o) => o.deleted)
}

// Puts a deleted observation back (CP-08 AC14). Returns it as it now is.
export const restoreObservation = (id: string) =>
  request<Observation>(`/api/observations/${encodeURIComponent(id)}/restore`, { method: 'POST' })
