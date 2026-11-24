// MarshBot's conversation for one assessment (MB-20, web AS-06). Called by useThread.ts. Calls the web repo's
// server/src/routes/assistant.routes.ts. GET records an "open" and can start paid AI steps (the coverage check and
// the rewording of new bot turns), so the phone calls it only when the chat screen opens, never from the workspace.
import { cached, request } from '@/lib/api'
import type { Thread } from './types'

const base = (reference: string) => `/api/assessments/${encodeURIComponent(reference)}/assistant`

export const getThread = (reference: string) => cached<Thread>(base(reference))

// One reply. `date` (YYYY-MM-DD) is for "Another visit"; `lastTurnId` tells the gateway which turn the engineer
// saw, so a reply to an older turn is refused (409 reply-not-asked) instead of moving the stage twice.
export const postReply = (reference: string, body: { replyId: string; date?: string; lastTurnId?: string }) =>
  request<Thread>(`${base(reference)}/replies`, { method: 'POST', body: JSON.stringify(body) })
