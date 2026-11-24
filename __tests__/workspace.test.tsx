// MB-02: the assessment workspace and choosing or adding a location. Renders the
// real routes with the gateway mocked; each test opens the workspace from Home.
import { Alert } from 'react-native'
import { act, fireEvent, renderRouter, screen, testRouter, waitFor, within } from 'expo-router/testing-library'
import {
  assessment,
  location,
  mockGateway,
  observation,
  openTab,
  pointAtTestGateway,
  routes,
  signedIn,
  type Reply,
} from '../test/gateway'

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const northgate = assessment(REF, 'capturing', {
  client: 'Northgate Logistics',
  site: { id: 's1', code: 'S-002', name: 'Tilbury Distribution Centre', address: null },
})

// Listed out of order on purpose: the picker sorts them (AC7).
const LOCATIONS = [
  location('l1', 'Staircase', 'Block B', 'Level 2'),
  location('l2', 'Pump room', 'Block A', 'Basement 1'),
  location('l3', 'Facade', 'Block A'),
  location('l4', 'Fire access route'),
  location('l5', 'Lobby', 'Block A', 'Level 1'),
]

// The gateway for one workspace; a test overrides any route it cares about.
function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [northgate] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: LOCATIONS },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    ...overrides,
  })
}

// The whole screen: since MB-07 (AC5, AC6) the location bar sits below the list.
const workspace = () => within(screen.getByTestId('workspace-screen'))

// Signs in (session mocked), then taps the assessment on Home.
async function openWorkspace() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
}

async function chooseLocation(name: string) {
  await fireEvent.press(await workspace().findByRole('button', { name: /Choose location|Location/ }))
  await fireEvent.press(await screen.findByRole('button', { name }))
}

describe('workspace', () => {
  it('opens from Home with the client, site, reference and visit date (AC1)', async () => {
    gateway()
    await openWorkspace()

    expect(workspace().getByText('Northgate Logistics')).toBeTruthy()
    expect(workspace().getByText('Tilbury Distribution Centre')).toBeTruthy()
    expect(workspace().getByText(REF)).toBeTruthy()
    expect(workspace().getByText('11 Apr 2026')).toBeTruthy()
  })

  it('asks for a location before capturing (AC2)', async () => {
    gateway()
    await openWorkspace()

    expect(await workspace().findByText('Choose where you are')).toBeTruthy()
  })

  it('keeps the chosen location when the assessment is reopened (AC3)', async () => {
    gateway()
    await openWorkspace()
    await chooseLocation('Pump room')
    await testRouter.back()
    await fireEvent.press(await screen.findByText(REF))

    expect(await workspace().findByText('Block A · Basement 1 · Pump room')).toBeTruthy()
  })

  it("lists what was captured at the chosen location, newest first (AC4)", async () => {
    gateway({
      [`GET /api/assessments/${REF}/observations`]: {
        status: 200,
        body: [
          observation('o1', 'l2', {
            note: 'Sprinkler valve chained open\nSecond line',
            copeDimensions: ['Protection'],
            severity: 'high',
          }),
          observation('o2', 'l2', {
            photos: [{ id: 'p1' }, { id: 'p2' }],
            recordings: [{ id: 'r1' }],
          }),
          observation('o3', 'l5', { note: 'Elsewhere in the lobby' }),
        ],
      },
    })
    await openWorkspace()
    await chooseLocation('Pump room')

    const cards = await workspace().findAllByTestId('observation-card')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText('Sprinkler valve chained open')).toBeTruthy()
    expect(within(cards[0]).getByText('Protection')).toBeTruthy()
    expect(within(cards[0]).getByText('High')).toBeTruthy()
    expect(within(cards[1]).getByText('2 photos · Voice note')).toBeTruthy()
    expect(within(cards[1]).getByText('Uncategorised')).toBeTruthy()
    expect(workspace().queryByText('Elsewhere in the lobby')).toBeNull()
  })

  it('says when nothing is captured at the chosen location (AC4)', async () => {
    gateway()
    await openWorkspace()
    await chooseLocation('Lobby')

    expect(await workspace().findByText('Nothing captured here yet.')).toBeTruthy()
  })

  it('reloads observations when pulled down (AC5)', async () => {
    let calls = 0
    gateway({
      [`GET /api/assessments/${REF}/observations`]: () => {
        calls += 1
        return {
          status: 200,
          body: calls === 1 ? [] : [observation('o9', 'l5', { note: 'Fire door wedged open' })],
        }
      },
    })
    await openWorkspace()
    await chooseLocation('Lobby')
    await act(async () => {
      await screen.getByTestId('workspace').props.refreshControl.props.onRefresh()
    })

    expect(await workspace().findByText('Fire door wedged open')).toBeTruthy()
  })

  // Signs out, then signs in as the given user, and reopens the assessment.
  async function signOutAndBackInAs(user: { id: string; role: string; name: string }) {
    await testRouter.back()
    await openTab('Profile')
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }))
    await fireEvent.changeText(await screen.findByLabelText('Work email'), 'someone@marsh.test')
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret')
    gateway({ 'POST /api/auth/login': { status: 200, body: { user } } })
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
    await fireEvent.press(await screen.findByText(REF))
  }

  it("doesn't carry a chosen location over to another engineer on a shared phone", async () => {
    gateway({ 'POST /api/auth/logout': { status: 204 } })
    await openWorkspace()
    await chooseLocation('Pump room')
    await signOutAndBackInAs({ id: 'u2', role: 'risk_engineer', name: 'Ben Lim' })

    expect(await workspace().findByText('Choose where you are')).toBeTruthy()
  })

  it('keeps the chosen location when the same engineer signs back in', async () => {
    gateway({ 'POST /api/auth/logout': { status: 204 } })
    await openWorkspace()
    await chooseLocation('Pump room')
    await signOutAndBackInAs(signedIn.body.user)

    expect(await workspace().findByText('Block A · Basement 1 · Pump room')).toBeTruthy()
  })

  it("says so when the assessment isn't in the engineer's list any more", async () => {
    // Home's load lists it; the workspace's own load no longer does.
    let calls = 0
    gateway({ 'GET /api/assessments': () => ({ status: 200, body: calls++ ? [] : [northgate] }) })
    await renderRouter(routes)
    await fireEvent.press(await screen.findByText(REF))

    expect(await screen.findByText("This assessment isn't available")).toBeTruthy()
  })

  it('does not start a capture session when opened (AC6)', async () => {
    const fetchMock = gateway()
    await openWorkspace()
    await chooseLocation('Lobby')

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('capture-session'))).toBe(false)
  })
})

describe('choosing a location', () => {
  it('groups by building, then level lowest first, then elsewhere on site (AC7)', async () => {
    gateway()
    await openWorkspace()
    await fireEvent.press(await workspace().findByRole('button', { name: 'Choose location' }))

    const names = (await screen.findAllByTestId('location-name')).map((n) => n.props.children)
    expect(names).toEqual(['Facade', 'Pump room', 'Lobby', 'Staircase', 'Fire access route'])
    for (const heading of ['Block A', 'Whole building', 'Basement 1', 'Level 1', 'Block B', 'Elsewhere on site']) {
      expect(screen.getByText(heading)).toBeTruthy()
    }
  })

  it('marks the chosen location and returns to the workspace (AC8)', async () => {
    gateway()
    await openWorkspace()
    await chooseLocation('Staircase')

    expect(await workspace().findByText('Block B · Level 2 · Staircase')).toBeTruthy()
    await fireEvent.press(workspace().getByRole('button', { name: /Location/ }))
    expect(await screen.findByRole('button', { name: 'Staircase', selected: true })).toBeTruthy()
  })

  it('offers Try again when the locations fail to load', async () => {
    // The first two fail: MB-10's workspace loads them once to keep a copy,
    // then the picker does.
    let calls = 0
    gateway({
      [`GET /api/assessments/${REF}/locations`]: () =>
        calls++ > 1 ? { status: 200, body: LOCATIONS } : new TypeError('Network request failed'),
    })
    await openWorkspace()
    await fireEvent.press(await workspace().findByRole('button', { name: 'Choose location' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('button', { name: 'Pump room' })).toBeTruthy()
  })

  it('offers Add location when none are listed (AC9)', async () => {
    gateway({ [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [] } })
    await openWorkspace()
    await fireEvent.press(await workspace().findByRole('button', { name: 'Choose location' }))

    expect(await screen.findByText('No locations listed for this assessment yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add location' })).toBeTruthy()
  })
})

describe('adding a location', () => {
  async function openAddForm() {
    await openWorkspace()
    await fireEvent.press(await workspace().findByRole('button', { name: 'Choose location' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Add location' }))
  }

  it('saves it, chooses it and returns to the workspace (AC10)', async () => {
    let sent: unknown
    gateway({
      [`POST /api/assessments/${REF}/locations`]: (init) => {
        sent = JSON.parse(String(init?.body))
        return { status: 201, body: location('l9', 'Staircase', 'Block A', 'Level 2') }
      },
    })
    await openAddForm()
    await fireEvent.changeText(screen.getByLabelText('Building'), 'Block A')
    await fireEvent.changeText(screen.getByLabelText('Level'), 'L2')
    await fireEvent.changeText(screen.getByLabelText('Location'), 'Staircase')
    await fireEvent.press(screen.getByRole('button', { name: 'Save location' }))

    expect(sent).toEqual({ building: 'Block A', floor: 'L2', name: 'Staircase' })
    expect(await workspace().findByText('Block A · Level 2 · Staircase')).toBeTruthy()
  })

  it('saves a name only as elsewhere on site (AC10)', async () => {
    let sent: unknown
    gateway({
      [`POST /api/assessments/${REF}/locations`]: (init) => {
        sent = JSON.parse(String(init?.body))
        return { status: 201, body: location('l9', 'Loading bay') }
      },
    })
    await openAddForm()
    await fireEvent.changeText(screen.getByLabelText('Location'), 'Loading bay')
    await fireEvent.press(screen.getByRole('button', { name: 'Save location' }))

    expect(sent).toEqual({ name: 'Loading bay' })
    expect(await workspace().findByText('Elsewhere on site · Loading bay')).toBeTruthy()
  })

  it("shows the gateway's message for a duplicate and stays on the form (AC11)", async () => {
    gateway({
      [`POST /api/assessments/${REF}/locations`]: {
        status: 409,
        body: { error: 'This location is already on the list.', fields: { name: 'This location is already on the list.' } },
      },
    })
    await openAddForm()
    await fireEvent.changeText(screen.getByLabelText('Location'), 'Fire access route')
    await fireEvent.press(screen.getByRole('button', { name: 'Save location' }))

    expect(await screen.findByText('This location is already on the list.')).toBeTruthy()
    expect(screen.getByLabelText('Location')).toBeTruthy()
  })

  it('only takes a level once there is a building (AC12)', async () => {
    gateway()
    await openAddForm()

    expect(screen.getByLabelText('Level').props.editable).toBe(false)
    await fireEvent.changeText(screen.getByLabelText('Building'), 'Block A')
    expect(screen.getByLabelText('Level').props.editable).toBe(true)
  })
})

// MB-02 AC35-AC39 (added 20 Nov): remove a saved location from the picker by swiping it left.
// The red Remove button is laid out behind each row, so a test presses it by name.
describe('removing a location', () => {
  // Answers the "Remove this location?" question by pressing the button with this label.
  const answer = (label: string) =>
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => void buttons?.find((b) => b.text === label)?.onPress?.())
  const deletes = (fetchMock: jest.Mock) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')

  // The gateway keeps a list; DELETE takes one out, as the real one does. `observations` are what is filed
  // at locations (GET .../observations, with ?include=deleted too: the mock ignores the query).
  function withDelete(reply: Reply = { status: 204 }, observations: object[] = []) {
    let list = [...LOCATIONS]
    const del = (id: string) => () => {
      if (!(reply instanceof Error) && reply.status === 204) list = list.filter((l) => l.id !== id)
      return reply
    }
    return gateway({
      [`GET /api/assessments/${REF}/locations`]: () => ({ status: 200, body: list }),
      [`GET /api/assessments/${REF}/observations`]: { status: 200, body: observations },
      [`DELETE /api/assessments/${REF}/locations/l3`]: del('l3'),
      [`DELETE /api/assessments/${REF}/locations/l5`]: del('l5'),
    })
  }
  async function openPicker() {
    await openWorkspace()
    await fireEvent.press(await workspace().findByRole('button', { name: /Choose location|Location/ }))
    await screen.findByRole('button', { name: 'Facade' })
  }

  it('asks first, then removes it and shows the list without it (AC35, AC36, AC37)', async () => {
    const fetchMock = withDelete()
    const alert = answer('Remove')
    await openPicker()
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Facade' }))

    expect(alert.mock.calls[0][0]).toBe('Remove this location?')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Facade' })).toBeNull())
    expect(deletes(fetchMock)).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Pump room' })).toBeTruthy()
  })

  it('removes the one I swiped, not its neighbour (AC37)', async () => {
    const fetchMock = withDelete()
    answer('Remove')
    await openPicker()
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Lobby' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lobby' })).toBeNull())
    expect(deletes(fetchMock).map(([url]) => String(url).split('/').pop())).toEqual(['l5'])
    expect(screen.getByRole('button', { name: 'Facade' })).toBeTruthy()
  })

  it('does nothing when I choose Keep (AC36)', async () => {
    const fetchMock = withDelete()
    answer('Keep')
    await openPicker()
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Facade' }))

    expect(deletes(fetchMock)).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Facade' })).toBeTruthy()
  })

  it('has no Remove for a location that has observations, deleted ones too (AC35)', async () => {
    // One live observation at Facade (l3), one deleted at Lobby (l5).
    withDelete({ status: 204 }, [observation('o1', 'l3'), observation('o2', 'l5', { deleted: { at: '2026-11-19T10:00:00Z', by: { id: 'u1', name: 'Ava Tan' } } })])
    await openPicker()

    expect(await screen.findByRole('button', { name: 'Remove Pump room' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove Facade' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove Lobby' })).toBeNull()
  })

  it('asks me to choose where I am again when the chosen location is removed (AC37)', async () => {
    withDelete()
    answer('Remove')
    await openWorkspace()
    await chooseLocation('Facade')
    await workspace().findByText('Block A · Facade')
    await fireEvent.press(workspace().getByRole('button', { name: /Location/ }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Facade' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Facade' })).toBeNull())
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }))

    expect(await workspace().findByRole('button', { name: 'Choose location' })).toBeTruthy()
  })

  it("shows the gateway's words when it refuses, and keeps the location (AC38)", async () => {
    withDelete({ status: 409, body: { error: 'Facade has 1 observation. It can\'t be removed while they are saved there.' } })
    answer('Remove')
    await openPicker()
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Facade' }))

    expect(await screen.findByText("Facade has 1 observation. It can't be removed while they are saved there.")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Facade' })).toBeTruthy()
  })

  it('has no swipe to remove when there is no signal, and says so (AC39)', async () => {
    withDelete()
    await openWorkspace()
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch
    await screen.unmount()
    await renderRouter(routes)
    await fireEvent.press(await screen.findByText(REF))
    await screen.findByTestId('workspace')
    await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
    await screen.findByRole('button', { name: 'Facade' })

    expect(screen.getByText('Connect to remove.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove Facade' })).toBeNull()
  })
})
