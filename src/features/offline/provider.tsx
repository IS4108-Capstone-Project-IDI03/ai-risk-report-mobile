// Offline state and the queue for the signed-in engineer (MB-10). Wraps the
// screens in src/app/_layout.tsx. The capture sheet and location picker queue
// what can't reach the gateway; the workspace and Home show what's waiting.
// Calls queue.ts's upload() whenever the signal may be back (AC4).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { setOnReach } from '@/lib/api'
import { read, write } from '@/lib/store'
import { useSession } from '@/features/auth/session'
import type { Draft } from '@/features/capture/draft'
import { useReplaceLocation } from '@/features/locations/current'
import type { Location } from '@/features/locations/locations'
import { queuedLocation, queuedMark, queuedObservation, removeFiles, upload, type Item, type QueuedMark } from './queue'

type Offline = {
  // The last call couldn't reach the gateway, so screens show their last copy.
  offline: boolean
  items: Item[]
  // Goes up after each upload, so the workspace reloads and shows it from the gateway.
  uploads: number
  queueObservation(reference: string, draft: Draft, locationId: string): Promise<void>
  queueLocation(reference: string, details: { building: string; floor: string; name: string; coordinates?: { lat: number; lng: number } | null }): Location
  // A checklist mark made with no signal (MB-05 AC16).
  queueMark(reference: string, itemId: string, mark: QueuedMark['mark']): void
  // Drops a waiting observation's link to its checklist item and tries it again: for one
  // the gateway refused because the item is gone or already answered (MB-05 AC18).
  unlink(id: string): void
  discard(id: string): void
}

const Context = createContext<Offline | null>(null)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const owner = useSession().user?.id ?? null
  const replace = useReplaceLocation()
  const [offline, setOffline] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [uploads, setUploads] = useState(0)
  // The list as it is now, for upload() and handlers that run between renders.
  const latest = useRef<Item[]>([])
  const running = useRef(false)
  const wasOffline = useRef(false)

  // Every change is saved on the phone at once (AC5).
  const commit = useCallback((next: Item[]) => {
    latest.current = next
    write('queue', next)
    setItems(next)
  }, [])

  // One upload at a time, so two triggers never send the same item twice.
  const tryUpload = useCallback(async () => {
    if (running.current || !owner || !latest.current.some((i) => !i.error)) return
    running.current = true
    const before = latest.current.length
    try {
      await upload(() => latest.current, commit, replace)
    } finally {
      running.current = false
    }
    if (latest.current.length < before) setUploads((n) => n + 1)
  }, [owner, commit, replace])

  // This engineer's queue, from their folder (src/lib/store.ts), and an upload
  // try straight away, e.g. after signing back in (AC5).
  useEffect(() => {
    latest.current = owner ? (read<Item[]>('queue') ?? []) : []
    setItems(latest.current)
    tryUpload()
  }, [owner, tryUpload])

  // AC4's triggers: a. any call reaches the gateway after one didn't;
  // b. the app comes to the front; c. every 30 seconds while items wait.
  useEffect(() => {
    setOnReach((reached) => {
      if (reached && wasOffline.current) tryUpload()
      wasOffline.current = !reached
      setOffline(!reached)
    })
  }, [tryUpload])
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && tryUpload())
    return () => sub.remove()
  }, [tryUpload])
  const waiting = items.some((i) => !i.error)
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(tryUpload, 30_000)
    return () => clearInterval(timer)
  }, [waiting, tryUpload])

  const add = useCallback((item: Item) => commit([...latest.current, item]), [commit])
  const value: Offline = {
    offline,
    items,
    uploads,
    queueObservation: async (reference, draft, locationId) =>
      add(await queuedObservation(reference, draft, locationId)),
    queueLocation(reference, details) {
      const item = queuedLocation(reference, details)
      add(item)
      return item.location
    },
    queueMark: (reference, itemId, mark) => add(queuedMark(reference, itemId, mark)),
    unlink(id) {
      commit(
        latest.current.map((i) => (i.id === id && i.kind === 'observation' ? { ...i, error: undefined, draft: { ...i.draft, checklistItem: undefined } } : i)),
      )
      tryUpload()
    },
    discard(id) {
      const item = latest.current.find((i) => i.id === id)
      if (item) removeFiles(item)
      commit(latest.current.filter((i) => i.id !== id))
    },
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useOffline() {
  const context = useContext(Context)
  if (!context) throw new Error('useOffline must be used inside OfflineProvider')
  return context
}
