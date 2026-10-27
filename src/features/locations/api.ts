// The gateway's location routes for one assessment (MB-02). Called by the
// location picker. Shapes match location.service.ts in the web repo.
import { request } from '@/lib/api'
import type { Location } from './locations'

const path = (reference: string) => `/api/assessments/${encodeURIComponent(reference)}/locations`

export const listLocations = (reference: string) => request<Location[]>(path(reference))

// Blank building and level are left out, so the gateway saves the location as
// elsewhere on site. The gateway standardises the level ("L2" → "Level 2").
export function addLocation(reference: string, details: { building: string; floor: string; name: string }) {
  const body = {
    ...(details.building.trim() && { building: details.building.trim() }),
    ...(details.floor.trim() && { floor: details.floor.trim() }),
    name: details.name.trim(),
  }
  return request<Location>(path(reference), { method: 'POST', body: JSON.stringify(body) })
}
