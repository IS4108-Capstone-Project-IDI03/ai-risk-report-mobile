// The Inbox screen's state (MB-22, web F-10): the tab, its rows, the To do count, and what a person does
// to a row (open, tick, untick, remove). Called by screens/Inbox. Calls api.ts and openRow.ts.
// A row leaves the list at once and comes back if its call fails, so the list never lies for long.
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { errorText } from '@/lib/api'
import { useOffline } from '@/features/offline/provider'
import { binItem, firstPage, nextPage, openItem, tickItem, untickItem, type Notification, type Page, type Tab } from './api'
import { whereTo } from './openRow'

const FAILED = "Couldn't update. Check your connection, then try again."

export function useInbox() {
  const { offline } = useOffline()
  const [tab, setTab] = useState<Tab>('todo')
  // The rows held, and which tab they belong to, so a tab switch never shows the old tab's rows.
  const [held, setHeld] = useState<{ tab: Tab; items: Notification[]; total: number } | null>(null)
  const [todo, setTodo] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Rows already acted on since the last read. Set at once on a press (state is a render late), so a
  // quick second tap sends nothing: a second call would open or tick the row twice.
  const acted = useRef(new Set<string>())
  // Counted up by every row action. A read begun before one is out of date and is dropped, or a row the
  // person just ticked would come back, with the old count, when a slow read answers.
  const edits = useRef(0)

  const apply = (forTab: Tab, page: Page) => {
    acted.current.clear()
    setHeld({ tab: forTab, items: page.items, total: page.total })
    setTodo(page.inboxTodo)
    setError(null)
  }
  // Reads the tab. Used when the screen comes to the front and on a tab switch, so a row opened
  // elsewhere, or one that arrived, shows. Offline it reads the saved copy (api.firstPage).
  useFocusEffect(
    useCallback(() => {
      // Without this a late answer for the old tab would land under the new one.
      let live = true
      const at = edits.current
      // A row whose open failed is tappable again on coming back, even if the read below fails too.
      acted.current.clear()
      firstPage(tab).then(
        (page) => live && edits.current === at && apply(tab, page),
        (e: unknown) => live && setError(errorText(e)),
      )
      return () => {
        live = false
      }
    }, [tab]),
  )

  const loaded = held?.tab === tab
  const items = loaded ? held.items : []

  async function refresh() {
    setRefreshing(true)
    const at = edits.current
    await firstPage(tab).then((page) => edits.current === at && apply(tab, page), (e: unknown) => setError(errorText(e)))
    setRefreshing(false)
  }

  async function loadMore() {
    setLoadingMore(true)
    await nextPage(tab, items.length).then(
      (page) => setHeld((h) => (h && h.tab === tab ? { ...h, items: [...h.items, ...page.items.filter((n) => !h.items.some((x) => x.id === n.id))], total: page.total } : h)),
      (e: unknown) => setProblem(errorText(e)),
    )
    setLoadingMore(false)
  }

  // A row leaves the list; `put` brings it back where it was (newest first) if its call fails.
  const take = (n: Notification) => setHeld((h) => h && { ...h, items: h.items.filter((x) => x.id !== n.id), total: h.total - 1 })
  const put = (n: Notification) =>
    setHeld((h) => (h && h.tab === (n.done ? 'done' : 'todo') ? { ...h, items: [...h.items, n].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), total: h.total + 1 } : h))
  const moveTodo = (by: number) => setTodo((c) => Math.max(0, c + by))

  // Runs one call on a row that then leaves this tab. `by` is its effect on the To do count.
  async function change(n: Notification, call: (id: string) => Promise<void>, by: number) {
    if (offline || acted.current.has(n.id)) return
    acted.current.add(n.id)
    edits.current += 1
    setProblem(null)
    take(n)
    moveTodo(by)
    try {
      await call(n.id)
    } catch {
      acted.current.delete(n.id)
      put(n)
      moveTodo(-by)
      setProblem(FAILED)
    }
  }

  // The circle: To do goes to Done, Done goes back to To do.
  const toggle = (n: Notification) => change(n, n.done ? untickItem : tickItem, n.done ? 1 : -1)

  // Remove asks first, as Remove location does (the web has an Undo toast; the app has no toasts).
  const remove = (n: Notification) =>
    Alert.alert('Remove from your Inbox?', "It leaves your Inbox only. Nobody else's list changes.", [
      { text: 'Cancel', style: 'cancel' },
      // Only a To do row has Remove, so the count drops by one.
      { text: 'Remove', style: 'destructive', onPress: () => void change(n, binItem, -1) },
    ])

  // Opening a To do row moves it to Done first (as the web does), then goes to its page. If that call
  // fails, or there is no signal, the row stays To do and the page opens anyway: the saved assessment
  // still opens offline, and the list is right again at the next read.
  async function open(n: Notification) {
    if (acted.current.has(n.id)) return
    acted.current.add(n.id)
    edits.current += 1
    setProblem(null)
    if (!n.done && !offline) {
      take(n)
      moveTodo(-1)
      await openItem(n.id).catch(() => {
        put(n)
        moveTodo(1)
        // Shown when the person comes back from the page (AC10): the row was not moved to Done.
        setProblem(FAILED)
      })
    }
    const href = whereTo(n)
    if (href) router.push(href)
  }

  return { tab, setTab, items, loaded, hasMore: loaded && items.length < held.total, todo, error, problem, offline, refreshing, loadingMore, refresh, loadMore, open, toggle, remove }
}
