// The site's pins for the Site pins screen (MB-02 AC20-AC22): the rows it lists, the maps link,
// and the one-change save. Shapes match the web repo's SiteMapCard.tsx and
// server/src/services/client.service.ts (`siteMapChangeSchema`). Used by screens/SitePins.
import { request } from '@/lib/api'
import type { Coordinates } from '@/features/locations/position'
import type { Assessment } from './format'

export type PinRow = { key: string; name: string; point: Coordinates | null; block: boolean }

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
export const SITE = 'Site'

// The site, then every block: one already pinned, or a building of this visit's locations, named once
// (any case), as the web's card does. A location outside any building has no block.
export function pinRows(site: Assessment['site'], buildings: (string | null)[]): PinRow[] {
  const names = (site.pins ?? []).map((p) => p.name)
  for (const b of buildings) if (b && !names.some((n) => same(n, b))) names.push(b)
  return [
    { key: 'site', name: SITE, point: site.coordinates ?? null, block: false },
    ...names.map((name) => {
      const pin = (site.pins ?? []).find((p) => same(p.name, name))
      return { key: `block:${name}`, name, point: pin ? { lat: pin.lat, lng: pin.lng } : null, block: true }
    }),
  ]
}

// Google Maps directions to a point, which needs no key (the web's `directionsUrl`).
export const directionsUrl = ({ lat, lng }: Coordinates) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

// One change at a time, so two engineers pinning different blocks can't erase each other (204).
// A point, or null to remove it.
export const changePin = (siteId: string, row: PinRow, point: Coordinates | null) =>
  request<void>(`/api/sites/${encodeURIComponent(siteId)}/map`, {
    method: 'PUT',
    body: JSON.stringify(row.block ? { block: row.name, point } : { coordinates: point }),
  })

// "1.2966, 103.8520" (or a space between), as the web's field reads it; null when it isn't two
// numbers in range (the gateway checks the range again).
export function parseCoordinates(text: string): Coordinates | null {
  const found = /^\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)\s*$/.exec(text)
  if (!found) return null
  const point = { lat: Number(found[1]), lng: Number(found[2]) }
  return Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 ? point : null
}
