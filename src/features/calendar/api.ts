// Reschedule (MB-19, web CP-60): saves an assessment's three dates. Called by
// components/RescheduleSheet. Calls PUT /api/assessments/:reference, the web's Edit
// details route (server/src/routes/assessment.routes.ts): only the assigned engineer
// (403), not once archived (409), 400 `fields` for a bad date.
import { request } from '@/lib/api'

export type Dates = { start: string; end: string; due: string }

// The type is sent unchanged (the route needs it); a date left '' is cleared.
export const reschedule = (reference: string, type: string, dates: Dates) =>
  request<void>(`/api/assessments/${encodeURIComponent(reference)}`, {
    method: 'PUT',
    body: JSON.stringify({
      surveyType: type,
      siteVisitDate: dates.start,
      // A survey of one day has no last day of its own.
      siteVisitEndDate: dates.end === dates.start ? '' : dates.end,
      reportDueDate: dates.due,
    }),
  })
