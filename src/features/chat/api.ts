// The gateway's chat routes (MB-06): asking (a stream), one cited passage, and
// the knowledge documents for citation names. MB-14: saved chats. Shapes match the web
// repo's server/src/routes/chat.routes.ts and client/src/features/chat/.
import { cached, request, stream } from '@/lib/api'

// `id` is how the gateway links a question under the message before it (chat-save.service.ts
// `lastQuestion`): without ids, every follow-up would be saved as a new root.
export type Message = { id?: string; role: 'user' | 'assistant'; content: string }

// Asks the last question with the conversation so far, inside a saved chat. Each answer is a
// paid model call on the gateway. Returns a reader for the event stream.
export async function ask(messages: Message[], threadId: string, signal: AbortSignal) {
  const response = await stream('/api/chat', { method: 'POST', body: JSON.stringify({ messages, threadId }), signal })
  return response.body!.getReader()
}

export type Thread = { id: string; title: string; createdAt: string }

// Starts a saved chat from the first question; the gateway names it from the first 60
// characters, with no AI call (MB-14 AC1).
export const createThread = (content: string) =>
  request<Thread>('/api/chat/conversations', { method: 'POST', body: JSON.stringify({ message: { content } }) })

// My chats, newest updated first; `q` keeps those whose name or any message has the text
// (MB-14 AC3, AC4). The plain list is kept on the phone for offline (AC9).
export const listThreads = (q = '') =>
  q.trim()
    ? request<{ threads: Thread[] }>(`/api/chat/conversations?q=${encodeURIComponent(q.trim())}`)
    : cached<{ threads: Thread[] }>('/api/chat/conversations')

export const renameThread = (id: string, title: string) =>
  request<Thread>(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ title }) })

export const deleteThread = (id: string) =>
  request<void>(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })

export type SavedMessage = { id: string; role: 'user' | 'assistant'; content: string }

// One saved chat's messages, in order. Kept on the phone, so it opens offline (MB-14 AC9).
export const getThread = (id: string) =>
  cached<{ messages: SavedMessage[] }>(`/api/chat/conversations/${encodeURIComponent(id)}`)

export type Passage = {
  id: string
  documentId: string
  text: string
  headings: string[]
  pageStart: number | null
  pageEnd: number | null
}

export const getPassage = (id: string) => request<Passage>(`/api/chat/passages/${encodeURIComponent(id)}`)

type KnowledgeDocument = {
  id: string
  title: string
  issuingBody: string | null
  standardNumber: string | null
  edition: string | null
  sourceType: string | null
}

// Each document's name as citations show it, by id: a past report by its title,
// a standard by issuer and number ("NFPA 13"), with its edition (the web's
// documents.ts does the same).
export async function documentNames(): Promise<Map<string, string>> {
  const docs = await request<KnowledgeDocument[]>('/api/knowledge-documents/ingested')
  return new Map(
    docs.map((d) => {
      const standard = `${d.issuingBody ?? ''} ${d.standardNumber ?? ''}`.trim()
      const name = d.sourceType === 'marsh_report' ? d.title : standard || d.title
      return [d.id, d.edition ? `${name} (${d.edition})` : name]
    }),
  )
}
