// The offline queue (MB-10): observations and new locations saved with no
// signal, kept on the phone until the gateway can be reached. Used by
// provider.tsx, which saves the list and runs upload(). Uploads through the
// same calls as an online save.
import { File } from 'expo-file-system'
import { ApiError, errorText, NetworkError } from '@/lib/api'
import { folder } from '@/lib/store'
import { saveObservation } from '@/features/capture/api'
import type { Draft } from '@/features/capture/draft'
import { addLocation, listLocations } from '@/features/locations/api'
import { samePlace, savedLevel, type Location } from '@/features/locations/locations'
import type { Observation } from '@/features/observations/format'

type Base = { id: string; reference: string; error?: string }
export type QueuedLocation = Base & { kind: 'location'; location: Location }
export type QueuedObservation = Base & { kind: 'observation'; locationId: string; draft: Draft; savedAt: string }
export type Item = QueuedLocation | QueuedObservation

// A queued location's ID, until the gateway gives it a real one.
export const isLocal = (id: string) => id.startsWith('local-')
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
// Where a queued observation's photos, voice notes and scans are kept.
const filesOf = (id: string) => folder('queue', id)
export function removeFiles(item: Item) {
  const dir = filesOf(item.id)
  if (dir.exists) dir.delete()
}

// Shown in the picker straight away, as the gateway will save it (AC3).
export function queuedLocation(reference: string, details: { building: string; floor: string; name: string }) {
  const id = newId()
  const location: Location = {
    id: `local-${id}`,
    building: details.building.trim() || null,
    floor: details.floor.trim() ? savedLevel(details.floor) : null,
    name: details.name.trim(),
  }
  return { kind: 'location', id, reference, location } satisfies QueuedLocation
}

// The draft's files are copied into the queue's own folder first: the camera
// and recorder leave them in the cache, which the system can clear before the
// signal comes back (AC2). Only their names are kept: iOS can move the app's
// folder when the app updates, so a full path saved today may not work later.
export async function queuedObservation(reference: string, draft: Draft, locationId: string) {
  const id = newId()
  const dir = filesOf(id)
  dir.create({ intermediates: true, idempotent: true })
  const keep = async (uri: string, name: string) => {
    const copy = new File(dir, `${name}-${uri.split('/').pop()}`)
    await new File(uri).copy(copy)
    return copy.name
  }
  const kept: Draft = {
    ...draft,
    photos: await Promise.all(draft.photos.map((uri, i) => keep(uri, `photo-${i}`))),
    pages: await Promise.all(draft.pages.map((uri, i) => keep(uri, `page-${i}`))),
    recordings: await Promise.all(
      draft.recordings.map(async (r, i) => ({ ...r, uri: await keep(r.uri, `recording-${i}`) })),
    ),
  }
  const item: QueuedObservation = {
    kind: 'observation',
    id,
    reference,
    locationId,
    draft: kept,
    savedAt: new Date().toISOString(),
  }
  return item
}

// The queued draft with each file name turned back into a path, as it is now.
function withFiles({ id, draft }: QueuedObservation): Draft {
  const path = (name: string) => new File(filesOf(id), name).uri
  return {
    ...draft,
    photos: draft.photos.map(path),
    pages: draft.pages.map(path),
    recordings: draft.recordings.map((r) => ({ ...r, uri: path(r.uri) })),
  }
}

// How a waiting observation shows in the workspace, with the card the
// gateway's use. Its photo is the local copy (ObservationCard reads file: URIs).
export function asObservation(item: QueuedObservation): Observation {
  const draft = withFiles(item)
  return {
    id: item.id,
    note: draft.note.trim() || null,
    copeDimensions: draft.cope.length ? draft.cope : null,
    severity: draft.severity,
    location: { id: item.locationId },
    recordings: draft.recordings.map((r, i) => ({ id: `${item.id}-${i}`, url: r.uri })),
    photos: draft.photos.map((url) => ({ url })),
    pages: draft.pages.map((url) => ({ url })),
    recordedAt: item.savedAt,
  }
}

// A 409 means it's listed already: added by a colleague, or by an upload whose
// reply was lost. Its observations use that one (AC6).
async function addOrFind({ reference, location: l }: QueuedLocation) {
  try {
    return await addLocation(reference, { building: l.building ?? '', floor: l.floor ?? '', name: l.name })
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 409)) throw e
    const listed = (await listLocations(reference)).find((other) => samePlace(other, l))
    if (!listed) throw e
    return listed
  }
}

// Not a refusal, so it waits for the next try: no signal, a session to sign
// back in to, or the gateway itself failing (500, 502, 503) rather than
// turning the observation down.
const later = (e: unknown) => e instanceof NetworkError || (e instanceof ApiError && (e.status === 401 || e.status >= 500))

// Uploads the items in the order they were made (AC4). `get` reads the list
// as it is now, so one queued mid-upload is kept; `set` saves it after each
// item, so one already uploaded isn't sent again after the app closes.
// (A lost reply can still send one twice: the gateway has no guard yet, see
// the MB-10 spec.) `onLocation` tells the caller a queued location's real ID.
export async function upload(
  get: () => Item[],
  set: (items: Item[]) => void,
  onLocation: (reference: string, local: Location, saved: Location) => void,
) {
  for (const { id } of get()) {
    const item = get().find((i) => i.id === id)
    if (!item || item.error) continue
    const refuse = (error: string) => set(get().map((i) => (i.id === id ? { ...i, error } : i)))
    if (item.kind === 'location') {
      // Its observations, which still use its local ID.
      const filedHere = (i: Item) => i.kind === 'observation' && i.locationId === item.location.id
      try {
        const saved = await addOrFind(item)
        set(get().filter((i) => i.id !== id).map((i) => (filedHere(i) ? { ...i, locationId: saved.id } : i)))
        onLocation(item.reference, item.location, saved)
      } catch (e) {
        if (later(e)) return
        // Refused (AC6): the location is dropped, and its observations say why,
        // with Discard, in the workspace.
        const error = `Its location, ${item.location.name}, couldn't be added: ${errorText(e)}`
        set(get().flatMap((i) => (i.id === id ? [] : filedHere(i) ? [{ ...i, error }] : [i])))
      }
      continue
    }
    // Its location was refused before it was queued, or its files are gone:
    // it can never upload, so it says so rather than block the queue.
    const draft = withFiles(item)
    if (isLocal(item.locationId)) {
      refuse("Its location couldn't be added. Capture it again at another location.")
      continue
    }
    if ([...draft.photos, ...draft.pages, ...draft.recordings.map((r) => r.uri)].some((uri) => !new File(uri).exists)) {
      refuse('Its photos, voice notes or scans are missing from this phone.')
      continue
    }
    try {
      await saveObservation(item.reference, draft, item.locationId)
      removeFiles(item)
      set(get().filter((i) => i.id !== id))
    } catch (e) {
      if (later(e)) return
      refuse(errorText(e))
    }
  }
}
