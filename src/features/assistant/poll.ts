// How often the chat reads again while MarshBot is writing, and for how long (MB-20). A module of its own so a test
// can shorten it (as transcriptPoll does for MB-12). Used by useThread.ts.
export const POLL_MS = 5000
export const POLL_LIMIT = 24 // 24 x 5 s = 2 minutes
