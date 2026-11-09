// How long the detail waits for a retried transcript (MB-12 AC29): it reads the
// observation again every 5 seconds, 24 times (about 2 minutes), then stops.
// Kept apart so the test can shorten it. Used by screens/ObservationDetail.
export const POLL_MS = 5000
export const POLL_LIMIT = 24
