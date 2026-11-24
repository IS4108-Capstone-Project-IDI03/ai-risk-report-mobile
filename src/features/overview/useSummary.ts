// Loads an assessment's summary for the Overview bar and sheet (MB-20). On open, on coming back to the
// screen and on a pull to refresh (the workspace calls reload); the newest load wins, so a slow
// earlier one can't bring back old gaps. Called by screens/Workspace. Calls api.ts.
import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ApiError, NetworkError } from '@/lib/api'
import { getSummary, type Summary } from './api'

export type SummaryState = {
  summary: Summary | null
  // Why there is none: archived (409, the gateway's words), not mine (403: draw nothing), or a failure.
  problem: { kind: 'archived' | 'not-mine' | 'failed'; text: string } | null
  reload(): Promise<void>
}

export function useSummary(reference: string): SummaryState {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [problem, setProblem] = useState<SummaryState['problem']>(null)
  const latest = useRef(0)
  const reload = useCallback(async () => {
    const mine = ++latest.current
    try {
      const next = await getSummary(reference)
      if (mine !== latest.current) return
      setSummary(next)
      setProblem(null)
    } catch (e) {
      if (mine !== latest.current) return
      setSummary(null)
      if (e instanceof ApiError && e.status === 403) setProblem({ kind: 'not-mine', text: e.message })
      else if (e instanceof ApiError && e.status === 409) setProblem({ kind: 'archived', text: 'This assessment is archived.' })
      else if (e instanceof NetworkError)
        setProblem({ kind: 'failed', text: "Can't show the next step. Connect, then pull down to try again." })
      else setProblem({ kind: 'failed', text: e instanceof Error ? e.message : String(e) })
    }
  }, [reference])
  // On open, and again on coming back (a capture or a checklist answer changes the gaps).
  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )
  return { summary, problem, reload }
}
