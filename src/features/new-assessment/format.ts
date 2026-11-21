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

export const FIRST_ONLY = 'A site with no earlier assessment starts with a First survey.'
export const OFFLINE_CREATE = 'Connect to start an assessment.'

// The form's fields, and the gateway's `fields` keys for each (one client, one site, one assessment,
// so always index 0).
export type FieldName = 'client' | 'site' | 'name' | 'address' | 'jurisdiction' | 'facilityType' | 'visitType' | 'start' | 'end' | 'due'
const KEYS: Record<FieldName, string[]> = {
  client: ['client', 'client.id', 'client.name'],
  site: ['sites', 'sites.0.id'],
  name: ['sites.0.name'],
  address: ['sites.0.address'],
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
