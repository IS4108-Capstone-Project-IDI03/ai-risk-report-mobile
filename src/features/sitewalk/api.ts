// The gateway's site walk routes (MB-16; the web's CP-22). Shapes match the web client's
// site-walk/api.ts and server/src/routes/site-walk.routes.ts. Called by the Site walks screen, the
// recorder and the review. The AI steps (transcribing, proposing) happen on the gateway, started by
// Finish walk and Try again; nothing here calls a model.
import { cached, request } from '@/lib/api'
import { filePart, type Cope } from '@/features/capture/draft'
import type { Severity } from '@/features/observations/format'

export type WalkStatus = 'recording' | 'transcribing' | 'proposing' | 'ready' | 'failed' | 'created'

// The AI's proposal, edited by the engineer (the web's site-walk/api.ts). Create all adds it once.
export type ProposedLocation = {
  ref: string
  // Set when it is one of the assessment's locations already.
  existingId: string | null
  kind: 'building' | 'elsewhere'
  building: string | null
  floor: string | null
  name: string
}
export type ProposedObservation = {
  ref: string
  note: string
  copeDimension: Cope | null
  severity: Severity | null
  // null: the AI found no clear place, so the engineer chooses one.
  locationRef: string | null
  recordingSeq: number | null
  start: number | null
  end: number | null
  photoIds: string[]
  mediaIds?: string[]
  check: { severity: boolean; category: boolean; location: boolean }
}
export type Proposal = { locations: ProposedLocation[]; observations: ProposedObservation[]; removed?: ProposedObservation[] }

export type SiteWalk = {
  id: string
  status: WalkStatus
  // The engineer's name for the walk; null until Finish walk, and on older walks.
  name: string | null
  createdAt: string
  recordings: { seq: number; durationSec: number; transcription: 'queued' | 'transcribing' | 'transcribed' | 'failed'; transcript: string | null; audioUrl: string }[]
  notes: { seq: number; text: string }[]
  photos: { id: string; url: string; recordingSeq: number | null; offsetSec: number | null }[]
  // Why a walk failed, in plain English.
  error: string | null
  // The AI's proposal, once the walk is ready.
  proposal?: Proposal | null
  // Photos, handwritten pages and voice clips added to the proposal by hand (AC27); a clip's transcript once done.
  media?: { id: string; kind: 'photo' | 'page' | 'voice'; url: string; transcription: 'queued' | 'transcribing' | 'transcribed' | 'failed' | null; transcript: string | null }[]
}

const walks = (reference: string) => `/api/assessments/${encodeURIComponent(reference)}/site-walks`
const walkPath = (reference: string, id: string) => `${walks(reference)}/${encodeURIComponent(id)}`

// The assessment's walks, newest first, created ones too (the screen groups them). Kept on the phone, so the
// list opens offline.
export const listWalks = (reference: string) => cached<SiteWalk[]>(walks(reference))

// A walk still being recorded by this engineer (200), or a new one (201).
export const startWalk = (reference: string) => request<SiteWalk>(walks(reference), { method: 'POST' })

// Re-runs a walk whose processing failed: one paid AI step.
export const retryWalk = (reference: string, id: string) => request<SiteWalk>(`${walkPath(reference, id)}/retry`, { method: 'POST' })

export const renameWalk = (reference: string, id: string, name: string) =>
  request<SiteWalk>(`${walkPath(reference, id)}/name`, { method: 'PUT', body: JSON.stringify({ name }) })

// Throws a walk away before it is created, with its recordings and photos.
export const discardWalk = (reference: string, id: string) => request<void>(walkPath(reference, id), { method: 'DELETE' })

// One walk as it is now: what the gateway already holds, for the recorder to number the next part.
export const getWalk = (reference: string, id: string) => request<SiteWalk>(walkPath(reference, id))

// Sends one finished part; a repeat of the same seq changes nothing. Transcribing starts at Finish
// walk, not here. The phone makes M4A, as for voice notes.
export function uploadRecording(reference: string, id: string, seq: number, uri: string, durationSec: number) {
  const form = new FormData()
  form.append('recording', filePart(uri, `recording-${seq}.m4a`, 'audio/m4a'))
  form.append('durationSec', String(durationSec))
  return request<SiteWalk>(`${walkPath(reference, id)}/recordings/${seq}`, { method: 'PUT', body: form })
}

// One photo under the phone's own id, tied to the part it follows and how far into it; a repeat changes nothing.
export function uploadPhoto(reference: string, id: string, photoId: string, uri: string, recordingSeq: number | null, offsetSec: number | null) {
  const form = new FormData()
  form.append('photo', filePart(uri, `${photoId}.jpg`, 'image/jpeg'))
  if (recordingSeq !== null) form.append('recordingSeq', String(recordingSeq))
  if (offsetSec !== null) form.append('offsetSec', String(offsetSec))
  return request<SiteWalk>(`${walkPath(reference, id)}/photos/${encodeURIComponent(photoId)}`, { method: 'PUT', body: form })
}

// One photo, handwritten page or voice clip added to the proposal by hand, under the phone's own id; a
// repeat changes nothing. The form's part name must match the gateway's media-form.ts: `photo`, `page`
// or `recording`.
export function uploadProposalMedia(reference: string, id: string, mediaId: string, kind: 'photo' | 'page' | 'voice', uri: string) {
  const form = new FormData()
  form.append(kind === 'voice' ? 'recording' : kind, kind === 'voice' ? filePart(uri, `${mediaId}.m4a`, 'audio/m4a') : filePart(uri, `${mediaId}.jpg`, 'image/jpeg'))
  return request<SiteWalk>(`${walkPath(reference, id)}/media/${encodeURIComponent(mediaId)}`, { method: 'PUT', body: form })
}

// A typed note under its seq (shared with the recordings); blank text removes it.
export const saveNote = (reference: string, id: string, seq: number, text: string) =>
  request<SiteWalk>(`${walkPath(reference, id)}/notes/${seq}`, { method: 'PUT', body: JSON.stringify({ text }) })

// Ends the walk under the engineer's name for it. Transcribing and the AI step (both paid) run on the gateway.
export const finishWalk = (reference: string, id: string, name: string) =>
  request<SiteWalk>(`${walkPath(reference, id)}/finish`, { method: 'POST', body: JSON.stringify({ name }) })

// Replaces the whole proposal with the engineer's edits (autosave).
export const saveProposal = (reference: string, id: string, proposal: Proposal) =>
  request<SiteWalk>(`${walkPath(reference, id)}/proposal`, { method: 'PUT', body: JSON.stringify(proposal) })

// Adds every proposed location and observation to the assessment, once.
export const createAll = (reference: string, id: string) =>
  request<{ locationIds: string[]; observationIds: string[] }>(`${walkPath(reference, id)}/create`, { method: 'POST' })
