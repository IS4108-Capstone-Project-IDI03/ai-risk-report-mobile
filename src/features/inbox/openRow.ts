// Where a pressed Inbox row goes (MB-22), the phone's copy of the web's notifications/openSubject.ts.
// Called by useInbox.ts, which moves the row to Done and then pushes this. A row the phone has no page for
// (or one missing the reference it needs) opens nothing.
import type { Href } from 'expo-router'
import type { Notification } from './api'

export function whereTo(n: Notification): Href | null {
  const { reference, walkId } = n.context ?? {}
  if (!reference) return null
  switch (n.purpose) {
    // An assigned assessment: its workspace.
    case 'assessment_assigned':
      return { pathname: '/assessment/[reference]', params: { reference } }
    // A walk that is ready: its review.
    case 'site_walk_ready':
      return walkId ? { pathname: '/assessment/[reference]/site-walk-review', params: { reference, walkId } } : null
    // A walk that failed: the Site walks list, where Try again is.
    case 'site_walk_failed':
      return { pathname: '/assessment/[reference]/site-walks', params: { reference } }
    default:
      return null
  }
}
