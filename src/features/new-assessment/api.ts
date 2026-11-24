// The gateway calls behind New assessment (MB-21, web CP-01 and CP-23): the client list, a
// client's sites, and the one call that creates the assessment. Called by useClients.ts,
// useClientSites.ts and screens/NewAssessment. Calls the web repo's server/src/routes/
// client.routes.ts (GET /api/clients, GET /api/clients/:id/sites) and assessment.routes.ts
// (POST /api/assessments); the shapes must match client.service.ts and assessment-batch.service.ts.
import { request } from '@/lib/api'
import type { Assessment } from '@/features/assessments/format'

export type Client = { id: string; name: string; division: string | null; sites: number }
export type ClientSite = {
  id: string
  code: string
  name: string
  address: string | null
  jurisdiction: string
  facilityType: string
  // Its latest visit, or null when it has none yet.
  latest: { reference: string; siteVisitDate: string | null; locations: number; buildings: number } | null
}

// The stored visit type: the gateway still calls a Follow-up "Follow-up visit".
export type VisitType = 'First survey' | 'Resurvey' | 'Follow-up visit'
// `coordinates` is optional (the web's Coordinates field): the site's point, sent only when filled in.
export type NewSite = { name: string; address: string; jurisdiction: string; facilityType: string; coordinates?: { lat: number; lng: number } }
export type NewAssessment = {
  // A listed client's id, or a new one by name (the gateway finds a client of that name or adds it).
  client: { id: string } | { name: string; division?: string }
  // An existing site's id, or the details of a new one.
  site: { id: string } | NewSite
  visitType: VisitType
  // YYYY-MM-DD, or '' for none.
  start: string
  end: string
  due: string
}

export const listClients = () => request<Client[]>('/api/clients')
export const listClientSites = (clientId: string) => request<ClientSite[]>(`/api/clients/${encodeURIComponent(clientId)}/sites`)

/** The street address nearest a point, or null when Google has none (gateway routes/site.routes.ts). */
export const addressAt = (p: { lat: number; lng: number }) =>
  request<{ address: string | null }>(`/api/sites/address?lat=${p.lat}&lng=${p.lng}`)

/** Sends one client's one site with one assessment; returns the created assessments (201). */
export function createAssessment(a: NewAssessment) {
  const site = 'id' in a.site
    // On a listed site the new visit starts with the latest visit's locations (the web's default).
    ? { ref: 'site-1', id: a.site.id, copyLocations: true }
    : { ref: 'site-1', ...a.site }
  return request<{ clientId: string; assessments: Assessment[] }>('/api/assessments', {
    method: 'POST',
    body: JSON.stringify({
      client: a.client,
      sites: [
        {
          ...site,
          assessments: [
            {
              ref: 'assessment-1',
              visitType: a.visitType,
              // A date left empty is left out: the gateway takes none as none.
              ...(a.start && { siteVisitDate: a.start }),
              ...(a.end && a.end !== a.start && { siteVisitEndDate: a.end }),
              ...(a.due && { reportDueDate: a.due }),
            },
          ],
        },
      ],
    }),
  })
}
