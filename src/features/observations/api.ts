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
export type Changes = { severity?: Severity; copeDimensions?: Cope[] | null; note?: string | null }

export const updateObservation = (id: string, changes: Changes) =>
  request<Observation>(`/api/observations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) })

// A soft delete: the gateway marks it deleted and keeps it, so the web can restore it.
export const deleteObservation = (id: string) =>
  request<Observation>(`/api/observations/${encodeURIComponent(id)}`, { method: 'DELETE' })

// Photos and voice notes inside a saved observation (MB-12 AC16-AC21). Each returns the
// observation as it now is. Adding sends the files on Save, and each voice note is then
// transcribed by the gateway (a paid call); removing is soft, so it can be restored.
export type MediaKind = 'photos' | 'recordings'

// New photos (file URIs) and voice notes waiting to be added: kept on the edit screen
// until Save, then sent together (MB-12 AC20), which is when each voice note is transcribed.
export type NewMedia = { photos: string[]; recordings: VoiceNote[] }
export const noNewMedia: NewMedia = { photos: [], recordings: [] }

export const addMedia = (id: string, media: NewMedia) =>
  request<Observation>(`/api/observations/${encodeURIComponent(id)}/media`, {
    method: 'POST',
    body: mediaToFormData(media.photos, media.recordings),
  })

const mediaPath = (id: string, kind: MediaKind | 'pages', itemId: string) =>
  `/api/observations/${encodeURIComponent(id)}/${kind}/${encodeURIComponent(itemId)}`

export const removeMedia = (id: string, kind: MediaKind, itemId: string) =>
  request<Observation>(mediaPath(id, kind, itemId), { method: 'DELETE' })

// Starts a new attempt at a failed voice note or page (CP-03 AC6, CP-19 AC11). The gateway
// answers 202 with no body and works in the background, so the caller reads the list again.
export const retryTranscription = (id: string, kind: MediaKind | 'pages', itemId: string) =>
  request<void>(`${mediaPath(id, kind, itemId)}/transcription/retry`, { method: 'POST' })

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
