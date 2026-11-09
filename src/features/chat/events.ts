// Reads the chat's event stream (MB-06 AC2, AC6). POST /api/chat answers as
// server-sent events: `data: {json}` then a blank line. Event names are AG-UI's,
// as the RAG service writes them (microservices/rag-service/app/chat/answer.py).

// The filters a search used (rag-service answer.py), named on screen by SearchLine.
export type SearchFilters = { jurisdiction?: string; facility_type?: string; source_type?: string; document?: string }

export type Search = {
  status: 'searching' | 'done'
  query?: string
  also?: string[] // further searches the planner added
  filters?: SearchFilters
  passages?: number
  declined?: boolean
}

// What an answer has received so far: its search step and its program text.
// `id` is the stream's message id, which the next question's request must carry (MB-14).
export type Received = { search: Search | null; program: string; id?: string }

type ChatEvent = { type: string; delta?: string; content?: string; messageId?: string }

// Folds one event into what's been received. Others (TEXT_MESSAGE_END,
// TOOL_CALL_END, the CUSTOM bookkeeping event) change nothing on screen.
export function receive(r: Received, e: ChatEvent): Received {
  switch (e.type) {
    case 'TOOL_CALL_START':
      return { ...r, search: { status: 'searching' } }
    case 'TOOL_CALL_ARGS': {
      const args = parse<{ query?: string; also?: string[] }>(e.delta)
      return { ...r, search: { status: 'searching', ...r.search, query: args?.query, also: args?.also } }
    }
    case 'TOOL_CALL_RESULT': {
      const result = parse<{ filters?: SearchFilters; passages?: number; declined?: boolean }>(e.content)
      return {
        ...r,
        search: { ...r.search, status: 'done', filters: result?.filters, passages: result?.passages, declined: result?.declined },
      }
    }
    case 'TEXT_MESSAGE_START':
      return { ...r, id: e.messageId ?? r.id }
    case 'TEXT_MESSAGE_CONTENT':
      return { ...r, program: r.program + (e.delta ?? '') }
    default:
      return r
  }
}

function parse<T>(json?: string): T | null {
  try {
    return json ? (JSON.parse(json) as T) : null
  } catch {
    return null
  }
}

// Reads a stream to its end, calling onEvent for each event as it arrives.
// Events can be split across chunks, so text is buffered until a blank line.
export async function readEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (e: ChatEvent) => void,
) {
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      const event = parse<ChatEvent>(data)
      if (event) onEvent(event)
    }
  }
}
