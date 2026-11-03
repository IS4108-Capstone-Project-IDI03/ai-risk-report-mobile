// Search and filters for Home (MB-04, mirrors RV-10). The date rules are
// copied from the web client's useAssessmentWorkflow.tsx (isOverdue,
// withinWeek, inProgress, DATE_FILTERS, dueCountdown), so both apps count the
// same assessments as overdue. Keep the two in step.
import type { Assessment, AssessmentStatus } from './format'

export type DateFilter = 'overdue' | 'due-soon' | 'visit-soon'
export type Filters = { search: string; status: AssessmentStatus | null; date: DateFilter | null }
export const noFilters: Filters = { search: '', status: null, date: null }

// Today as a local calendar day, YYYY-MM-DD, so it compares with the gateway's
// dates as text. Built by hand: toLocaleDateString's format depends on the
// phone's locale data, and a different one would get Overdue wrong.
function today() {
  const d = new Date()
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
}

// Local calendar days from today to an ISO day: 0 today, negative once past.
// Counted between local midnights, so a daylight-saving change can't shift it.
function daysFromToday(isoDay: string) {
  const [y, m, d] = isoDay.split('-').map(Number)
  const [ty, tm, td] = today().split('-').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86_400_000)
}

// From today to seven days from today, both included.
function withinWeek(isoDay: string | null) {
  if (!isoDay) return false
  const days = daysFromToday(isoDay)
  return days >= 0 && days <= 7
}

// Past its report due date and not finalised. Due today is not overdue.
const isOverdue = (a: Assessment) =>
  Boolean(a.reportDueDate) && a.reportDueDate! < today() && a.status !== 'finalised'

// The date chips count, and filter to, assessments still in progress.
const inProgress = (a: Assessment) => a.status !== 'finalised' && a.status !== 'archived'

export const DATE_FILTERS: Record<DateFilter, (a: Assessment) => boolean> = {
  overdue: (a) => inProgress(a) && isOverdue(a),
  'due-soon': (a) => inProgress(a) && withinWeek(a.reportDueDate),
  'visit-soon': (a) => inProgress(a) && withinWeek(a.siteVisitDate),
}

// Matches every filter set: text in the site, client or report ID (any case),
// the chosen status, and the chosen date chip.
export function matches(a: Assessment, f: Filters) {
  const text = f.search.trim().toLowerCase()
  return (
    (!text || [a.site.name, a.client, a.reference].some((s) => s.toLowerCase().includes(text))) &&
    (!f.status || a.status === f.status) &&
    (!f.date || DATE_FILTERS[f.date](a))
  )
}

// A card's due note: Overdue, or a countdown that's "soon" within 3 days.
// None once finalised, or with no due date.
export function dueNote(a: Assessment): { text: string; tone: 'overdue' | 'soon' | 'later' } | null {
  if (!a.reportDueDate || !inProgress(a)) return null
  if (isOverdue(a)) return { text: 'Overdue', tone: 'overdue' }
  const days = daysFromToday(a.reportDueDate)
  const text = days === 0 ? 'Due today' : `Due in ${days} ${days === 1 ? 'day' : 'days'}`
  return { text, tone: days <= 3 ? 'soon' : 'later' }
}
