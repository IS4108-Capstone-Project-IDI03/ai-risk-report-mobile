// Loads MarshBot's conversation for the chat screen and sends replies (MB-20). Reads once on opening (the gateway
// records an "open" and can start paid AI steps, so no reading on every focus); while MarshBot is thinking it reads
// again every 5 seconds for about 2 minutes, then says to check back. Called by screens/Assistant. Calls api.ts.
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, errorText, NetworkError } from '@/lib/api'
import { getThread, postReply } from './api'
import { POLL_LIMIT, POLL_MS } from './poll'
import type { Reply, Thread } from './types'

export type Problem = { kind: 'archived' | 'not-mine' | 'failed'; text: string }

export function useThread(reference: string) {
  const [thread, setThread] = useState<Thread | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  // How many extra reads were made while MarshBot was writing; at the limit the chat stops reading.
  const [polls, setPolls] = useState(0)
  // Two quick taps in one frame both see sending=false; the ref stops the second one.
  const busy = useRef(false)
  // The newest read wins, so a slow earlier one can't bring back an old conversation.
  const latest = useRef(0)

  const load = useCallback(async () => {
    const mine = ++latest.current
    try {
      const next = await getThread(reference)
      if (mine !== latest.current) return
      setThread(next)
      setProblem(null)
      if (!next.thinking) setPolls(0)
    } catch (e) {
      if (mine !== latest.current) return
      setThread(null)
      if (e instanceof ApiError && e.status === 403) setProblem({ kind: 'not-mine', text: e.message })
      else if (e instanceof ApiError && e.status === 409) setProblem({ kind: 'archived', text: 'This assessment is archived.' })
      else if (e instanceof NetworkError) setProblem({ kind: 'failed', text: "Can't reach MarshBot. Connect, then open this screen again." })
      else setProblem({ kind: 'failed', text: errorText(e) })
    } finally {
      if (mine === latest.current) setLoading(false)
    }
  }, [reference])

  // Once, on opening (not on every focus: coming back from a linked screen must not record another "open").
  const opened = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (opened.current) return
      opened.current = true
      load()
    }, [load]),
  )

  // While MarshBot is writing, read again after each pause, up to the limit.
  const stalled = !!thread?.thinking && polls >= POLL_LIMIT
  useEffect(() => {
    if (!thread?.thinking || polls >= POLL_LIMIT) return
    const timer = setTimeout(() => {
      setPolls((n) => n + 1)
      load()
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [thread, polls, load])

  // Sends one reply; true when it was accepted (the screen then follows the reply's link).
  async function reply(r: Reply, date?: string): Promise<boolean> {
    if (busy.current || !thread) return false
    busy.current = true
    setSending(true)
    setReplyError(null)
    const lastTurnId = thread.session.turns.at(-1)?.id
    try {
      setThread(await postReply(reference, { replyId: r.id, ...(date && { date }), ...(lastTurnId && { lastTurnId }) }))
      return true
    } catch (e) {
      // 409: already answered (or archived): read again quietly, the new thread or the archived notice says which.
      if (e instanceof ApiError && e.status === 409) await load()
      else setReplyError(errorText(e))
      return false
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  return { thread, problem, loading, sending, replyError, stalled, reply, reload: load }
}
