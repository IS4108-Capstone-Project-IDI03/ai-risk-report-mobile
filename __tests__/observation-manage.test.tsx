// MB-12: edit or delete a saved observation. Renders the real routes with the
// gateway mocked. Each test opens the workspace from Home, chooses the location,
// and works on an observation from there. The swipe row is mocked (test/setup.ts):
// Jest can't swipe, so its Delete button sits beside the card.
import * as FileSystem from 'expo-file-system'
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
const NETWORK = new TypeError('Network request failed')
const files = (FileSystem as unknown as { __files: Map<string, string> }).__files

// The gateway for one workspace. `list` is what the observations route sends, and a
// test changes it to show what the gateway holds after a change.
let list: object[] = []
function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Staircase', 'Block B', 'Level 2')] },
    [`GET /api/assessments/${REF}/observations`]: () => ({ status: 200, body: list }),
    ...overrides,
  })
}

const stamp = { at: '2026-04-11T03:00:00.000Z', by: { id: 'u1', name: 'Ava Tan' } }
const high = (extra: object = {}) =>
  observation('o1', 'l1', {
    note: 'Sprinkler valve chained open',
    severity: 'high',
    copeDimensions: ['Protection'],
    engineer: 'Ava Tan',
    location: STAIRCASE,
    ...extra,
  })

async function openWorkspace() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
  await fireEvent.press(await screen.findByRole('button', { name: /^Staircase/ }))
}

async function openObservation() {
  await fireEvent.press((await screen.findAllByTestId('observation-open'))[0])
  return within(await screen.findByTestId('observation-detail'))
}

// Answers the confirmation by pressing the button with this label.
function answer(label: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.()
  })
}

const sent = (fetchMock: jest.Mock, method: string, path: string) =>
  fetchMock.mock.calls.filter(([url, init]) => url.endsWith(path) && (init?.method ?? 'GET') === method)

beforeEach(() => {
  list = [high(), observation('o2', 'l1', { note: 'Lobby clear', location: STAIRCASE })]
  jest.restoreAllMocks()
})

describe('delete', () => {
  it('deletes from the detail after confirming, and goes back without it (AC8, AC9, AC10)', async () => {
    const alert = answer('Delete')
    const fetchMock = gateway({
      'DELETE /api/observations/o1': () => {
        list = list.filter((o) => (o as { id: string }).id !== 'o1')
        return { status: 200, body: high({ deleted: stamp }) }
      },
    })
    await openWorkspace()
    const detail = await openObservation()

    await fireEvent.press(detail.getByRole('button', { name: 'Delete observation' }))

    expect(alert).toHaveBeenCalledWith(
      'Delete this observation?',
      expect.stringContaining('restored on the web'),
      expect.any(Array),
    )
    expect(await screen.findByTestId('workspace')).toBeTruthy()
    expect(sent(fetchMock, 'DELETE', '/api/observations/o1')).toHaveLength(1)
    await waitFor(() => expect(screen.queryByText(/Sprinkler valve chained open/)).toBeNull())
    expect(screen.getByText(/Lobby clear/)).toBeTruthy()
  })

  it('keeps it when you choose Keep (AC9)', async () => {
    answer('Keep')
    const fetchMock = gateway()
    await openWorkspace()
    const detail = await openObservation()

    await fireEvent.press(detail.getByRole('button', { name: 'Delete observation' }))

    expect(sent(fetchMock, 'DELETE', '/api/observations/o1')).toHaveLength(0)
    expect(screen.getByTestId('observation-detail')).toBeTruthy()
  })

  it("shows the gateway's words when it refuses, and keeps the observation (AC11, AC12)", async () => {
    answer('Delete')
    gateway({
      'DELETE /api/observations/o1': { status: 403, body: { error: 'Only the assigned engineer can change this assessment.' } },
    })
    await openWorkspace()
    const detail = await openObservation()

    await fireEvent.press(detail.getByRole('button', { name: 'Delete observation' }))

    expect(await screen.findByText('Only the assigned engineer can change this assessment.')).toBeTruthy()
    expect(screen.getByTestId('observation-detail')).toBeTruthy()
  })

  it('says it is gone when the delete finds it already deleted on the web (AC12)', async () => {
    answer('Delete')
    gateway({
      'DELETE /api/observations/o1': () => {
        list = list.filter((o) => (o as { id: string }).id !== 'o1')
        return { status: 409, body: { error: 'This observation is deleted. Restore it before changing it.' } }
      },
    })
    await openWorkspace()
    const detail = await openObservation()

    await fireEvent.press(detail.getByRole('button', { name: 'Delete observation' }))

    expect(await screen.findByText("This observation isn't available")).toBeTruthy()
  })

  it("says it can't reach the server when the signal is lost mid-delete (AC11)", async () => {
    answer('Delete')
    gateway({ 'DELETE /api/observations/o1': NETWORK })
    await openWorkspace()
    const detail = await openObservation()

    await fireEvent.press(detail.getByRole('button', { name: 'Delete observation' }))

    expect(await screen.findByText("Can't reach the server. Check your connection, then try again.")).toBeTruthy()
  })

  it('deletes from the workspace card, and the card leaves the list (AC7, AC9, AC10)', async () => {
    answer('Delete')
    const fetchMock = gateway({
      'DELETE /api/observations/o1': () => {
        list = list.filter((o) => (o as { id: string }).id !== 'o1')
        return { status: 200, body: high({ deleted: stamp }) }
      },
    })
    await openWorkspace()
    await screen.findAllByTestId('observation-card')

    // The first card's swipe action (o1, the newest); in the app it appears on swiping.
    await fireEvent.press((await screen.findAllByRole('button', { name: 'Delete observation' }))[0])

    await waitFor(() => expect(screen.queryByText(/Sprinkler valve chained open/)).toBeNull())
    expect(sent(fetchMock, 'DELETE', '/api/observations/o1')).toHaveLength(1)
    expect(screen.getByText(/Lobby clear/)).toBeTruthy()
  })

  it('says why in an alert when a delete from the workspace is refused, and the card stays (AC12)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons) => {
      // The confirmation has Keep and Delete; the refusal has no buttons to choose.
      if (title === 'Delete this observation?') buttons?.find((b) => b.text === 'Delete')?.onPress?.()
    })
    gateway({ 'DELETE /api/observations/o1': { status: 403, body: { error: 'Only the assigned engineer can change this assessment.' } } })
    await openWorkspace()
    await screen.findAllByTestId('observation-card')

    await fireEvent.press((await screen.findAllByRole('button', { name: 'Delete observation' }))[0])

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("Couldn't delete this observation", 'Only the assigned engineer can change this assessment.'),
    )
    expect(screen.getByText(/Sprinkler valve chained open/)).toBeTruthy()
  })
})

// An observation saved with no signal (MB-10), as the app leaves it on the phone.
function queueOnPhone() {
  const owner = 'file:///document/users/u1'
  files.set(
    `${owner}/queue.json`,
    JSON.stringify([
      {
        kind: 'observation',
        id: 'q1',
        reference: REF,
        locationId: 'l1',
        draft: { photos: [], pages: [], recordings: [], note: 'Queued note, nothing uploaded', cope: [], severity: 'high' },
        savedAt: '2026-04-11T02:00:00.000Z',
      },
    ]),
  )
}

describe('rules', () => {
  it('offers neither Edit nor Delete on an observation waiting to upload (AC13)', async () => {
    queueOnPhone()
    list = []
    gateway({ [`POST /api/assessments/${REF}/capture-session`]: NETWORK })
    await openWorkspace()

    const detail = await openObservation()

    expect(detail.getByText('Queued note, nothing uploaded')).toBeTruthy()
    expect(detail.queryByRole('button', { name: 'Delete observation' })).toBeNull()
    expect(detail.queryByRole('button', { name: 'Edit observation' })).toBeNull()
    const [card] = screen.queryAllByTestId('observation-card')
    expect(card ? within(card).queryByRole('button', { name: 'Delete observation' }) : null).toBeNull()
  })

  it('greys out Edit and Delete with a reason when there is no signal (AC14)', async () => {
    gateway()
    await openWorkspace()
    await screen.findByText(/Sprinkler valve chained open/)
    // The signal goes, and the app is closed and opened again: the last copy shows.
    globalThis.fetch = jest.fn(async () => {
      throw NETWORK
    }) as unknown as typeof fetch
    await screen.unmount()
    await renderRouter(routes)
    await fireEvent.press(await screen.findByText(REF))
    await screen.findByTestId('workspace')
    await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
    await fireEvent.press(await screen.findByRole('button', { name: /^Staircase/ }))

    const detail = await openObservation()

    expect(detail.getByText('Connect to edit or delete.')).toBeTruthy()
    expect(detail.getByRole('button', { name: 'Edit observation' }).props.accessibilityState.disabled).toBe(true)
    expect(detail.getByRole('button', { name: 'Delete observation' }).props.accessibilityState.disabled).toBe(true)
  })
})

describe('edit', () => {
  async function openEditor() {
    const detail = await openObservation()
    await fireEvent.press(detail.getByRole('button', { name: 'Edit observation' }))
    return within(await screen.findByTestId('observation-edit'))
  }
  const selected = (editor: ReturnType<typeof within>, name: string) =>
    editor.getByRole('button', { name }).props.accessibilityState.selected

  it('opens the editor filled in with severity, COPE and note (AC1)', async () => {
    gateway()
    await openWorkspace()

    const editor = await openEditor()

    expect(selected(editor, 'High')).toBe(true)
    expect(selected(editor, 'Low')).toBe(false)
    expect(selected(editor, 'Protection')).toBe(true)
    expect(selected(editor, 'Exposure')).toBe(false)
    expect(editor.getByLabelText('Note').props.value).toBe('Sprinkler valve chained open')
  })

  it('saves only what changed, then shows it on the detail and the card (AC2, AC3)', async () => {
    const fetchMock = gateway({
      'PATCH /api/observations/o1': () => {
        list = [high({ severity: 'low', edited: stamp }), list[1]]
        return { status: 200, body: list[0] }
      },
    })
    await openWorkspace()
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Low' }))
    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    const detail = within(await screen.findByTestId('observation-detail'))
    expect(await detail.findByText('Low')).toBeTruthy()
    expect(detail.getByText(/Edited .* by Ava Tan/)).toBeTruthy()
    const [patch] = sent(fetchMock, 'PATCH', '/api/observations/o1')
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ severity: 'low' })
  })

  it('can add and remove COPE categories, and none means uncategorised (AC3)', async () => {
    const fetchMock = gateway({ 'PATCH /api/observations/o1': { status: 200, body: high() } })
    await openWorkspace()
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Exposure' }))
    await fireEvent.press(editor.getByRole('button', { name: 'Protection' }))
    await fireEvent.press(editor.getByRole('button', { name: 'Exposure' }))
    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(sent(fetchMock, 'PATCH', '/api/observations/o1')).toHaveLength(1))
    expect(JSON.parse(String(sent(fetchMock, 'PATCH', '/api/observations/o1')[0][1]!.body))).toEqual({ copeDimensions: null })
  })

  it('removes the note when it is cleared (AC4)', async () => {
    const fetchMock = gateway({ 'PATCH /api/observations/o1': { status: 200, body: high({ note: null }) } })
    await openWorkspace()
    const editor = await openEditor()

    await fireEvent.changeText(editor.getByLabelText('Note'), '')
    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(sent(fetchMock, 'PATCH', '/api/observations/o1')).toHaveLength(1))
    expect(JSON.parse(String(sent(fetchMock, 'PATCH', '/api/observations/o1')[0][1]!.body))).toEqual({ note: null })
  })

  it('does not count spaces typed into an empty note as a change (AC6)', async () => {
    list = [high({ note: null, photos: [{ id: 'p1', url: '/api/observations/o1/photos/p1/image' }] })]
    gateway()
    await openWorkspace()
    const editor = await openEditor()

    await fireEvent.changeText(editor.getByLabelText('Note'), '   ')

    expect(editor.getByRole('button', { name: 'Save changes' }).props.accessibilityState.disabled).toBe(true)
  })

  it("shows the gateway's reason under the note when it refuses it, and keeps what I typed (AC4, AC5)", async () => {
    gateway({
      'PATCH /api/observations/o1': {
        status: 400,
        body: { error: 'The observation details are invalid.', fields: { note: 'The note must be 5,000 characters or fewer.' } },
      },
    })
    await openWorkspace()
    const editor = await openEditor()

    await fireEvent.changeText(editor.getByLabelText('Note'), 'A longer note')
    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    expect(await editor.findByText('The note must be 5,000 characters or fewer.')).toBeTruthy()
    expect(editor.getByLabelText('Note').props.value).toBe('A longer note')
  })

  it("keeps my changes and says so when the server can't be reached (AC5)", async () => {
    gateway({ 'PATCH /api/observations/o1': NETWORK })
    await openWorkspace()
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Critical' }))
    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    expect(await editor.findByText("Can't reach the server. Check your connection, then try again.")).toBeTruthy()
    expect(selected(editor, 'Critical')).toBe(true)
  })

  it('shows the 403 when I am not the assigned engineer (AC12)', async () => {
    gateway({
      'PATCH /api/observations/o1': { status: 403, body: { error: 'Only the assigned engineer can change this assessment.' } },
    })
    await openWorkspace()
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Low' }))
    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    expect(await editor.findByText('Only the assigned engineer can change this assessment.')).toBeTruthy()
  })

  it('asks before throwing away unsaved changes, and closes at once with none (AC6)', async () => {
    const fetchMock = gateway()
    await openWorkspace()
    const editor = await openEditor()
    await fireEvent.press(editor.getByRole('button', { name: 'Low' }))
    const alert = answer('Keep editing')

    await fireEvent.press(editor.getByRole('button', { name: 'Cancel' }))

    expect(alert).toHaveBeenCalledWith('Discard your changes?', expect.any(String), expect.any(Array))
    expect(screen.getByTestId('observation-edit')).toBeTruthy()
    jest.restoreAllMocks()
    answer('Discard')
    await fireEvent.press(editor.getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByTestId('observation-detail')).toBeTruthy()
    expect(sent(fetchMock, 'PATCH', '/api/observations/o1')).toHaveLength(0)
  })

  it('closes without asking when nothing changed (AC6)', async () => {
    gateway()
    await openWorkspace()
    const editor = await openEditor()
    const alert = jest.spyOn(Alert, 'alert')

    await fireEvent.press(editor.getByRole('button', { name: 'Cancel' }))

    expect(alert).not.toHaveBeenCalled()
    expect(await screen.findByTestId('observation-detail')).toBeTruthy()
  })
})
