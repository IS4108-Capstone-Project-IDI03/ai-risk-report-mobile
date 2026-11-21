// MB-17 (added 17 Nov): add, remove and restore handwritten pages on the Edit screen, as the web's CP-20 does
// (gateway: POST .../media with `page` parts, DELETE .../pages/:id, POST .../pages/:id/restore). A photo, voice note or page
// can be removed only while the observation holds something else, counting its note (the web's `capturedCount(o) > 1`).
// Real routes, gateway, camera and photo library mocked.
import * as ImagePicker from 'expo-image-picker'
import { Alert } from 'react-native'
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, observation, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

pointAtTestGateway()

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}))
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => ({}),
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0 }),
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn(),
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn(), replace: jest.fn(), seekTo: jest.fn(), currentTime: 0, duration: 0 }),
  useAudioPlayerStatus: () => ({ playing: false }),
}))

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>
const granted = { granted: true } as ImagePicker.PermissionResponse
const shot = (uri: string) => ({ canceled: false, assets: [{ uri, mimeType: 'image/jpeg', fileName: null }] }) as never

// Node's FormData turns React Native's { uri, name, type } files into text, so the tests record what is appended.
class RecordingFormData {
  parts: [string, unknown][] = []
  append(key: string, value: unknown) {
    this.parts.push([key, value])
  }
}
const realFormData = globalThis.FormData
afterAll(() => {
  globalThis.FormData = realFormData
})

const REF = 'RPT-2026-0411'
const STAIRCASE = { id: 'l1', building: 'Block B', floor: 'Level 2', name: 'Staircase' }
const stamp = { at: '2026-04-11T03:00:00.000Z', by: { id: 'u2', name: 'Sam Lee' } }
const path = (id: string) => `/api/observations/o1/pages/${id}`
const read = (transcript: string) => ({ status: 'transcribed', transcript, error: null })
const page = (id: string, transcript = 'Riser 2') => ({ id, url: path(id) + '/image', transcription: read(transcript) })

// What the gateway holds: an observation with a note and two pages, unless a test changes it.
let current: object
const held = (extra: object = {}) =>
  observation('o1', 'l1', { note: 'Valve', location: STAIRCASE, pages: [page('g1'), page('g2', 'Riser 3')], removedPages: [], ...extra })

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Staircase', 'Block B', 'Level 2')] },
    [`GET /api/assessments/${REF}/observations`]: () => ({ status: 200, body: [current] }),
    ...overrides,
  })
}

async function openEditor() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
  await fireEvent.press(await screen.findByRole('button', { name: /^Staircase/ }))
  await fireEvent.press((await screen.findAllByTestId('observation-open'))[0])
  const detail = within(await screen.findByTestId('observation-detail'))
  await fireEvent.press(await detail.findByRole('button', { name: 'Edit observation' }))
  return within(await screen.findByTestId('observation-edit'))
}
const answer = (label: string) =>
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === label)?.onPress?.())
const sent = (fetchMock: jest.Mock, method: string, urlEnd: string) =>
  fetchMock.mock.calls.filter(([url, init]) => url.endsWith(urlEnd) && (init?.method ?? 'GET') === method)

beforeEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  globalThis.FormData = RecordingFormData as unknown as typeof FormData
  picker.requestCameraPermissionsAsync.mockResolvedValue(granted)
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted)
  current = held()
})

describe('remove and restore a page (AC16, AC18)', () => {
  it('removes a page after asking, and lists it under Removed (AC16)', async () => {
    const alert = answer('Remove')
    const fetchMock = gateway({
      [`DELETE ${path('g1')}`]: () => {
        current = held({ pages: [page('g2', 'Riser 3')], removedPages: [{ ...page('g1'), removed: stamp }] })
        return { status: 200, body: current }
      },
    })
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Remove handwritten page 1' }))

    expect(alert).toHaveBeenCalledWith('Remove this page?', expect.stringContaining('can be restored'), expect.any(Array))
    expect(await editor.findByText(/Page · Removed by Sam Lee/)).toBeTruthy()
    expect(sent(fetchMock, 'DELETE', path('g1'))).toHaveLength(1)
    // Only one page is left, with the note, so it can still be removed.
    expect(editor.getByRole('button', { name: 'Remove handwritten page 1' })).toBeTruthy()
    expect(editor.queryByText('Handwritten page 2')).toBeNull()
  })

  it('restores a removed page (AC18)', async () => {
    current = held({ pages: [page('g2', 'Riser 3')], removedPages: [{ ...page('g1'), removed: stamp }] })
    const fetchMock = gateway({
      [`POST ${path('g1')}/restore`]: () => {
        current = held()
        return { status: 200, body: current }
      },
    })
    const editor = await openEditor()

    await fireEvent.press(await editor.findByRole('button', { name: 'Restore page 1' }))

    expect(await editor.findByText('Handwritten page 2')).toBeTruthy()
    expect(sent(fetchMock, 'POST', `${path('g1')}/restore`)).toHaveLength(1)
    expect(editor.queryByText(/Removed by Sam Lee/)).toBeNull()
  })

  it("shows the gateway's reason when it refuses, and the page stays (AC20)", async () => {
    answer('Remove')
    gateway({
      [`DELETE ${path('g1')}`]: { status: 409, body: { error: 'This observation is archived.' } },
    })
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Remove handwritten page 1' }))

    expect(await editor.findByText('This observation is archived.')).toBeTruthy()
    expect(editor.getByText('Handwritten page 1')).toBeTruthy()
  })

  it('does nothing when I keep it (AC16)', async () => {
    answer('Keep')
    const fetchMock = gateway()
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Remove handwritten page 1' }))

    expect(sent(fetchMock, 'DELETE', path('g1'))).toHaveLength(0)
  })
})

describe('the only thing left (AC17)', () => {
  it('offers no Remove on a page that is all the observation holds, and says why', async () => {
    current = held({ note: null, pages: [page('g1')] })
    gateway()
    const editor = await openEditor()

    await editor.findByText('Handwritten page 1')
    expect(editor.queryByRole('button', { name: /^Remove/ })).toBeNull()
    expect(editor.getByText('This is all the observation holds. Add something first, or delete the observation.')).toBeTruthy()
  })

  it('offers no Remove on a lone photo with no note either', async () => {
    current = held({ note: null, pages: [], photos: [{ id: 'p1', url: '/api/observations/o1/photos/p1/image' }] })
    gateway()
    const editor = await openEditor()

    await editor.findByText('Photo 1')
    expect(editor.queryByRole('button', { name: /^Remove/ })).toBeNull()
  })

  it('counts the note: a note with one page leaves Remove on the page', async () => {
    current = held({ note: 'Valve', pages: [page('g1')] })
    gateway()
    const editor = await openEditor()

    expect(await editor.findByRole('button', { name: 'Remove handwritten page 1' })).toBeTruthy()
    expect(editor.queryByText(/This is all the observation holds/)).toBeNull()
  })
})

describe('add a page (AC19)', () => {
  it('stages a page from the library, and sends it only when I save', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue(shot('file:///cache/page-3.jpg'))
    const fetchMock = gateway({
      'POST /api/observations/o1/media': () => {
        current = held({ pages: [page('g1'), page('g2', 'Riser 3'), { id: 'g3', url: path('g3') + '/image', transcription: { status: 'transcribing', transcript: null, error: null } }] })
        return { status: 200, body: current }
      },
    })
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Add scan from library' }))

    expect(await editor.findByText('New page 1')).toBeTruthy()
    expect(sent(fetchMock, 'POST', '/api/observations/o1/media')).toHaveLength(0)
    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(sent(fetchMock, 'POST', '/api/observations/o1/media')).toHaveLength(1))
    const [post] = sent(fetchMock, 'POST', '/api/observations/o1/media')
    expect((post[1]!.body as unknown as RecordingFormData).parts.map(([key]) => key)).toEqual(['page'])
  })

  it('takes a page with the camera, and Discard drops it without sending anything', async () => {
    picker.launchCameraAsync.mockResolvedValue(shot('file:///cache/page-4.jpg'))
    const fetchMock = gateway()
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Scan handwritten notes' }))
    expect(await editor.findByText('New page 1')).toBeTruthy()
    await fireEvent.press(editor.getByRole('button', { name: 'Discard new page 1' }))

    expect(editor.queryByText('New page 1')).toBeNull()
    expect(sent(fetchMock, 'POST', '/api/observations/o1/media')).toHaveLength(0)
    expect(editor.getByRole('button', { name: 'Save changes' }).props.accessibilityState.disabled).toBe(true)
  })

  it('says why and keeps the staged page when the upload fails', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue(shot('file:///cache/page-3.jpg'))
    gateway({ 'POST /api/observations/o1/media': { status: 400, body: { error: 'A page must be a JPG or PNG.' } } })
    const editor = await openEditor()
    await fireEvent.press(editor.getByRole('button', { name: 'Add scan from library' }))
    await editor.findByText('New page 1')

    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    expect(await editor.findByText('A page must be a JPG or PNG.')).toBeTruthy()
    expect(editor.getByText('New page 1')).toBeTruthy()
  })
})
