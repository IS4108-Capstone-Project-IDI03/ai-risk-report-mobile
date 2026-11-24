// The gateway's chat routes (MB-06): asking (a stream), one cited passage, and
// the knowledge documents for citation names. MB-14: saved chats. Shapes match the web
// repo's server/src/routes/chat.routes.ts and client/src/features/chat/.
import { File } from 'expo-file-system'
import { cached, request, stream } from '@/lib/api'

// `id` is how the gateway links a question under the message before it (chat-save.service.ts
// `lastQuestion`): without ids, every follow-up would be saved as a new root.
export type Message = { id?: string; role: 'user' | 'assistant'; content: string }

// What goes with the last question (MB-24): the ids of its photos (`attachments`, up to 3) and of the
// PDFs of this chat (`pdfs`), as the gateway's POST /api/chat reads them. Left out when there are none.
export type Sent = { attachments?: string[]; pdfs?: string[] }

// Asks the last question with the conversation so far, inside a saved chat. Each answer is a
// paid model call on the gateway. Returns a reader for the event stream.
export async function ask(messages: Message[], threadId: string, signal: AbortSignal, sent: Sent = {}) {
  const response = await stream('/api/chat', { method: 'POST', body: JSON.stringify({ messages, threadId, ...sent }), signal })
  return response.body!.getReader()
}

// A photo or a PDF for a question (MB-24, web CB-08 and CB-09): the gateway takes the file itself as the
// request body (not a form), checks it at once and answers with an id to send with the question.
// Photo: `faces` found, and `blurredId`, the copy with them blurred (null when there are none).
export type PhotoUpload = { id: string; faces: number; blurredId: string | null }
export type PdfUpload = { id: string; name: string; pages: number; flagged: boolean }

export async function uploadPhoto(uri: string) {
  const type = /\.png$/i.test(uri) ? 'image/png' : 'image/jpeg'
  return request<PhotoUpload>('/api/chat/photos', { method: 'POST', headers: { 'Content-Type': type }, body: await new File(uri).bytes() })
}
export const removePhoto = (id: string) => request<void>(`/api/chat/photos/${encodeURIComponent(id)}`, { method: 'DELETE' })

// The name travels in a header, URL-encoded (the gateway decodes it).
export async function uploadPdf(uri: string, name: string) {
  return request<PdfUpload>('/api/chat/pdfs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(name) },
    body: await new File(uri).bytes(),
  })
}
// A spoken question as text (MB-25, web CB-10): the clip is the request body. The gateway says why when it
// cannot (no speech, too long, speech service down). The text goes into the box, never straight to the chat.
export async function transcribe(uri: string) {
  const { text } = await request<{ text: string }>('/api/chat/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/m4a' }, body: await new File(uri).bytes() })
  return text
}

export const removePdf = (id: string) => request<void>(`/api/chat/pdfs/${encodeURIComponent(id)}`, { method: 'DELETE' })

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

// A question's photos (`url` is a gateway path, shown behind the session cookie) and PDFs (MB-24).
export type SavedMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: { id: string; url: string }[]
  pdfs?: { id: string; name: string; flagged: boolean }[]
}

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

// "My preferences" (MB-15; the web's CB-05): the engineer's lasting facts for the assistant and the
// memory switch. Shapes match server/src/services/chat-memory.service.ts.
export type Fact = { id: string; text: string; createdAt: string }
export type Memory = { enabled: boolean; facts: Fact[]; maxFacts: number; maxChars: number }

const MEMORY = '/api/chat/memory'
// Kept on the phone, so the list opens with no signal (read-only).
export const getMemory = () => cached<Memory>(MEMORY)
export const setMemoryEnabled = (enabled: boolean) => request<Memory>(MEMORY, { method: 'PATCH', body: JSON.stringify({ enabled }) })
export const addFact = (text: string) => request<Fact>(`${MEMORY}/facts`, { method: 'POST', body: JSON.stringify({ text }) })
export const saveFact = (id: string, text: string) =>
  request<Fact>(`${MEMORY}/facts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ text }) })
export const removeFact = (id: string) => request<void>(`${MEMORY}/facts/${encodeURIComponent(id)}`, { method: 'DELETE' })
// The key `cached()` reads, so a change made now is what the offline copy shows next time.
export const MEMORY_CACHE_KEY = `cache${MEMORY}`
