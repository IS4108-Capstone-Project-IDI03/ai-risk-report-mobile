// The words of one Inbox row on a phone (MB-22): the task, the line under it, its colour and its due
// date. Copied from the web's client/src/features/inbox/row.ts (its phoneTask, phoneDetail and
// phoneDetailTone). Only the engineer's rows are laid out; any other purpose shows its message.
// Called by components/InboxRow.
import type { Notification } from './api'

export type RowWords = { task: string; detail: string; tone: 'red' | 'grey'; due: string | null }

// A due date that can't be read counts as none (the web's dueOf).
const dueOf = (iso?: string) => (iso && !Number.isNaN(new Date(iso).getTime()) ? iso : null)

// "Review site walk: Pasir Gudang" has the site after the colon; the phone shows the task alone.
const beforeColon = (message: string) => message.split(': ')[0]

export function rowOf(n: Notification): RowWords {
  const c = n.context ?? {}
  switch (n.purpose) {
    case 'assessment_assigned':
    case 'site_walk_ready':
      return { task: beforeColon(n.message), detail: c.site ?? '', tone: 'grey', due: dueOf(c.reportDue) }
    case 'site_walk_failed':
      // A failure says why, in red, where a finished walk says which site.
      return { task: beforeColon(n.message), detail: "Couldn't read the recording", tone: 'red', due: dueOf(c.reportDue) }
    default:
      return { task: n.message, detail: n.details ?? '', tone: 'grey', due: null }
  }
}
