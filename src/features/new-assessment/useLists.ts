// The client list and a client's sites for New assessment (MB-21): each loads once, and a
// failure keeps its words so the screen can say it. A site list for a client chosen after
// another is ignored if it arrives late. Called by screens/NewAssessment. Calls api.ts.
import { useEffect, useState } from 'react'
import { errorText } from '@/lib/api'
import { listClients, listClientSites, type Client, type ClientSite } from './api'

type Loaded<T> = { items: T[] | null; error: string | null }

export function useClients(): Loaded<Client> {
  const [state, setState] = useState<Loaded<Client>>({ items: null, error: null })
  useEffect(() => {
    listClients().then(
      (items) => setState({ items, error: null }),
      (e: unknown) => setState({ items: null, error: errorText(e) }),
    )
  }, [])
  return state
}

export function useClientSites(clientId: string | null): Loaded<ClientSite> {
  const [state, setState] = useState<Loaded<ClientSite> & { for: string | null }>({ items: null, error: null, for: null })
  useEffect(() => {
    if (!clientId) return
    let current = true
    listClientSites(clientId).then(
      (items) => current && setState({ items, error: null, for: clientId }),
      (e: unknown) => current && setState({ items: null, error: errorText(e), for: clientId }),
    )
    // A client chosen after this one: this answer is for the wrong client.
    return () => {
      current = false
    }
  }, [clientId])
  return state.for === clientId ? state : { items: null, error: null }
}
