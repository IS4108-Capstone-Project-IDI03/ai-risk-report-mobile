// The gateway's chat routes (MB-06): asking (a stream), one cited passage, and
// the knowledge documents for citation names. Shapes match the web repo's
// server/src/routes/chat.routes.ts and client/src/features/chat/.
import { request, stream } from '@/lib/api'

export type Message = { role: 'user' | 'assistant'; content: string }

// Asks the last question with the conversation so far. Each answer is a paid
// model call on the gateway. Returns a reader for the event stream.
export async function ask(messages: Message[], signal: AbortSignal) {
  const response = await stream('/api/chat', { method: 'POST', body: JSON.stringify({ messages }), signal })
  return response.body!.getReader()
}

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
