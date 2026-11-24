// Words and rules for New assessment (MB-21). Called by screens/NewAssessment and its components.
import type { VisitType } from './api'

// What the screen calls each visit type, and what the gateway stores.
export const VISIT_TYPES: { label: string; value: VisitType }[] = [
  { label: 'First survey', value: 'First survey' },
  { label: 'Resurvey', value: 'Resurvey' },
  { label: 'Follow-up', value: 'Follow-up visit' },
]

// The gateway's FACILITY_TYPES (web server/src/services/knowledge-document.service.ts): it refuses any other.
export const FACILITY_TYPES = [
  'Distribution warehouse',
  'Cold store',
  'Chemical plant',
  'Paper mill',
  'Port terminal',
  'Data centre',
  'Office',
  'Shopping mall',
  'Mixed-use development',
]

// The web's JURISDICTIONS (client/src/features/assessments/demo-data.ts): stored as two letters, and
// retrieval (RT-01) filters on exactly these, so the phone offers them as chips rather than a free box.
export const JURISDICTIONS = [
  { value: 'SG', label: 'Singapore' },
  { value: 'MY', label: 'Malaysia' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'TH', label: 'Thailand' },
  { value: 'PH', label: 'Philippines' },
  { value: 'VN', label: 'Vietnam' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'UK', label: 'United Kingdom' },
]

// The web fills Report due this many days after the survey start (form.ts REPORT_DUE_DAYS).
export const REPORT_DUE_DAYS = 14

// A client's name as the gateway matches it: lowercased, spacing tidied. Must match `clientKey` in the web repo's
// server/src/services/client.service.ts, so "fennick  FOODS" is seen as Fennick Foods before Create, not after.
export const clientKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')
export const FIRST_ONLY = 'A site with no earlier assessment starts with a First survey.'
export const OFFLINE_CREATE = 'Connect to start an assessment.'

// The form's fields, and the gateway's `fields` keys for each (one client, one site, one assessment,
// so always index 0).
export type FieldName = 'client' | 'site' | 'name' | 'address' | 'coordinates' | 'jurisdiction' | 'facilityType' | 'visitType' | 'start' | 'end' | 'due'
const KEYS: Record<FieldName, string[]> = {
  client: ['client', 'client.id', 'client.name'],
  site: ['sites', 'sites.0.id'],
  name: ['sites.0.name'],
  address: ['sites.0.address'],
  coordinates: ['sites.0.coordinates', 'sites.0.coordinates.lat', 'sites.0.coordinates.lng'],
  jurisdiction: ['sites.0.jurisdiction'],
  facilityType: ['sites.0.facilityType'],
  visitType: ['sites.0.assessments.0.visitType'],
  start: ['sites.0.assessments.0.siteVisitDate'],
  end: ['sites.0.assessments.0.siteVisitEndDate'],
  due: ['sites.0.assessments.0.reportDueDate'],
}

/** Returns the gateway's field problems by form field, and whether any key was not one of ours. */
export function mapFields(fields: Record<string, string>) {
  const mine: Partial<Record<FieldName, string>> = {}
  let unknown = false
  for (const [key, text] of Object.entries(fields)) {
    const name = (Object.keys(KEYS) as FieldName[]).find((n) => KEYS[n].includes(key))
    if (name) mine[name] ??= text
    else unknown = true
  }
  return { mine, unknown }
}

// A site's Coordinates as the engineer types or pastes them: "1.2966, 103.8520", a comma or a space between,
// in range. The same rule and words as the web's New Assessment form (client/src/features/assessments/
// googleMaps.ts `parseCoordinates` and `formatCoordinates`; new-assessment/validate.ts).
export const BAD_COORDINATES = 'Enter coordinates such as 1.2966, 103.8520'
export function parseCoordinates(text: string) {
  const found = /^\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)\s*$/.exec(text)
  if (!found) return null
  const point = { lat: Number(found[1]), lng: Number(found[2]) }
  return Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 ? point : null
}
export const formatCoordinates = ({ lat, lng }: { lat: number; lng: number }) => `${lat}, ${lng}`
