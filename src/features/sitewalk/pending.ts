// What a walk has taken but the gateway hasn't confirmed yet (MB-16 AC11, AC12): parts, photos and
// notes are kept on the phone first, in the engineer's own folder (src/lib/store.ts), and each is
// forgotten only once the gateway says it has it. Used by screens/WalkRecording. Calls the walk
// uploads in ./api. A repeat upload of the same seq or id changes nothing on the gateway, so a send
// that was cut off is safe to run again.
import { File } from 'expo-file-system'
import { ApiError, errorText, NetworkError } from '@/lib/api'
import { folder, read, remove, write } from '@/lib/store'
import { saveNote, uploadPhoto, uploadRecording } from './api'

export type Pending =
  | { kind: 'recording'; seq: number; file: string; durationSec: number }
  | { kind: 'photo'; id: string; file: string; recordingSeq: number | null; offsetSec: number | null }
  | { kind: 'note'; seq: number; text: string }

const key = (walkId: string) => `walk-${walkId}`
// Where the walk's parts and photos are kept, until sent.
const dir = (walkId: string) => folder('walks', walkId)

export const pendingFor = (walkId: string) => read<Pending[]>(key(walkId)) ?? []

// The camera and recorder leave their files in the cache, which the system can clear: copy first.
export async function keepFile(walkId: string, uri: string, name: string) {
  dir(walkId).create({ intermediates: true, idempotent: true })
  const copy = new File(dir(walkId), name)
  await new File(uri).copy(copy)
  return copy.uri
}

export function addPending(walkId: string, item: Pending) {
  const next = [...pendingFor(walkId), item]
  write(key(walkId), next)
  return next
}

// A note's new text under its number: an edit of a sent note, of one still waiting, or (blank) a
// remove. It replaces any waiting change to that note, and goes out like any other part.
export function putNote(walkId: string, seq: number, text: string) {
  const next = [...pendingFor(walkId).filter((p) => !(p.kind === 'note' && p.seq === seq)), { kind: 'note' as const, seq, text }]
  write(key(walkId), next)
  return next
}

// The note typed but not added yet, kept per walk on the phone so a closed screen doesn't lose it.
const draftKey = (walkId: string) => `walk-draft-${walkId}`
export const readDraft = (walkId: string) => read<string>(draftKey(walkId)) ?? ''
export const writeDraft = (walkId: string, text: string) => (text ? write(draftKey(walkId), text) : remove(draftKey(walkId)))

// A gateway fault with no reason of its own (e.g. its file storage is down) would read "The server
// replied 500." Say what it means for the engineer's recording instead. A reason the gateway did
// give is kept.
function whyNotSent(e: unknown) {
  if (e instanceof ApiError && e.status >= 500 && e.message === `The server replied ${e.status}.`)
    return "The server couldn't save this yet. It's kept on this phone and will send later."
  return errorText(e)
}

// One send at a time per walk. Voice, photo, note and Finish all start a send without waiting for the
// last; two at once would upload each item twice and write an older list over a newer one.
const sending = new Map<string, Promise<unknown>>()

// Sends what is waiting, in the order it was taken. Stops at the first that can't go: no signal (it
// waits), or a refusal (its reason is returned; it stays, so nothing is lost). Returns what is still
// waiting, read from the phone after the last upload, so anything added meanwhile is kept.
export function sendPending(reference: string, walkId: string): Promise<{ left: Pending[]; problem: string | null }> {
  const run = (sending.get(walkId) ?? Promise.resolve()).then(() => sendAll(reference, walkId))
  sending.set(walkId, run.catch(() => {}))
  return run
}

async function sendAll(reference: string, walkId: string): Promise<{ left: Pending[]; problem: string | null }> {
  for (const item of pendingFor(walkId)) {
    try {
      if (item.kind === 'recording') await uploadRecording(reference, walkId, item.seq, item.file, item.durationSec)
      else if (item.kind === 'photo') await uploadPhoto(reference, walkId, item.id, item.file, item.recordingSeq, item.offsetSec)
      else await saveNote(reference, walkId, item.seq, item.text)
    } catch (e) {
      // No signal just waits; anything else says why.
      return { left: pendingFor(walkId), problem: e instanceof NetworkError ? null : whyNotSent(e) }
    }
    // Only this item goes: an edit or part added during the upload stays on the list.
    write(key(walkId), pendingFor(walkId).filter((p) => JSON.stringify(p) !== JSON.stringify(item)))
    if ('file' in item) {
      const f = new File(item.file)
      if (f.exists) f.delete()
    }
  }
  return { left: pendingFor(walkId), problem: null }
}

// A discarded walk's waiting parts, photos and notes go too. Without this the phone would keep
// files for a walk the gateway no longer has.
export function forgetWalk(walkId: string) {
  remove(key(walkId))
  remove(draftKey(walkId))
  if (dir(walkId).exists) dir(walkId).delete()
}
