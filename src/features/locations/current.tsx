// The location the engineer says they're at, for each assessment (MB-02 AC3).
// Set by the location picker, read by the workspace (and by capture in MB-03).
// Kept in memory, so it lasts while the app is open; remembering it after a
// restart needs phone storage, which comes with the offline queue.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useSession } from '@/features/auth/session'
import type { Location } from './locations'

type CurrentLocations = {
  get(reference: string): Location | undefined
  set(reference: string, location: Location): void
  // A queued location got its real ID (MB-10): the engineer stays there.
  replace(reference: string, local: Location, saved: Location): void
}

const Context = createContext<CurrentLocations | null>(null)

export function CurrentLocationProvider({ children }: { children: ReactNode }) {
  // Choices belong to the engineer who made them. When someone else signs in on
  // a shared phone they don't apply, so that engineer's captures are never
  // filed under another's location. The same engineer signing back in after an
  // expired session keeps theirs, so they don't lose their place mid-walk.
  const owner = useSession().user?.id ?? null
  const [state, setState] = useState<{ owner: string | null; chosen: Record<string, Location> }>({
    owner,
    chosen: {},
  })

  const get = useCallback(
    (reference: string) => (state.owner === owner ? state.chosen[reference] : undefined),
    [state, owner],
  )
  const set = useCallback(
    (reference: string, location: Location) =>
      setState((s) => ({
        owner,
        chosen: { ...(s.owner === owner ? s.chosen : {}), [reference]: location },
      })),
    [owner],
  )
  const replace = useCallback(
    (reference: string, local: Location, saved: Location) =>
      setState((s) =>
        s.chosen[reference]?.id === local.id ? { ...s, chosen: { ...s.chosen, [reference]: saved } } : s,
      ),
    [],
  )
  return <Context.Provider value={{ get, set, replace }}>{children}</Context.Provider>
}

// For the offline provider, which hands over a queued location's real ID.
export function useReplaceLocation() {
  const context = useContext(Context)
  if (!context) throw new Error('useReplaceLocation must be used inside CurrentLocationProvider')
  return context.replace
}

// The chosen location for one assessment, and a setter for it.
export function useCurrentLocation(reference: string) {
  const context = useContext(Context)
  if (!context) throw new Error('useCurrentLocation must be used inside CurrentLocationProvider')
  return [context.get(reference), (l: Location) => context.set(reference, l)] as const
}
