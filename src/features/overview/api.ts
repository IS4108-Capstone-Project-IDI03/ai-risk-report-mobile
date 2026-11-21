// The next step and gaps of one assessment (MB-20, web AS-06): the gateway's read-only
// summary. It is not GET .../assistant, which records an open and can start paid AI calls;
// this route writes nothing. Called by useSummary.ts. Calls the route in the web repo's
// server/src/routes/assistant.routes.ts; the shapes must match
// server/src/services/assistant/summary.ts.
import { cached } from '@/lib/api'

// Where a gateway item points: a workspace tab of the web, with optional query values.
export type ItemLink = {
  tab: 'overview' | 'checklist' | 'observations' | 'generate' | 'review' | 'export'
  params?: Record<string, string>
}

export type SummaryItem = {
  id: string
  weight: 'fix_now' | 'gap' | 'reminder'
  // A lucide icon name (icons.ts maps the ones the gateway uses).
  icon: string
  title: string
  detail: string | null
  link: ItemLink | null
}

export type Summary = {
  reference: string
  stage: string
  stageLabel: string
  // 0 (Setup) to 7 (Exported).
  stageIndex: number
  // Exactly three: label, value and a tone for the tile.
  glance: { icon: string; label: string; value: string; tone: 'normal' | 'amber' | 'red' | 'green' }[]
  next: { text: string; link: ItemLink | null; label: string | null }
  items: SummaryItem[]
  areas: { area: string; covered: number; total: number; link: ItemLink }[]
  updatedAt: string
}

export const getSummary = (reference: string) =>
  cached<Summary>(`/api/assessments/${encodeURIComponent(reference)}/assistant/summary`)
