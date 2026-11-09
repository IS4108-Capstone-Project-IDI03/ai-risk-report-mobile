// The assessment's checklist, read and kept up to date (MB-05). Used by the workspace
// (for the switch's progress) and passed to ChecklistView, so the checklist is read once.
// Reads again on coming back into view (e.g. after an observation was deleted, which
// unchecks its item) and after the offline queue uploads something.
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useOffline } from '@/features/offline/provider'
import { getChecklist, type ChecklistBody } from './api'

export function useChecklist(reference: string) {
  // undefined while loading.
  const [body, setBody] = useState<ChecklistBody | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const { uploads } = useOffline()

  // The newest result wins: a slower read that started before a mark or a generate came
  // back must not put the older checklist over it.
  const newest = useRef(0)
  const load = useCallback(() => {
    const mine = ++newest.current
    return getChecklist(reference).then(
      (b) => {
        if (mine !== newest.current) return
        setBody(b)
        setError(null)
      },
      (e: Error) => mine === newest.current && setError(e.message),
    )
  }, [reference])
  // What a mark or a generate returned, which is the checklist as it now is.
  const replace = useCallback((next: ChecklistBody) => {
    newest.current++
    setBody(next)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )
  // After the queue uploads something, so an item shows the gateway's answer.
  const seenUploads = useRef(uploads)
  useEffect(() => {
    if (uploads === seenUploads.current) return
    seenUploads.current = uploads
    load()
  }, [uploads, load])

  return { body, error, load, replace }
}

export type ChecklistState = ReturnType<typeof useChecklist>
