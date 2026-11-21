// The gateway's location routes for one assessment (MB-02). Called by the
// location picker. Shapes match location.service.ts in the web repo.
import { cached, request } from '@/lib/api'
import type { Location } from './locations'

const path = (reference: string) => `/api/assessments/${encodeURIComponent(reference)}/locations`

export const listLocations = (reference: string) => cached<Location[]>(path(reference))

// The IDs of locations that have observations, deleted ones included: the gateway refuses to remove
// any of them (MB-02 AC35), so the picker offers no Remove there. `?include=deleted` sends every
// observation. Not cached: with no signal the swipe is off anyway.
export async function locationsInUse(reference: string) {
  const all = await request<{ location?: { id: string } | null }[]>(
    `/api/assessments/${encodeURIComponent(reference)}/observations?include=deleted`,
  )
  return new Set(all.flatMap((o) => (o.location ? [o.location.id] : [])))
}

// Removes a saved location (MB-02 AC37). The gateway refuses with 409 while observations are filed
// there, and with 403 for anyone but the assigned engineer; request() throws with its words.
export const removeLocation = (reference: string, id: string) =>
  request<void>(`${path(reference)}/${encodeURIComponent(id)}`, { method: 'DELETE' })

// Blank building and level are left out, so the gateway saves the location as
// elsewhere on site. The gateway standardises the level ("L2" → "Level 2").
export function addLocation(
  reference: string,
  details: { building: string; floor: string; name: string; coordinates?: { lat: number; lng: number } | null },
) {
  const body = {
    ...(details.building.trim() && { building: details.building.trim() }),
    ...(details.floor.trim() && { floor: details.floor.trim() }),
    name: details.name.trim(),
    // Only when pinned (MB-02 AC14); the gateway refuses a bad one under `coordinates`.
    ...(details.coordinates && { coordinates: details.coordinates }),
  }
  return request<Location>(path(reference), { method: 'POST', body: JSON.stringify(body) })
}
