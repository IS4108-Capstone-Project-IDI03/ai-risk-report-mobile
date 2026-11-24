// The gateway calls behind the Inbox (MB-22, web F-10). Called by useInbox.ts and useInboxCount.ts.
// Calls the web repo's server/src/routes/notification.routes.ts (the list and the four per-row calls)
// and notification-count.routes.ts (the count). Every call is for the signed-in engineer alone: ticking
// or removing a row never changes anyone else's list. The shapes match NotificationDto in
// server/src/services/notification.service.ts.
import { cached, request } from '@/lib/api'

export type Tab = 'todo' | 'done'

// One notification as the gateway sends it. `context` is a string map; for an assigned assessment it
// holds reference, client, site, sender and reportDue, for a walk row reference, walkId and site.
export type Notification = {
  id: string
  purpose: string
  kind: 'bell' | 'inbox'
  message: string
  details: string | null
  context: Record<string, string> | null
  read: boolean
  // Done for this engineer: they opened it or ticked it.
  done: boolean
  createdAt: string
}

// `total` is every row in the tab (to decide on Load more); `inboxTodo` is the To do count whatever the tab.
export type Page = { items: Notification[]; total: number; inboxTodo: number }

// The web's PAGE_SIZE (client/src/features/inbox/api.ts). The gateway caps a page at 50.
export const PAGE_SIZE = 20

const listPath = (tab: Tab, offset: number) => `/api/notifications?kind=inbox&tab=${tab}&limit=${PAGE_SIZE}&offset=${offset}`

/** Returns a tab's first page, kept on the phone: with no signal, the last copy (like Home). */
export const firstPage = (tab: Tab) => cached<Page>(listPath(tab, 0))

/** Returns the next page of a tab (needs signal). */
export const nextPage = (tab: Tab, offset: number) => request<Page>(listPath(tab, offset))

/** Returns the To do count. The gateway serves it without refreshing the session, so polling never keeps an idle session alive. */
export const todoCount = () => request<{ inboxTodo: number }>('/api/notifications/count').then((c) => c.inboxTodo)

// Each answers 204 with no body.
const call = (id: string, suffix: string, method: string) => request<void>(`/api/notifications/${encodeURIComponent(id)}${suffix}`, { method })
export const openItem = (id: string) => call(id, '/read', 'PATCH')
export const tickItem = (id: string) => call(id, '/done', 'POST')
export const untickItem = (id: string) => call(id, '/done', 'DELETE')
export const binItem = (id: string) => call(id, '/dismiss', 'POST')
