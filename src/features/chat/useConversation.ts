// One chat conversation (MB-06 AC2, AC7-AC10): its turns, and asking, stopping
// and retrying. MB-14: the chat is saved on the gateway from the first question, and
// the last one reopens when the app does (its id is kept in the engineer's own folder).
// Used by screens/Chat.
import * as Crypto from 'expo-crypto'
import { useEffect, useRef, useState } from 'react'
import { ApiError, NetworkError } from '@/lib/api'
import { read, remove, write } from '@/lib/store'
import { mediaUri } from '@/features/observations/format'
import { ask, createThread, getThread, type Message, type SavedMessage, type Sent } from './api'
import { readEvents, receive, type Received } from './events'
import { shownUri, type Taken } from './useAttachments'

export type AnswerStatus = 'streaming' | 'done' | 'stopped' | 'error'
// `mid` is the message's id on the gateway (an answer's is `received.id`).
// A question also holds what was sent with it (MB-24): its photos and PDFs, to draw above the words.
export type Turn =
  | { id: number; role: 'user'; text: string; mid: string; photos?: { uri: string }[]; pdfs?: { id: string; name: string; flagged: boolean }[] }
  | { id: number; role: 'assistant'; received: Received; status: AnswerStatus; error?: string }

const fresh: Received = { search: null, program: '' }

// What the gateway is sent (AC8): each question as typed, each answer as its
// program text, each with its id (MB-14). A failed answer has nothing to send.
const toMessages = (turns: Turn[]): Message[] =>
  turns.flatMap((t): Message[] =>
    t.role === 'user'
      ? [{ id: t.mid, role: 'user', content: t.text }]
      : t.received.program && t.status !== 'error'
        ? [{ id: t.received.id, role: 'assistant', content: t.received.program }]
        : [],
  )

// The key in the engineer's folder (src/lib/store.ts) holding the last chat's id.
const LAST = 'lastChat'

// A saved chat as turns: an answer shows its text, without the "searched for" step, which the
// gateway does not keep.
const fromSaved = (messages: SavedMessage[]): Turn[] =>
  messages.map((m, i): Turn =>
    m.role === 'user'
      ? {
          id: i + 1,
          role: 'user',
          text: m.content,
          mid: m.id,
          ...(m.attachments?.length && { photos: m.attachments.map((a) => ({ uri: mediaUri(a.url) })) }),
          ...(m.pdfs?.length && { pdfs: m.pdfs }),
        }
      : { id: i + 1, role: 'assistant', received: { search: null, program: m.content, id: m.id }, status: 'done' },
  )

export function useConversation() {
  const [turns, setTurns] = useState<Turn[]>([])
  const nextId = useRef(1)
  // The saved chat these turns belong to; none until the first question is asked.
  const threadId = useRef<string | null>(null)
  // The same id as state, so the Chats list can mark the open chat (MB-14).
  const [openId, setOpenId] = useState<string | null>(null)
  const setThread = (id: string | null) => {
    threadId.current = id
    setOpenId(id)
  }
  // The answer being written, so Stop can end it.
  const live = useRef<{ controller: AbortController; reader?: ReadableStreamDefaultReader<Uint8Array>; stopped: boolean } | null>(null)
  const last = turns[turns.length - 1]
  const busy = last?.role === 'assistant' && last.status === 'streaming'

  // Opens the last chat, if there is one (MB-14 AC2). Not once a question was already asked:
  // that chat is the one on screen. A chat deleted elsewhere (404) is forgotten; any other
  // failure leaves the starters, and the id is kept to try again next time.
  useEffect(() => {
    const id = read<string>(LAST)
    if (!id) return
    let live = true
    getThread(id).then(
      ({ messages }) => {
        if (!live || threadId.current) return
        const restored = fromSaved(messages)
        setThread(id)
        nextId.current = restored.length + 1
        setTurns((now) => (now.length ? now : restored))
      },
      (e) => {
        if (e instanceof ApiError && e.status === 404) remove(LAST)
      },
    )
    return () => {
      live = false
    }
  }, [])

  const update = (id: number, change: (t: Extract<Turn, { role: 'assistant' }>) => Partial<Turn>) =>
    setTurns((all) => all.map((t) => (t.id === id && t.role === 'assistant' ? ({ ...t, ...change(t) } as Turn) : t)))

  // a. Ask with the conversation so far. b. Fold in each event as it arrives.
  // c. Settle: done, stopped (keeping what was written, AC9), or failed (AC10).
  async function run(history: Turn[], answerId: number, sent: Sent = {}) {
    // Kept here, not read from `live` later: React runs the updates below after
    // `finally` has cleared `live`, which would mark a stopped answer done.
    const mine = { controller: new AbortController(), stopped: false } as NonNullable<typeof live.current>
    live.current = mine
    try {
      // The chat is saved on its first question, named from it (AC1).
      if (!threadId.current) {
        const first = history.find((t) => t.role === 'user')
        const made = (await createThread(first?.role === 'user' ? first.text : '')).id
        setThread(made)
        write(LAST, made)
      }
      mine.reader = await ask(toMessages(history), threadId.current!, mine.controller.signal, sent)
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

  function send(text: string, taken?: Taken) {
    const question = text.trim()
    if (busy || !question) return
    const user: Turn = {
      id: nextId.current++,
      role: 'user',
      text: question,
      mid: Crypto.randomUUID(),
      ...(taken?.photos.length && { photos: taken.photos.map((p) => ({ uri: shownUri(p) })) }),
      ...(taken?.pdfs.length && { pdfs: taken.pdfs.map(({ id, name, flagged }) => ({ id, name, flagged })) }),
    }
    const answer: Turn = { id: nextId.current++, role: 'assistant', received: fresh, status: 'streaming' }
    const history = [...turns, user]
    setTurns([...history, answer])
    run(history, answer.id, taken?.sent)
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
    setThread(null)
    setTurns([])
  }

  // Opens a saved chat from the Chats list (AC5): stops any answer, shows its messages, and
  // makes it the last chat. A failure leaves what was on screen and says why.
  async function open(id: string) {
    const { messages } = await getThread(id)
    stop()
    const restored = fromSaved(messages)
    setThread(id)
    nextId.current = restored.length + 1
    setTurns(restored)
    write(LAST, id)
  }

  // A chat deleted from the list: if it is the one on screen, start over, and forget it.
  function forget(id: string) {
    if (threadId.current !== id) return
    reset()
    remove(LAST)
  }

  // The PDFs this chat holds, from the questions asked in it: the attach menu stops at the gateway's limit.
  const pdfsHeld = new Set(turns.flatMap((t) => (t.role === 'user' ? (t.pdfs ?? []).map((f) => f.id) : []))).size

  return { turns, busy, openId, pdfsHeld, send, stop, retry, reset, open, forget }
}
