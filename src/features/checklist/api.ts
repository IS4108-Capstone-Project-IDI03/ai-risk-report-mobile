// The gateway's pre-survey checklist (MB-05). Shapes match ChecklistDto and the GET
// route in the web repo's checklist.service.ts and assessment.routes.ts.
// Called by screens/Checklist. The read is kept on the phone (`cached`), so the
// checklist opens with no signal (AC15).
import { cached, request } from '@/lib/api'
import { write } from '@/lib/store'

// Where an item stands on site (CP-31): answered by an observation (confirmed or
// differs), or marked without one (not_seen, not_applicable).
export type CheckResult = 'confirmed' | 'differs' | 'not_seen' | 'not_applicable'
export type Check = {
  result: CheckResult
  at: string
  by: string
  // The observation that answers it; null for a mark.
  observation: { id: string; location: string | null } | null
}

export type Citation = { ref: string; quote: string; quoteFound: boolean }

export type Item = {
  id: string
  // A report section ("7") or "hazards" (the facility's priority risks).
  area: string
  subsection: string | null
  origin: 'template' | 'standard' | 'hazard' | 'hazard_list'
  hazard: string | null
  text: string
  COPE_dimension: string[]
  citations: Citation[]
  // 'uncited': no passage backs it.
  flags: string[]
  check: Check | null
}

// A passage a citation points to, keyed by the citation's `ref` in `Checklist.sources`.
export type Source = { text: string; doc_id?: string; headings?: string[]; page_start?: number; page_end?: number }

export type Standard = {
  id: string
  title: string
  issuingBody?: string | null
  standardNumber: string | null
  edition: string | null
  sourceType: string | null
}

export type Checklist = {
  id: string
  // The site's facility type and country when it was generated (CP-30 AC9).
  facilityType: string
  jurisdiction: string
  standards: Standard[]
  areas: { id: string; title: string }[]
  sources: Record<string, Source>
  items: Item[]
}

export type ChecklistBody = {
  scope: { facilityType: string; jurisdiction: string }
  // The standards that apply to the site now.
  standards: Standard[]
  // null before the first is generated.
  checklist: Checklist | null
}

const path = (reference: string) => `/api/assessments/${encodeURIComponent(reference)}/checklist`

export const getChecklist = (reference: string) => cached<ChecklistBody>(path(reference))

// A mark or a generate returns the checklist as it now is. It is kept as `cached` keeps a
// read (src/lib/api.ts: key `cache` + path), so offline reading shows this, not an older copy.
const keep = (reference: string) => (body: ChecklistBody) => {
  write(`cache${path(reference)}`, body)
  return body
}

// Marks an item Not seen or Not applicable, or clears the mark with null (CP-31 AC4).
// Returns the whole checklist as it now is. No observation is saved.
export const markItem = (reference: string, itemId: string, mark: 'not_seen' | 'not_applicable' | null) =>
  request<ChecklistBody>(`${path(reference)}/items/${encodeURIComponent(itemId)}/mark`, {
    method: 'PUT',
    body: JSON.stringify({ mark }),
  }).then(keep(reference))

// Generates a checklist from the standards left selected (CP-30 AC2) and saves it as the
// assessment's latest; the earlier ones are kept on the gateway. A paid AI call, and it
// takes a while. Returns the whole checklist as it now is.
export const generateChecklist = (reference: string, standardIds: string[]) =>
  request<ChecklistBody>(path(reference), {
    method: 'POST',
    body: JSON.stringify({ standardIds }),
  }).then(keep(reference))
