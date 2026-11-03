// Saves an observation (MB-03 AC11). Called by the capture sheet.
import { request } from '@/lib/api'
import { toFormData, type Draft } from './draft'

const base = (reference: string) => `/api/assessments/${encodeURIComponent(reference)}`

export async function saveObservation(reference: string, draft: Draft, locationId: string) {
  // a. The gateway only takes observations into an active capture session. It
  //    returns the active one if there is one, so this is safe on every save.
  //    It's done here, not when the workspace opens, because starting a session
  //    reopens a completed assessment (MB-02 AC6).
  await request(`${base(reference)}/capture-session`, { method: 'POST' })
  // b. The observation and its files. Recordings and pages start their
  //    (paid) transcription on the gateway as soon as they're saved.
  return request(`${base(reference)}/observations`, {
    method: 'POST',
    body: toFormData(draft, locationId),
  })
}
