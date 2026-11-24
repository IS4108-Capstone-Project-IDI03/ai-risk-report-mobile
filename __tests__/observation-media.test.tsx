// MB-12 AC16-AC21: the photos, voice notes and handwritten pages (media) inside a saved
// observation, on the edit screen. Renders the real routes with the gateway, camera,
// photo library and recorder mocked, so nothing reaches a server or a paid service.
import * as ImagePicker from 'expo-image-picker'
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

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}))

// A recorder that "records" 42 seconds into a file.
const mockRecorder = {
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(),
  stop: jest.fn(async () => {}),
  uri: 'file:///cache/recording-9.m4a',
}
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => ({ isRecording: true, durationMillis: 42_000 }),
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn(), replace: jest.fn(), seekTo: jest.fn() }),
  useAudioPlayerStatus: () => ({ playing: false }),
}))

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>
const granted = { granted: true } as ImagePicker.PermissionResponse
const shot = (uri: string) => ({ canceled: false, assets: [{ uri, mimeType: 'image/jpeg', fileName: null }] }) as never

// Node's FormData turns React Native's { uri, name, type } files into text, so the
// tests record what is appended instead.
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
const NETWORK = new TypeError('Network request failed')
const STAIRCASE = { id: 'l1', building: 'Block B', floor: 'Level 2', name: 'Staircase' }
const stamp = { at: '2026-04-11T03:00:00.000Z', by: { id: 'u2', name: 'Sam Lee' } }
const path = (kind: string, id: string) => `/api/observations/o1/${kind}/${id}`

// One observation with a photo, a transcribed and a transcribing voice note, and a page.
const withMedia = (extra: object = {}) =>
  observation('o1', 'l1', {
    note: 'Valve chained open',
    severity: 'high',
    copeDimensions: ['Protection'],
    location: STAIRCASE,
    photos: [{ id: 'p1', url: path('photos', 'p1') + '/image' }],
    recordings: [
      { id: 'r1', url: path('recordings', 'r1') + '/audio', transcription: { status: 'transcribed', transcript: 'Valve four shut', error: null } },
      { id: 'r2', url: path('recordings', 'r2') + '/audio', transcription: { status: 'transcribing', transcript: null, error: null } },
    ],
    pages: [{ id: 'g1', url: path('pages', 'g1') + '/image', transcription: { status: 'transcribed', transcript: 'Riser 2', error: null } }],
    removedPhotos: [],
    removedRecordings: [],
    ...extra,
  })

let current: object
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
  await fireEvent.press(await screen.findByRole('button', { name: /Staircase/ }))
  await fireEvent.press((await screen.findAllByTestId('observation-open'))[0])
  const detail = within(await screen.findByTestId('observation-detail'))
  await fireEvent.press(detail.getByRole('button', { name: 'Edit observation' }))
  return within(await screen.findByTestId('observation-edit'))
}

// Answers the confirmation by pressing the button with this label.
const answer = (label: string) =>
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.()
  })

const sent = (fetchMock: jest.Mock, method: string, urlEnd: string) =>
  fetchMock.mock.calls.filter(([url, init]) => url.endsWith(urlEnd) && (init?.method ?? 'GET') === method)

beforeEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  globalThis.FormData = RecordingFormData as unknown as typeof FormData
  picker.requestCameraPermissionsAsync.mockResolvedValue(granted)
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted)
  current = withMedia()
})

describe('media', () => {
  it('lists photos, voice notes and pages, each with Remove (AC16; pages too since MB-17, 17 Nov)', async () => {
    gateway()
    const editor = await openEditor()
    const media = within(editor.getByTestId('media'))

    expect(media.getByText('Photo 1')).toBeTruthy()
    expect(media.getByText('Voice note 1')).toBeTruthy()
    expect(media.getByText('Transcribed')).toBeTruthy()
    expect(media.getByText('Transcribing')).toBeTruthy()
    expect(media.getByText('Handwritten page 1')).toBeTruthy()
    expect(media.getByRole('button', { name: 'Remove photo 1' })).toBeTruthy()
    expect(media.getByRole('button', { name: 'Remove voice note 2' })).toBeTruthy()
    // The web's CP-20 (on main) removes pages too.
    expect(media.getByRole('button', { name: 'Remove handwritten page 1' })).toBeTruthy()
  })

  it('removes a photo after confirming, and lists it under Removed (AC17)', async () => {
    const alert = answer('Remove')
    const fetchMock = gateway({
      [`DELETE ${path('photos', 'p1')}`]: () => {
        current = withMedia({ photos: [], removedPhotos: [{ id: 'p1', url: path('photos', 'p1') + '/image', removed: stamp }] })
        return { status: 200, body: current }
      },
    })
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Remove photo 1' }))

    expect(alert).toHaveBeenCalledWith('Remove this photo?', expect.stringContaining('restored'), expect.any(Array))
    expect(await editor.findByText(/Removed by Sam Lee/)).toBeTruthy()
    expect(editor.queryByRole('button', { name: 'Remove photo 1' })).toBeNull()
    expect(sent(fetchMock, 'DELETE', path('photos', 'p1'))).toHaveLength(1)
  })

  it('keeps it when you choose Keep (AC17)', async () => {
    answer('Keep')
    const fetchMock = gateway()
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Remove voice note 1' }))

    expect(sent(fetchMock, 'DELETE', path('recordings', 'r1'))).toHaveLength(0)
    expect(editor.getByText('Voice note 1')).toBeTruthy()
  })

  it("shows the gateway's refusal when removing would leave nothing, and changes nothing (AC18)", async () => {
    answer('Remove')
    gateway({
      [`DELETE ${path('photos', 'p1')}`]: {
        status: 409,
        body: { error: 'An observation needs a note, a recording, a photo or a page, so this photo can’t be removed. Add what replaces it first.' },
      },
    })
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Remove photo 1' }))

    expect(await editor.findByText(/so this photo can’t be removed/)).toBeTruthy()
    expect(editor.getByRole('button', { name: 'Remove photo 1' })).toBeTruthy()
  })

  it('restores a removed voice note (AC19)', async () => {
    current = withMedia({
      recordings: [],
      removedRecordings: [{ id: 'r1', url: path('recordings', 'r1') + '/audio', removed: stamp }],
    })
    const fetchMock = gateway({
      [`POST ${path('recordings', 'r1')}/restore`]: () => {
        current = withMedia({ recordings: [{ id: 'r1', url: path('recordings', 'r1') + '/audio', transcription: { status: 'transcribed', transcript: 'back', error: null } }] })
        return { status: 200, body: current }
      },
    })
    const editor = await openEditor()
    expect(editor.getByText(/Removed by Sam Lee/)).toBeTruthy()

    await fireEvent.press(editor.getByRole('button', { name: 'Restore voice note 1' }))

    expect(await editor.findByRole('button', { name: 'Remove voice note 1' })).toBeTruthy()
    expect(editor.queryByText(/Removed by Sam Lee/)).toBeNull()
    expect(sent(fetchMock, 'POST', `${path('recordings', 'r1')}/restore`)).toHaveLength(1)
  })

  it('stages a photo from the library, and uploads it only when I save (AC20)', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue(shot('file:///cache/new-photo.jpg'))
    const fetchMock = gateway({
      [`POST /api/observations/o1/media`]: () => {
        current = withMedia({
          photos: [
            { id: 'p1', url: path('photos', 'p1') + '/image' },
            { id: 'p2', url: path('photos', 'p2') + '/image' },
          ],
        })
        return { status: 200, body: current }
      },
    })
    const editor = await openEditor()
    expect(editor.getByRole('button', { name: 'Save changes' }).props.accessibilityState.disabled).toBe(true)

    await fireEvent.press(editor.getByRole('button', { name: 'Add photo from library' }))

    expect(await editor.findByText('New photo 1')).toBeTruthy()
    // Nothing is sent until Save, and Save is now available.
    expect(sent(fetchMock, 'POST', '/api/observations/o1/media')).toHaveLength(0)
    expect(editor.getByRole('button', { name: 'Save changes' }).props.accessibilityState.disabled).toBe(false)

    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(sent(fetchMock, 'POST', '/api/observations/o1/media')).toHaveLength(1))
    const [post] = sent(fetchMock, 'POST', '/api/observations/o1/media')
    expect((post[1]!.body as unknown as RecordingFormData).parts.map(([key]) => key)).toEqual(['photo'])
    expect(await screen.findByTestId('observation-detail')).toBeTruthy()
  })

  it('stages a voice note, which is uploaded and transcribed only when I save (AC20)', async () => {
    const fetchMock = gateway({ [`POST /api/observations/o1/media`]: { status: 200, body: withMedia() } })
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Record voice note' }))
    await fireEvent.press(await editor.findByRole('button', { name: 'Stop recording' }))

    expect(await editor.findByText('New voice note 1')).toBeTruthy()
    expect(sent(fetchMock, 'POST', '/api/observations/o1/media')).toHaveLength(0)

    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(sent(fetchMock, 'POST', '/api/observations/o1/media')).toHaveLength(1))
    expect((sent(fetchMock, 'POST', '/api/observations/o1/media')[0][1]!.body as unknown as RecordingFormData).parts.map(([key]) => key)).toEqual(['recording'])
  })

  it('discards a staged photo without sending anything, and Save goes off again (AC20)', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue(shot('file:///cache/new-photo.jpg'))
    const fetchMock = gateway()
    const editor = await openEditor()
    await fireEvent.press(editor.getByRole('button', { name: 'Add photo from library' }))
    await editor.findByText('New photo 1')

    await fireEvent.press(editor.getByRole('button', { name: 'Discard new photo 1' }))

    expect(editor.queryByText('New photo 1')).toBeNull()
    expect(editor.getByRole('button', { name: 'Save changes' }).props.accessibilityState.disabled).toBe(true)
    expect(sent(fetchMock, 'POST', '/api/observations/o1/media')).toHaveLength(0)
  })

  it('asks before throwing away a staged photo (AC6)', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue(shot('file:///cache/new-photo.jpg'))
    gateway()
    const editor = await openEditor()
    await fireEvent.press(editor.getByRole('button', { name: 'Add photo from library' }))
    await editor.findByText('New photo 1')
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    await fireEvent.press(editor.getByRole('button', { name: 'Cancel' }))

    expect(alert).toHaveBeenCalledWith('Discard your changes?', expect.any(String), expect.any(Array))
  })

  it('saves the tag change first; if the media then fails the change stays saved, and saying so, a second Save sends only the media (AC21)', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue(shot('file:///cache/huge.jpg'))
    let posts = 0
    const fetchMock = gateway({
      'PATCH /api/observations/o1': () => {
        current = withMedia({ severity: 'low' })
        return { status: 200, body: current }
      },
      [`POST /api/observations/o1/media`]: () =>
        ++posts === 1
          ? { status: 413, body: { error: 'The recordings, photos and pages are larger than 100 MB in total. Save fewer at once.' } }
          : { status: 200, body: current },
    })
    const editor = await openEditor()
    await fireEvent.press(editor.getByRole('button', { name: 'Low' }))
    await fireEvent.press(editor.getByRole('button', { name: 'Add photo from library' }))
    await editor.findByText('New photo 1')

    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    expect(await editor.findByText(/Your changes were saved, but the new photos and voice notes weren't added: The recordings, photos and pages are larger than 100 MB/)).toBeTruthy()
    // The photo is still waiting, and Save is still available for it.
    expect(editor.getByText('New photo 1')).toBeTruthy()

    await fireEvent.press(editor.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(posts).toBe(2))
    expect(sent(fetchMock, 'PATCH', '/api/observations/o1')).toHaveLength(1)
  })

  it("says it can't reach the server when a remove is lost to the signal, and the list stays (AC21)", async () => {
    answer('Remove')
    gateway({ [`DELETE ${path('photos', 'p1')}`]: NETWORK })
    const editor = await openEditor()

    await fireEvent.press(editor.getByRole('button', { name: 'Remove photo 1' }))

    await waitFor(() => expect(editor.getByText("Can't reach the server. Check your connection, then try again.")).toBeTruthy())
    expect(editor.getByRole('button', { name: 'Remove photo 1' })).toBeTruthy()
  })
})
