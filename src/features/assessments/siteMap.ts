// The site's pins for the Site pins screen (MB-02 AC20-AC22): the rows it lists, the maps link,
// and the one-change save. Shapes match the web repo's SiteMapCard.tsx and
// server/src/services/client.service.ts (`siteMapChangeSchema`). Used by screens/SitePins.
import { request } from '@/lib/api'
import type { Coordinates } from '@/features/locations/position'
import type { Location } from '@/features/locations/locations'
import type { Assessment } from './format'

// A row is the site, a block (building), or (MB-02 AC40) a place elsewhere on site, which carries its
// location so its pin is saved on the location itself.
export type PinRow = { key: string; name: string; point: Coordinates | null; block: boolean; place?: Location }

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
export const SITE = 'Site'

// The site, then every block: one already pinned, or a building of this visit's locations, named once
// (any case), as the web's card does. Then (AC40) each place elsewhere on site, one row each, pinned or
// not. Locations inside a building add no row: their building's pin stands for every level.
export function pinRows(site: Assessment['site'], locations: Location[]): PinRow[] {
  const names = (site.pins ?? []).map((p) => p.name)
  for (const { building: b } of locations) if (b && !names.some((n) => same(n, b))) names.push(b)
  return [
    { key: 'site', name: SITE, point: site.coordinates ?? null, block: false },
    ...names.map((name) => {
      const pin = (site.pins ?? []).find((p) => same(p.name, name))
      return { key: `block:${name}`, name, point: pin ? { lat: pin.lat, lng: pin.lng } : null, block: true }
    }),
    ...locations
      .filter((l) => !l.building)
      .map((l) => ({ key: `place:${l.id}`, name: l.name, point: l.coordinates ?? null, block: false, place: l })),
  ]
}

// Google Maps directions to a point, which needs no key (the web's `directionsUrl`).
export const directionsUrl = ({ lat, lng }: Coordinates) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

// One change at a time, so two engineers pinning different blocks can't erase each other (204).
// A point, or null to remove it. A place elsewhere on site keeps its pin on the location
// (PATCH .../locations/:id, which takes the whole location: its name, no building or level).
export const changePin = (siteId: string, reference: string, row: PinRow, point: Coordinates | null) =>
  row.place
    ? request<unknown>(`/api/assessments/${encodeURIComponent(reference)}/locations/${encodeURIComponent(row.place.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: row.place.name, coordinates: point }),
      })
    : request<void>(`/api/sites/${encodeURIComponent(siteId)}/map`, {
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
