// Small JSON files kept on the phone (MB-10): the last copy of what the gateway
// sent, and the offline queue. Called by src/lib/api.ts (cached GETs), the
// session and src/features/offline. Each engineer has their own folder, so on a
// shared phone one never sees or uploads another's (AC5).
import { Directory, File, Paths } from 'expo-file-system'

let owner = 'nobody'
// Set by the session on sign-in; every read and write after uses that folder.
export const setOwner = (id: string) => void (owner = id)

// Paths.document: storage the system never clears, unlike the cache the
// camera and recorder write to.
export const folder = (...parts: string[]) => new Directory(Paths.document, 'users', owner, ...parts)
// Outside any engineer's folder, for the last engineer signed in.
export const device = () => new Directory(Paths.document)

// Encoded, so a key like "cache/api/assessments" is one file, not folders.
const file = (name: string, dir: Directory) => new File(dir, `${encodeURIComponent(name)}.json`)

// undefined when there's no copy, or it can't be read (e.g. half-written).
export function read<T>(name: string, dir = folder()): T | undefined {
  try {
    const f = file(name, dir)
    return f.exists ? (JSON.parse(f.textSync()) as T) : undefined
  } catch {
    return undefined
  }
}

// Written beside the file, then moved over it, so a crash mid-write leaves the
// old copy rather than a broken one (a broken queue would read as empty).
export function write(name: string, value: unknown, dir = folder()) {
  const draft = file(`${name}.tmp`, dir)
  draft.create({ intermediates: true, overwrite: true })
  draft.writeSync(JSON.stringify(value))
  draft.moveSync(file(name, dir), { overwrite: true })
}

export function remove(name: string, dir = folder()) {
  const f = file(name, dir)
  if (f.exists) f.delete()
}
