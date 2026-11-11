// Display helpers for the assessment list (MB-01 AC8). The type and labels
// match the gateway's AssessmentDto (server/src/services/assessment.service.ts)
// and the web app's STATUS_LABEL (client/.../useAssessmentWorkflow.tsx).
import type { BadgeProps } from '@/components/ui/badge'

export type AssessmentStatus =
  | 'not_started'
  | 'capturing'
  | 'ready_to_generate'
  | 'draft'
  | 'under_review'
  | 'finalised'
  | 'archived'

export type Assessment = {
  id: string
  reference: string
  client: string
  siteVisitDate: string | null // YYYY-MM-DD
  reportDueDate: string | null // YYYY-MM-DD (MB-04)
  status: AssessmentStatus
  // ISO time the current capture session started; null before any capture.
  captureStartedAt?: string | null
  // The site's own pin and its blocks' pins, shared by every visit to it (web CP-26).
  site: { id?: string; name: string; coordinates?: { lat: number; lng: number } | null; pins?: { name: string; lat: number; lng: number }[] }
}

// Label and badge tone for each status. Colour carries meaning only (design
// system): blue while capturing, amber while waiting on review, green when
// done or ready, grey otherwise.
export const STATUS: Record<AssessmentStatus, { label: string; tone: BadgeProps['variant'] }> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  capturing: { label: 'Capturing', tone: 'info' },
  ready_to_generate: { label: 'Ready to generate', tone: 'success' },
  draft: { label: 'Draft', tone: 'neutral' },
  under_review: { label: 'Under review', tone: 'warning' },
  finalised: { label: 'Finalised', tone: 'success' },
  archived: { label: 'Archived', tone: 'neutral' },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2026-04-11" → "11 Apr 2026". Split by hand, not through Date, which would
// read it as UTC midnight and could show the day before in some time zones.
export function formatDate(isoDay: string | null) {
  if (!isoDay) return 'No visit date'
  const [year, month, day] = isoDay.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}
