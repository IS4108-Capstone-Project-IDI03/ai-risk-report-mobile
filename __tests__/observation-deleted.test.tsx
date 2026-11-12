// MB-12 AC22-AC26: Show deleted, and Restore, under the workspace list. Renders the real
// routes with the gateway mocked. The list route answers `?include=deleted` with every
// observation and the plain list with only the live ones, as the gateway does.
import { Alert } from 'react-native'
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import {
  assessment,
  location,
  mockGateway,
  observation,
  pointAtTestGateway,
  routes,
  signedIn,
  type Reply,
} from '../test/gateway'

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const STAIRCASE = { id: 'l1', building: 'Block B', floor: 'Level 2', name: 'Staircase' }
const stamp = { at: '2026-04-11T03:00:00.000Z', by: { id: 'u1', name: 'Alex Rowe' } }

// What the gateway holds: live ones, and deleted ones (with who and when).
let live: object[]
let deleted: object[]
const kept = (note: string, id: string) => observation(id, 'l1', { note, location: STAIRCASE })
const gone = (note: string, id: string, extra: object = {}) =>
  observation(id, 'l1', { note, location: STAIRCASE, deleted: stamp, ...extra })

function gateway(overrides: Record<string, Reply | ((init?: RequestInit, url?: string) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Staircase', 'Block B', 'Level 2')] },
    [`GET /api/assessments/${REF}/observations`]: (_init, url) => ({
      status: 200,
      body: url?.includes('include=deleted') ? [...live, ...deleted] : live,
    }),
    ...overrides,
  })
}

async function openWorkspace() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
  await fireEvent.press(await screen.findByRole('button', { name: /Staircase/ }))
  await screen.findByText('Captured here · ' + live.length)
}

const showDeleted = async () => fireEvent.press(await screen.findByRole('button', { name: 'Show deleted' }))

beforeEach(() => {
  jest.restoreAllMocks()
  live = [kept('Lobby clear', 'o2')]
  deleted = [gone('Sprinkler valve chained open', 'o1')]
})

describe('show deleted', () => {
  it('lists what was deleted here, with who and when, when the row is opened (AC22, AC23)', async () => {
    gateway()
    await openWorkspace()
    // Nothing is asked for until it is opened.
    expect(screen.queryByText(/Deleted by Alex Rowe/)).toBeNull()

    await showDeleted()

    expect(await screen.findByText(/Sprinkler valve chained open/)).toBeTruthy()
    expect(screen.getByText(/Deleted by Alex Rowe/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Restore observation' })).toBeTruthy()
  })

  it('hides them again when the row is tapped again (AC23)', async () => {
    gateway()
    await openWorkspace()
    await showDeleted()
    await screen.findByText(/Deleted by Alex Rowe/)

    await fireEvent.press(screen.getByRole('button', { name: 'Hide deleted' }))

    expect(screen.queryByText(/Deleted by Alex Rowe/)).toBeNull()
  })

  it('says when nothing was deleted here (AC23)', async () => {
    deleted = []
    gateway()
    await openWorkspace()

    await showDeleted()

    expect(await screen.findByText('Nothing deleted here.')).toBeTruthy()
  })

  it('leaves out observations deleted at another location (AC23)', async () => {
    deleted = [gone('Deleted in the lobby', 'o3', { location: { id: 'l9', name: 'Lobby' } })]
    gateway()
    await openWorkspace()

    await showDeleted()

    expect(await screen.findByText('Nothing deleted here.')).toBeTruthy()
    expect(screen.queryByText(/Deleted in the lobby/)).toBeNull()
  })

  it('restores one, which returns to the list and leaves the deleted ones (AC24)', async () => {
    const fetchMock = gateway({
      'POST /api/observations/o1/restore': () => {
        live = [gone('Sprinkler valve chained open', 'o1', { deleted: null }), ...live]
        deleted = []
        return { status: 200, body: live[0] }
      },
    })
    await openWorkspace()
    await showDeleted()
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore observation' }))

    await waitFor(() => expect(screen.queryByText(/Deleted by Alex Rowe/)).toBeNull())
    expect(await screen.findByText('Captured here · 2')).toBeTruthy()
    expect(fetchMock.mock.calls.filter(([url, init]) => url.endsWith('/api/observations/o1/restore') && init?.method === 'POST')).toHaveLength(1)
  })

  it("says why when a restore is refused, and the observation stays in the deleted list (AC25)", async () => {
    gateway({
      'POST /api/observations/o1/restore': { status: 403, body: { error: 'Only the assigned engineer can change this assessment.' } },
    })
    await openWorkspace()
    await showDeleted()

    await fireEvent.press(await screen.findByRole('button', { name: 'Restore observation' }))

    expect(await screen.findByText('Only the assigned engineer can change this assessment.')).toBeTruthy()
    expect(screen.getByText(/Deleted by Alex Rowe/)).toBeTruthy()
  })

  it('reads the list again after a refused restore, so a row that is no longer deleted goes (AC25)', async () => {
    gateway({
      'POST /api/observations/o1/restore': () => {
        // Restored on the web in the meantime.
        live = [gone('Sprinkler valve chained open', 'o1', { deleted: null }), ...live]
        deleted = []
        return { status: 409, body: { error: 'This observation is not deleted.' } }
      },
    })
    await openWorkspace()
    await showDeleted()

    await fireEvent.press(await screen.findByRole('button', { name: 'Restore observation' }))

    expect(await screen.findByText('This observation is not deleted.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText(/Deleted by Alex Rowe/)).toBeNull())
  })

  it('shows an observation I delete while the deleted list is open (AC26)', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.()
    })
    gateway({
      'DELETE /api/observations/o2': () => {
        deleted = [gone('Lobby clear', 'o2'), ...deleted]
        live = []
        return { status: 200, body: deleted[0] }
      },
    })
    await openWorkspace()
    await showDeleted()
    await screen.findByText(/Sprinkler valve chained open/)

    await fireEvent.press((await screen.findAllByRole('button', { name: 'Delete observation' }))[0])

    expect(await screen.findByText(/Lobby clear · Deleted by Alex Rowe/)).toBeTruthy()
  })

  it('greys the row out with a reason when there is no signal (AC22)', async () => {
    gateway()
    await openWorkspace()
    // The signal goes, and the app is closed and opened again: the last copy shows.
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch
    await screen.unmount()
    await renderRouter(routes)
    await fireEvent.press(await screen.findByText(REF))
    await screen.findByTestId('workspace')
    await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
    await fireEvent.press(await screen.findByRole('button', { name: /Staircase/ }))
    await screen.findByText('Captured here · 1')

    expect(screen.getByText('Connect to see deleted.')).toBeTruthy()
    expect(within(screen.getByTestId('workspace')).getByRole('button', { name: 'Show deleted' }).props.accessibilityState.disabled).toBe(true)
  })
})
