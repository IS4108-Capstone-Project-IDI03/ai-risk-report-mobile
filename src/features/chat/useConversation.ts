// One chat conversation (MB-06 AC2, AC7-AC10): its turns, and asking, stopping
// and retrying. Kept in memory, so it lasts while the app is open (saved
// conversations, CB-03, are out of scope). Used by screens/Chat.
import { useRef, useState } from 'react'
import { ApiError, NetworkError } from '@/lib/api'
import { ask, type Message } from './api'
import { readEvents, receive, type Received } from './events'

export type AnswerStatus = 'streaming' | 'done' | 'stopped' | 'error'
export type Turn =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; received: Received; status: AnswerStatus; error?: string }

const fresh: Received = { search: null, program: '' }

// What the gateway is sent (AC8): each question as typed, each answer as its
// program text. A failed answer has nothing to send.
const toMessages = (turns: Turn[]): Message[] =>
  turns.flatMap((t): Message[] =>
    t.role === 'user'
      ? [{ role: 'user', content: t.text }]
      : t.received.program && t.status !== 'error'
        ? [{ role: 'assistant', content: t.received.program }]
        : [],
  )

export function useConversation() {
  const [turns, setTurns] = useState<Turn[]>([])
  const nextId = useRef(1)
  // The answer being written, so Stop can end it.
  const live = useRef<{ controller: AbortController; reader?: ReadableStreamDefaultReader<Uint8Array>; stopped: boolean } | null>(null)
  const last = turns[turns.length - 1]
  const busy = last?.role === 'assistant' && last.status === 'streaming'

  const update = (id: number, change: (t: Extract<Turn, { role: 'assistant' }>) => Partial<Turn>) =>
    setTurns((all) => all.map((t) => (t.id === id && t.role === 'assistant' ? ({ ...t, ...change(t) } as Turn) : t)))

  // a. Ask with the conversation so far. b. Fold in each event as it arrives.
  // c. Settle: done, stopped (keeping what was written, AC9), or failed (AC10).
  async function run(history: Turn[], answerId: number) {
    // Kept here, not read from `live` later: React runs the updates below after
    // `finally` has cleared `live`, which would mark a stopped answer done.
    const mine = { controller: new AbortController(), stopped: false } as NonNullable<typeof live.current>
    live.current = mine
    try {
      mine.reader = await ask(toMessages(history), mine.controller.signal)
      await readEvents(mine.reader, (e) => update(answerId, (t) => ({ received: receive(t.received, e) })))
      const status = mine.stopped ? 'stopped' : 'done'
      update(answerId, () => ({ status }))
    } catch (e) {
      // A connection lost mid-answer surfaces as the phone's own wording; say it
      // as the rest of the app does. A gateway refusal keeps its own words.
      const error = e instanceof ApiError || e instanceof NetworkError ? e.message : new NetworkError().message
      const stopped = mine.stopped
      update(answerId, () => (stopped ? { status: 'stopped' } : { status: 'error', error }))
    } finally {
      live.current = null
    }
  }

  function send(text: string) {
    const question = text.trim()
    if (busy || !question) return
    const user: Turn = { id: nextId.current++, role: 'user', text: question }
    const answer: Turn = { id: nextId.current++, role: 'assistant', received: fresh, status: 'streaming' }
    const history = [...turns, user]
    setTurns([...history, answer])
    run(history, answer.id)
  }

  // Cancelling the reader ends the read at once, even if the network is slow
  // to notice the abort; the abort tells the gateway to stop writing.
  function stop() {
    if (!live.current) return
    live.current.stopped = true
    live.current.controller.abort()
    live.current.reader?.cancel().catch(() => {})
  }

  // Asks the failed question again, in place of the failed answer.
  function retry() {
    if (busy || last?.role !== 'assistant' || last.status !== 'error') return
    const history = turns.slice(0, -1)
    setTurns([...history, { ...last, received: fresh, status: 'streaming', error: undefined }])
    run(history, last.id)
  }

  // Starts over (back to the starter questions), stopping any answer first.
  function reset() {
    stop()
    setTurns([])
  }

  return { turns, busy, send, stop, retry, reset }
}
