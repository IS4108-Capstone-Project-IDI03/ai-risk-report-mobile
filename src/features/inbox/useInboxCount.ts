// The Inbox's To do count for Home's header button (MB-22). Reads it when Home comes to the front and
// every 10 seconds while it is there (the web polls every 10 s too), and stops when Home is covered.
// A failed read keeps the last number: the signal may be back by the next one. Called by InboxButton.
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { todoCount } from './api'

const POLL_MS = 10_000

export function useInboxCount() {
  const [count, setCount] = useState(0)
  useFocusEffect(
    useCallback(() => {
      // Without this a late answer would set state on a screen that has gone.
      let live = true
      const read = () => todoCount().then((n) => live && setCount(n), () => {})
      read()
      const timer = setInterval(read, POLL_MS)
      return () => {
        live = false
        clearInterval(timer)
      }
    }, []),
  )
  return count
}
