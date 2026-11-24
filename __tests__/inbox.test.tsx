// MB-22 (web F-10): the Inbox, an engineer's to-do list. Real routes, gateway mocked: the list, the
// count and the four per-row calls. The mock keeps To do and Done in memory, so a reload shows the truth.
// A test must never reach a real server.
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import { assessment, location, mockGateway, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const OTHER = 'RPT-2026-0408'

type N = ReturnType<typeof note>
// One notification in the gateway's shape (the fields the app reads).
function note(id: string, purpose: string, message: string, context: Record<string, string> | null, at: string, overrides: object = {}) {
  return { id, purpose, kind: 'inbox', message, details: null, context, read: false, done: false, createdAt: at, ...overrides }
}
const ASSIGNED = note('n1', 'assessment_assigned', 'New assessment: Marina Point', { reference: REF, client: 'Harbour Malls', site: 'Marina Point', sender: 'Ops Admin', reportDue: '2026-12-01' }, '2026-11-20T09:00:00Z')
const READY = note('n2', 'site_walk_ready', 'Review site walk: Pasir Gudang', { reference: OTHER, walkId: 'w1', site: 'Pasir Gudang' }, '2026-11-19T09:00:00Z')
const FAILED = note('n3', 'site_walk_failed', 'Review site walk: Tuas Depot', { reference: OTHER, walkId: 'w2', site: 'Tuas Depot' }, '2026-11-18T09:00:00Z')
const DONE_ONE = note('n4', 'assessment_assigned', 'New assessment: Leeds Cold Store', { reference: OTHER, site: 'Leeds Cold Store' }, '2026-11-10T09:00:00Z', { read: true, done: true })

let todo: N[]
let done: N[]
let online = true
// "METHOD n1 /read" for each per-row call that reached the gateway.
let calls: string[]
let failNext = false

const offlineError = () => new TypeError('Network request failed')

// Every per-row call, for the ids a test uses: moves the row between the two lists, as the gateway does.
function rowRoutes(ids: string[]) {
  const routes: Record<string, () => Reply> = {}
  const find = (id: string) => [...todo, ...done].find((n) => n.id === id)!
  const move = (id: string, from: N[], to: N[] | null) => {
    const row = find(id)
    from.splice(from.indexOf(row), 1)
    if (to) to.push(Object.assign(row, { done: to === done }))
  }
  for (const id of ids) {
    const act = (name: string, change: () => void): Reply | Error => {
      if (!online) return offlineError()
      calls.push(`${name} ${id}`)
      if (failNext) return { status: 500, body: { error: 'Server error.' } }
      change()
      return { status: 204 }
    }
    routes[`PATCH /api/notifications/${id}/read`] = () => act('read', () => todo.includes(find(id)) && move(id, todo, done)) as Reply
    routes[`POST /api/notifications/${id}/done`] = () => act('done', () => move(id, todo, done)) as Reply
    routes[`DELETE /api/notifications/${id}/done`] = () => act('undone', () => move(id, done, todo)) as Reply
    routes[`POST /api/notifications/${id}/dismiss`] = () => act('dismiss', () => move(id, done.includes(find(id)) ? done : todo, null)) as Reply
  }
  return routes
}

function gateway(overrides: Record<string, Reply | ((init?: RequestInit, url?: string) => Reply)> = {}) {
  const byNewest = (rows: N[]) => [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    'GET /api/notifications': (_init, url) => {
      if (!online) return offlineError()
      const q = new URL(url!).searchParams
      const rows = byNewest(q.get('tab') === 'done' ? done : todo)
      const offset = Number(q.get('offset'))
      return { status: 200, body: { items: rows.slice(offset, offset + Number(q.get('limit'))), total: rows.length, unread: 0, inboxTodo: todo.length } }
    },
    'GET /api/notifications/count': () =>
      online ? { status: 200, body: { total: 0, unread: 0, inboxTodo: todo.length, newestInbox: null, newestBell: null } } : offlineError(),
    ...rowRoutes(['n1', 'n2', 'n3', 'n4', 'n5']),
    // Where the rows open.
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Dock')] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    [`GET /api/assessments/${REF}/checklist`]: { status: 200, body: { scope: { facilityType: 'cold store', jurisdiction: 'SG' }, standards: [], checklist: null } },
    [`GET /api/assessments/${OTHER}/site-walks`]: { status: 200, body: [] },
    ...overrides,
  })
}

// Home, then the header's Inbox button, then the screen.
async function openInbox() {
  await renderRouter(routes)
  await screen.findByTestId('assessment-list')
  await fireEvent.press(await screen.findByRole('button', { name: /^Inbox/ }))
  return within(await screen.findByTestId('inbox'))
}
const inbox = () => within(screen.getByTestId('inbox'))
const tab = (label: RegExp) => inbox().getByRole('button', { name: label })
const sent = (name: string) => calls.filter((c) => c === name)

beforeEach(() => {
  jest.restoreAllMocks()
  online = true
  failNext = false
  calls = []
  todo = [{ ...ASSIGNED }, { ...READY }, { ...FAILED }]
  done = [{ ...DONE_ONE }]
})

describe('see it (A)', () => {
  it('has an Inbox icon at the top right of Home, with no word and the To do count on it, which opens the screen (AC1)', async () => {
    gateway()
    await renderRouter(routes)
    await screen.findByTestId('assessment-list')

    // An icon with its count, read out as "Inbox, 3 to do". The word is not drawn, and neither is a New button.
    expect(await screen.findByText('3')).toBeTruthy()
    expect(screen.queryByText('Inbox')).toBeNull()
    expect(screen.queryByText('New')).toBeNull()
    await fireEvent.press(await screen.findByRole('button', { name: 'Inbox, 3 to do' }))

    expect(await screen.findByTestId('inbox')).toBeTruthy()
    expect(screen).toHavePathname('/inbox')
  })

  it('shows no count when nothing is to do (AC1)', async () => {
    todo = []
    gateway()
    await renderRouter(routes)
    await screen.findByTestId('assessment-list')

    expect(await screen.findByRole('button', { name: 'Inbox' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /to do/ })).toBeNull()
  })

  it('has To do and Done tabs, newest first, and moves between them (AC2)', async () => {
    gateway()
    const i = await openInbox()

    expect(await i.findByText('Marina Point')).toBeTruthy()
    const tasks = i.getAllByTestId('inbox-task').map((t) => t.props.children)
    expect(tasks).toEqual(['New assessment', 'Review site walk', 'Review site walk'])
    expect(i.getAllByTestId('inbox-detail').map((t) => t.props.children)).toEqual(['Marina Point', 'Pasir Gudang', "Couldn't read the recording"])

    await fireEvent.press(tab(/^Done/))
    expect(await i.findByText('Leeds Cold Store')).toBeTruthy()
    expect(i.queryByText('Marina Point')).toBeNull()
    expect(tab(/^Done/).props.accessibilityState.selected).toBe(true)
  })

  it('reads 20 rows to a page and offers Load more (AC2)', async () => {
    todo = Array.from({ length: 25 }, (_, k) => note(`m${k}`, 'assessment_assigned', `New assessment: Site ${k}`, { reference: REF, site: `Site ${k}` }, `2026-11-${String(20 - Math.floor(k / 2)).padStart(2, '0')}T0${k % 10}:00:00Z`))
    gateway()
    const i = await openInbox()

    await i.findByText('Site 0')
    expect(i.getAllByTestId('inbox-task')).toHaveLength(20)
    await fireEvent.press(i.getByRole('button', { name: 'Load more' }))
    // The list holds all 25 (the screen draws what is in view), and the button goes.
    await waitFor(() => expect(screen.getByTestId('inbox-list').props.data).toHaveLength(25))
    expect(i.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('sends one request for two quick taps on Load more (AC2)', async () => {
    todo = Array.from({ length: 25 }, (_, k) => note(`m${k}`, 'assessment_assigned', `New assessment: Site ${k}`, { reference: REF, site: `Site ${k}` }, `2026-11-20T${String(23 - k).padStart(2, '0')}:00:00Z`))
    const fetchMock = gateway()
    const i = await openInbox()

    const more = await i.findByRole('button', { name: 'Load more' })
    await fireEvent.press(more)
    await fireEvent.press(more)

    await waitFor(() => expect(screen.getByTestId('inbox-list').props.data).toHaveLength(25))
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('offset=20'))).toHaveLength(1)
  })

  it('reads the list again on pull to refresh (AC2)', async () => {
    gateway()
    const i = await openInbox()
    await i.findByText('Marina Point')

    todo.push(note('n5', 'site_walk_ready', 'Review site walk: Jurong Yard', { reference: OTHER, walkId: 'w5', site: 'Jurong Yard' }, '2026-11-21T09:00:00Z'))
    await act(async () => {
      await screen.getByTestId('inbox-list').props.refreshControl.props.onRefresh()
    })

    expect(await i.findByText('Jurong Yard')).toBeTruthy()
  })

  it('lays out each kind of row, with its due date, and shows a row it does not know plainly (AC3)', async () => {
    todo = [ASSIGNED, READY, FAILED, note('n5', 'drafting_status', 'A part is drafted.', null, '2026-11-17T09:00:00Z', { details: 'Section 3 is ready.' })].map((n) => ({ ...n }))
    gateway()
    const i = await openInbox()

    await i.findByText('Marina Point')
    // The assigned row and the walk rows say their report due date; the plain row has none.
    expect(i.getAllByText(/^Due /)).toHaveLength(1)
    expect(i.getByText('Due 1 Dec 2026')).toBeTruthy()
    expect(i.getByText("Couldn't read the recording")).toBeTruthy()
    expect(i.getByText('A part is drafted.')).toBeTruthy()
    expect(i.getByText('Section 3 is ready.')).toBeTruthy()
  })

  it('says all done when To do is empty, and nothing yet when Done is (AC4)', async () => {
    todo = []
    done = []
    gateway()
    const i = await openInbox()

    expect(await i.findByText('All done. Nothing needs you.')).toBeTruthy()
    await fireEvent.press(tab(/^Done/))
    expect(await i.findByText('Nothing done yet.')).toBeTruthy()
  })

  it('reads the count again when Home comes back to the front (AC5; the 10-second poll is in inbox-count.test.tsx)', async () => {
    gateway()
    await renderRouter(routes)
    await screen.findByRole('button', { name: 'Inbox, 3 to do' })

    // Another window gave this engineer one more; Home reads it when it comes back to the front.
    todo.push(note('n5', 'site_walk_ready', 'Review site walk: Jurong Yard', { reference: OTHER, walkId: 'w5', site: 'Jurong Yard' }, '2026-11-21T09:00:00Z'))
    await fireEvent.press(screen.getByRole('button', { name: 'Inbox, 3 to do' }))
    await screen.findByTestId('inbox')
    await act(async () => router.back())
    expect(await screen.findByRole('button', { name: 'Inbox, 4 to do' })).toBeTruthy()
  })
})

describe('act on a row (B)', () => {
  it("opens an assigned assessment's workspace and moves the row to Done (AC6)", async () => {
    gateway()
    const i = await openInbox()

    await fireEvent.press(await i.findByRole('button', { name: /^New assessment, Marina Point/ }))

    expect(await screen.findByTestId('workspace')).toBeTruthy()
    expect(screen).toHavePathname(`/assessment/${REF}`)
    expect(sent('read n1')).toHaveLength(1)
    expect(done.map((n) => n.id)).toContain('n1')
  })

  it('opens a ready walk on its review and a failed walk on the Site walks list (AC6)', async () => {
    gateway()
    const i = await openInbox()

    await fireEvent.press(await i.findByRole('button', { name: /^Review site walk, Pasir Gudang/ }))
    await waitFor(() => expect(screen).toHavePathname(`/assessment/${OTHER}/site-walk-review`))
    expect(screen).toHaveSearchParams({ reference: OTHER, walkId: 'w1' })
    expect(sent('read n2')).toHaveLength(1)

    await act(async () => router.back())
    await fireEvent.press(await inbox().findByRole('button', { name: /^Review site walk, Couldn't read the recording/ }))
    await waitFor(() => expect(screen).toHavePathname(`/assessment/${OTHER}/site-walks`))
    expect(sent('read n3')).toHaveLength(1)
  })

  it('opens a row again after its first open failed, once back on the Inbox (AC6, AC10)', async () => {
    gateway()
    const i = await openInbox()
    const row = await i.findByRole('button', { name: /^New assessment, Marina Point/ })
    failNext = true

    // The read fails, so the row stays To do, and the workspace opens all the same.
    await fireEvent.press(row)
    await screen.findByTestId('workspace')
    failNext = false
    await act(async () => router.back())

    // Back on the Inbox it says the row was not moved (AC10), and the row is tappable again: it reads, and opens, a second time.
    expect(await inbox().findByText("Couldn't update. Check your connection, then try again.")).toBeTruthy()
    await fireEvent.press(await inbox().findByRole('button', { name: /^New assessment, Marina Point/ }))
    await screen.findByTestId('workspace')
    expect(sent('read n1')).toHaveLength(2)
  })

  it('opens a row already in Done without changing it (AC6)', async () => {
    gateway()
    const i = await openInbox()
    await fireEvent.press(tab(/^Done/))

    await fireEvent.press(await i.findByRole('button', { name: /^New assessment, Leeds Cold Store/ }))

    await waitFor(() => expect(screen).toHavePathname(`/assessment/${OTHER}`))
    expect(calls).toEqual([])
  })

  it('ticks a row to Done without opening it, and unticks it back (AC7)', async () => {
    gateway()
    const i = await openInbox()
    await i.findByText('Marina Point')

    await fireEvent.press(i.getByRole('button', { name: 'Mark done: New assessment Marina Point' }))
    await waitFor(() => expect(i.queryByText('Marina Point')).toBeNull())
    expect(sent('done n1')).toHaveLength(1)
    expect(screen).toHavePathname('/inbox')
    expect(tab(/^To do/).props.accessibilityLabel).toBe('To do, 2')

    await fireEvent.press(tab(/^Done/))
    await fireEvent.press(await i.findByRole('button', { name: 'Move back to To do: New assessment Marina Point' }))
    await waitFor(() => expect(i.queryByText('Marina Point')).toBeNull())
    expect(sent('undone n1')).toHaveLength(1)
    expect(todo.map((n) => n.id)).toContain('n1')
    expect(tab(/^To do/).props.accessibilityLabel).toBe('To do, 3')
  })

  it('asks before removing a Done row, sends nothing on Keep, and has no Remove on To do (AC8)', async () => {
    gateway()
    const i = await openInbox()
    await i.findByText('Marina Point')
    expect(i.queryByRole('button', { name: /^Remove/ })).toBeNull()
    await fireEvent.press(tab(/^Done/))
    const remove = await i.findByRole('button', { name: 'Remove: New assessment Leeds Cold Store' })

    // Cancel: nothing is sent and the row stays.
    const asked = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Cancel')?.onPress?.())
    await fireEvent.press(remove)
    expect(asked.mock.calls[0][0]).toBe('Remove from your Inbox?')
    expect(calls).toEqual([])
    expect(i.getByText('Leeds Cold Store')).toBeTruthy()

    // Remove: one dismiss, and the row is gone.
    asked.mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Remove')?.onPress?.())
    await fireEvent.press(remove)
    await waitFor(() => expect(i.queryByText('Leeds Cold Store')).toBeNull())
    expect(sent('dismiss n4')).toHaveLength(1)
  })

  it('does not bring a row back when a slow read, begun before it was ticked, answers after (AC7)', async () => {
    gateway()
    const i = await openInbox()
    await i.findByText('Marina Point')

    // Hold the next list read: its answer is the list as it is now, with the row still in it.
    const real = globalThis.fetch
    let release = () => {}
    globalThis.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (!String(url).includes('/api/notifications?')) return real(url, init)
      const snapshot = real(url, init)
      return new Promise((resolve) => (release = () => resolve(snapshot)))
    }) as unknown as typeof fetch
    await act(async () => {
      void screen.getByTestId('inbox-list').props.refreshControl.props.onRefresh()
    })
    await fireEvent.press(i.getByRole('button', { name: 'Mark done: New assessment Marina Point' }))
    await waitFor(() => expect(i.queryByText('Marina Point')).toBeNull())

    await act(async () => release())

    expect(i.queryByText('Marina Point')).toBeNull()
    expect(tab(/^To do/).props.accessibilityLabel).toBe('To do, 2')
    globalThis.fetch = real
  })

  it("puts the row and the count back and says why when a call fails (AC10)", async () => {
    gateway()
    const i = await openInbox()
    await i.findByText('Marina Point')
    failNext = true

    await fireEvent.press(i.getByRole('button', { name: 'Mark done: New assessment Marina Point' }))

    expect(await i.findByText("Couldn't update. Check your connection, then try again.")).toBeTruthy()
    expect(i.getByText('Marina Point')).toBeTruthy()
    expect(tab(/^To do/).props.accessibilityLabel).toBe('To do, 3')
  })
})

describe('honest about the signal (C)', () => {
  it('shows the saved copy read only when offline, with the tick greyed and no Remove (AC11)', async () => {
    gateway()
    const i = await openInbox()
    await i.findByText('Marina Point')
    // Both tabs are read once while there is signal, so each has a saved copy.
    await fireEvent.press(tab(/^Done/))
    await i.findByText('Leeds Cold Store')
    await act(async () => router.back())

    online = false
    await fireEvent.press(await screen.findByRole('button', { name: /^Inbox/ }))
    await screen.findByTestId('inbox')
    // The screen is a new one now, so it is looked up again.

    expect(await inbox().findByText('Connect to change your Inbox.', {}, { timeout: 5000 })).toBeTruthy()
    expect(inbox().getByText('Marina Point')).toBeTruthy()
    expect(inbox().getByRole('button', { name: 'Mark done: New assessment Marina Point' }).props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(tab(/^Done/))
    // Offline a Done row cannot be swiped, so there is no Remove to press (changed 24 Nov with AC8).
    await inbox().findByText('Leeds Cold Store')
    expect(inbox().queryByRole('button', { name: /^Remove/ })).toBeNull()
  })

  it('opens a row offline from the saved copy and sends nothing (AC11)', async () => {
    gateway()
    const i = await openInbox()
    await i.findByText('Marina Point')
    await act(async () => router.back())

    online = false
    await fireEvent.press(await screen.findByRole('button', { name: /^Inbox/ }))
    await screen.findByTestId('inbox')
    await inbox().findByText('Connect to change your Inbox.', {}, { timeout: 5000 })

    await fireEvent.press(inbox().getByRole('button', { name: /^New assessment, Marina Point/ }))
    expect(await screen.findByTestId('workspace')).toBeTruthy()
    expect(calls).toEqual([])
  })

  it('sends one request for two quick taps on the tick (AC12)', async () => {
    gateway()
    const i = await openInbox()
    await i.findByText('Marina Point')

    const tick = i.getByRole('button', { name: 'Mark done: New assessment Marina Point' })
    await fireEvent.press(tick)
    await fireEvent.press(tick)

    await waitFor(() => expect(i.queryByText('Marina Point')).toBeNull())
    expect(sent('done n1')).toHaveLength(1)
  })

  it('sends one dismiss for two quick taps on Remove (AC12)', async () => {
    gateway()
    const i = await openInbox()
    await fireEvent.press(tab(/^Done/))
    const remove = await i.findByRole('button', { name: 'Remove: New assessment Leeds Cold Store' })
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Remove')?.onPress?.())

    await fireEvent.press(remove)
    await fireEvent.press(remove)

    await waitFor(() => expect(i.queryByText('Leeds Cold Store')).toBeNull())
    expect(sent('dismiss n4')).toHaveLength(1)
  })

  it('sends one read for two quick taps on a row (AC12)', async () => {
    gateway()
    const i = await openInbox()

    const row = await i.findByRole('button', { name: /^New assessment, Marina Point/ })
    await fireEvent.press(row)
    await fireEvent.press(row)

    await screen.findByTestId('workspace')
    expect(sent('read n1')).toHaveLength(1)
  })
})
