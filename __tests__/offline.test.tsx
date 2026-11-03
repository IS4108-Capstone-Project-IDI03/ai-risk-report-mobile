// MB-10: offline capture. The gateway is mocked and `online` switches every
// route to "can't reach the server". expo-file-system is the in-memory copy in
// test/setup.ts, cleared before each test, so what the app keeps on the phone
// lasts across remounts within one test only.
import * as FileSystem from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library'
import { router } from 'expo-router'
import { Alert, AppState, type AppStateStatus } from 'react-native'
import {
  assessment,
  engineer,
  location,
  mockGateway,
  observation,
  pointAtTestGateway,
  routes,
  signedIn,
  type Reply,
} from '../test/gateway'

pointAtTestGateway()

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>
const files = (FileSystem as unknown as { __files: Map<string, string> }).__files

// Node's FormData turns React Native's { uri, name, type } files into text, so
// the tests record what's appended instead (as capture.test.tsx does).
class RecordingFormData {
  parts: [string, unknown][] = []
  append(key: string, value: unknown) {
    this.parts.push([key, value])
  }
}
const realFormData = globalThis.FormData

// The app comes to the front: one of MB-10 AC4's upload triggers.
let appState: (state: AppStateStatus) => void = () => {}
beforeEach(() => {
  globalThis.FormData = RecordingFormData as unknown as typeof FormData
  online = true
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appState = handler as typeof appState
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>
  })
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse)
  picker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///cache/photo-1.jpg', mimeType: 'image/jpeg', fileName: null }],
  } as never)
})
afterAll(() => {
  globalThis.FormData = realFormData
})

const REF = 'RPT-2026-0411'
const LEEDS = 'RPT-2026-0408'
const pump = location('l1', 'Pump room')
const OFFLINE = "You're offline. Showing what was saved on this device."

let online = true
type Route = Reply | ((init?: RequestInit) => Reply)

// Every route fails while offline; `overrides` add or replace routes.
function gateway(overrides: Record<string, Route> = {}) {
  const table: Record<string, Route> = {
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': {
      status: 200,
      body: [
        assessment(REF, 'capturing'),
        assessment(LEEDS, 'capturing', { site: { id: 's3', code: 'S-003', name: 'Leeds Cold Store', address: null } }),
      ],
    },
    [`GET /api/assessments/${REF}/observations`]: {
      status: 200,
      body: [observation('o1', 'l1', { note: 'Valve chained open' })],
    },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [pump] },
    [`POST /api/assessments/${REF}/capture-session`]: { status: 200, body: {} },
    ...overrides,
  }
  return mockGateway(
    Object.fromEntries(
      Object.entries(table).map(([key, route]) => [
        key,
        (init?: RequestInit) =>
          online ? (typeof route === 'function' ? route(init) : route) : new TypeError('Network request failed'),
      ]),
    ),
  )
}

// Closes the app and opens it again: everything in memory is gone.
async function restart() {
  await screen.unmount()
  await renderRouter(routes)
}

async function openWorkspace(reference = REF) {
  await fireEvent.press(await screen.findByText(reference))
  await screen.findByTestId('workspace')
}

async function chooseLocation(name: string) {
  await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Change/ }))
  await fireEvent.press(await screen.findByRole('button', { name }))
}

const sheet = () => within(screen.getByTestId('capture-sheet'))

// From a workspace with a location chosen: a note, a photo and a severity.
async function captureAndSave(note: string) {
  await fireEvent.press(await screen.findByRole('button', { name: 'New observation' }))
  await screen.findByTestId('capture-sheet')
  await fireEvent.changeText(sheet().getByLabelText('Note'), note)
  await fireEvent.press(sheet().getByRole('button', { name: 'Take photo' }))
  await fireEvent.press(sheet().getByRole('button', { name: 'High' }))
  await fireEvent.press(sheet().getByRole('button', { name: 'Save observation' }))
}

async function addLocationOffline(name: string) {
  await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Change/ }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Add location' }))
  await fireEvent.changeText(screen.getByLabelText('Name'), name)
  await fireEvent.press(screen.getByRole('button', { name: 'Save location' }))
}

const posted = (fetchMock: jest.Mock, path: string) =>
  fetchMock.mock.calls.filter(([url, init]) => init?.method === 'POST' && new URL(url).pathname === path)

it('opens the last copy with no signal, and says so (AC1)', async () => {
  gateway()
  await renderRouter(routes)
  await openWorkspace()
  await chooseLocation('Pump room')
  expect(await screen.findByText('Valve chained open')).toBeTruthy()

  online = false
  await restart()

  // The launch check can't reach the gateway, so the last engineer carries on.
  expect(await screen.findByText(REF)).toBeTruthy()
  expect(screen.getByText(OFFLINE)).toBeTruthy()
  await openWorkspace()
  await chooseLocation('Pump room')
  expect(await screen.findByText('Valve chained open')).toBeTruthy()

  // Never opened online: nothing to show.
  await act(() => router.back())
  await fireEvent.press(await screen.findByText(LEEDS))
  expect(await screen.findByText(/Can't reach the server/)).toBeTruthy()
})

it('queues an observation saved with no signal, with its files kept (AC2)', async () => {
  gateway()
  await renderRouter(routes)
  await openWorkspace()
  await chooseLocation('Pump room')

  online = false
  await captureAndSave('Fire door wedged open')

  expect(await screen.findByText('Fire door wedged open')).toBeTruthy()
  expect(screen.queryByTestId('capture-sheet')).toBeNull()
  expect(screen.getByText('Waiting to upload')).toBeTruthy()
  // Copied out of the camera's cache into the app's own folder.
  expect([...files.keys()].some((k) => k.includes(`/users/${engineer.id}/queue/`) && k.endsWith('photo-1.jpg'))).toBe(
    true,
  )
})

it('adds a location with no signal, chosen and ready to capture into (AC3)', async () => {
  gateway()
  await renderRouter(routes)
  await openWorkspace()

  online = false
  await addLocationOffline('Loading bay')

  expect(await screen.findByText(/Loading bay/)).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: /Change$/ }))
  const row = await screen.findByRole('button', { name: 'Loading bay' })
  expect(row.props.accessibilityState).toMatchObject({ selected: true })
  expect(within(row).getByText('Waiting to upload')).toBeTruthy()
  await act(() => router.back())

  await fireEvent.press(await screen.findByRole('button', { name: 'New observation' }))
  expect(await sheet().findByText(/Loading bay/)).toBeTruthy()
})

it('uploads the location first, then its observation under the real ID (AC4)', async () => {
  let saved = false
  const fetchMock = gateway({
    [`POST /api/assessments/${REF}/locations`]: { status: 201, body: location('l9', 'Loading bay') },
    [`POST /api/assessments/${REF}/observations`]: () => {
      saved = true
      return { status: 201, body: observation('o2', 'l9') }
    },
    [`GET /api/assessments/${REF}/observations`]: () => ({
      status: 200,
      body: saved ? [observation('o2', 'l9', { note: 'Pallets blocking exit' })] : [],
    }),
  })
  await renderRouter(routes)
  await openWorkspace()
  online = false
  await addLocationOffline('Loading bay')
  await captureAndSave('Pallets blocking exit')
  expect(await screen.findByText('Waiting to upload')).toBeTruthy()

  // Only what's sent once the signal is back.
  fetchMock.mockClear()
  online = true
  await act(async () => appState('active'))

  await screen.findByText('Pallets blocking exit')
  expect(screen.queryByText('Waiting to upload')).toBeNull()
  const order = fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([url]) => new URL(url).pathname.split('/').pop())
  expect(order).toEqual(['locations', 'capture-session', 'observations'])
  const form = posted(fetchMock, `/api/assessments/${REF}/observations`)[0][1].body as unknown as RecordingFormData
  expect(JSON.parse(String(form.parts.find(([k]) => k === 'details')![1])).locationId).toBe('l9')
  // Uploaded, so its copied files are gone.
  expect([...files.keys()].some((k) => k.includes('/queue/'))).toBe(false)
})

it('keeps the queue through a restart, for the engineer who made it only (AC5, AC7)', async () => {
  const saved = { status: 201, body: observation('o2', 'l1') }
  gateway({ [`POST /api/assessments/${REF}/observations`]: saved })
  await renderRouter(routes)
  await openWorkspace()
  await chooseLocation('Pump room')
  online = false
  await captureAndSave('Fire door wedged open')
  await screen.findByText('Waiting to upload')

  // Restarted with no signal: still there, for the same engineer.
  const offline = gateway({ [`POST /api/assessments/${REF}/observations`]: saved })
  await restart()
  expect(await screen.findByText('1 waiting to upload')).toBeTruthy()
  expect(posted(offline, `/api/assessments/${REF}/observations`)).toHaveLength(0)

  // Signal back, but someone else signs in on this phone: theirs is empty,
  // and the first engineer's isn't uploaded under their session.
  online = true
  const other = gateway({
    'GET /api/auth/me': { status: 200, body: { ...signedIn.body, user: { ...engineer, id: 'u2', name: 'Ben Lim' } } },
    [`POST /api/assessments/${REF}/observations`]: saved,
  })
  await restart()
  await screen.findByText(REF)
  expect(screen.queryByText('1 waiting to upload')).toBeNull()
  expect(posted(other, `/api/assessments/${REF}/observations`)).toHaveLength(0)

  // The engineer who made it signs back in: it uploads.
  const back = gateway({ [`POST /api/assessments/${REF}/observations`]: saved })
  await restart()
  await screen.findByText(REF)
  await act(async () => {})
  expect(posted(back, `/api/assessments/${REF}/observations`)).toHaveLength(1)
  expect(screen.queryByText('1 waiting to upload')).toBeNull()
})

it('uses the listed location when a queued one is already there (AC6)', async () => {
  const listed = location('l7', 'Loading bay')
  let added = false
  const fetchMock = gateway({
    [`POST /api/assessments/${REF}/locations`]: () => {
      added = true
      return { status: 409, body: { error: 'That location is already listed.' } }
    },
    [`GET /api/assessments/${REF}/locations`]: () => ({ status: 200, body: added ? [pump, listed] : [pump] }),
    [`POST /api/assessments/${REF}/observations`]: { status: 201, body: observation('o2', 'l7') },
  })
  await renderRouter(routes)
  await openWorkspace()
  online = false
  await addLocationOffline('Loading bay')
  await captureAndSave('Pallets blocking exit')

  online = true
  await act(async () => appState('active'))
  await act(async () => {})

  const form = posted(fetchMock, `/api/assessments/${REF}/observations`)[0][1].body as unknown as RecordingFormData
  expect(JSON.parse(String(form.parts.find(([k]) => k === 'details')![1])).locationId).toBe('l7')
})

it("marks a refused observation with the gateway's words, and discards it (AC6, AC7)", async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === 'Discard')?.onPress?.()
  })
  gateway({
    [`POST /api/assessments/${REF}/observations`]: {
      status: 409,
      body: { error: 'This assessment is archived, so nothing can be added to it.' },
    },
  })
  await renderRouter(routes)
  await openWorkspace()
  await chooseLocation('Pump room')
  online = false
  await captureAndSave('Fire door wedged open')

  online = true
  await act(async () => appState('active'))

  expect(await screen.findByText("Couldn't upload: This assessment is archived, so nothing can be added to it.")).toBeTruthy()
  await act(() => router.back())
  expect(await screen.findByText("1 couldn't upload")).toBeTruthy()
  await openWorkspace()

  await fireEvent.press(await screen.findByRole('button', { name: 'Discard' }))
  expect(alert).toHaveBeenCalled()
  expect(screen.queryByText('Fire door wedged open')).toBeNull()
  expect([...files.keys()].some((k) => k.includes('/queue/'))).toBe(false)
})

it("drops a refused location, and its observation says why (AC6)", async () => {
  gateway({
    [`POST /api/assessments/${REF}/locations`]: {
      status: 400,
      body: { error: 'The location details are invalid.', fields: { name: 'Use 120 characters or fewer.' } },
    },
  })
  await renderRouter(routes)
  await openWorkspace()
  online = false
  await addLocationOffline('Loading bay')
  await captureAndSave('Pallets blocking exit')

  online = true
  await act(async () => appState('active'))

  expect(
    await screen.findByText("Couldn't upload: Its location, Loading bay, couldn't be added: Use 120 characters or fewer."),
  ).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy()
})

it('keeps waiting when the gateway itself fails (AC4)', async () => {
  gateway({ [`POST /api/assessments/${REF}/observations`]: { status: 503, body: { error: 'Try again shortly.' } } })
  await renderRouter(routes)
  await openWorkspace()
  await chooseLocation('Pump room')
  online = false
  await captureAndSave('Fire door wedged open')

  online = true
  await act(async () => appState('active'))
  await act(async () => {})

  expect(screen.getByText('Waiting to upload')).toBeTruthy()
})
