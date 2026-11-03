// MB-11: open an observation from the workspace to read all of it. Renders the
// real routes with the gateway mocked; each test opens the workspace from Home,
// chooses the location, and taps an observation.
import * as FileSystem from 'expo-file-system'
import { router } from 'expo-router'
import { AppState, type AppStateStatus } from 'react-native'
import { act, fireEvent, renderRouter, screen, testRouter, waitFor, within } from 'expo-router/testing-library'
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

// The player does nothing in Jest; the test checks what it was told to play.
const mockPlayer = { play: jest.fn(), pause: jest.fn(), replace: jest.fn(), seekTo: jest.fn(), currentTime: 0, duration: 0 }
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => ({}),
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0 }),
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn(),
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => ({ playing: false }),
}))

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const STAIRCASE = { id: 'l1', building: 'Block B', floor: 'Level 2', name: 'Staircase' }

// The gateway for one workspace; a test overrides any route it cares about.
function gateway(observations: object[], overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: {
      status: 200,
      body: [location('l1', 'Staircase', 'Block B', 'Level 2')],
    },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: observations },
    ...overrides,
  })
}

const files = (FileSystem as unknown as { __files: Map<string, string> }).__files

// An observation saved with no signal (MB-10), put on the phone as the app
// leaves it: queue.json, and its files in queue/<id>/. `error` is set once the
// gateway has refused it.
function queueOnPhone(error?: string) {
  const owner = 'file:///document/users/u1'
  files.set(
    `${owner}/queue.json`,
    JSON.stringify([
      {
        kind: 'observation',
        id: 'q1',
        reference: REF,
        locationId: 'l1',
        draft: {
          photos: ['photo-0.jpg'],
          pages: [],
          recordings: [{ uri: 'recording-0.m4a', durationMillis: 2000 }],
          note: 'Queued note, nothing uploaded',
          cope: ['Protection'],
          severity: 'high',
        },
        savedAt: '2026-04-11T02:00:00.000Z',
        ...(error && { error }),
      },
    ]),
  )
  files.set(`${owner}/queue/q1/photo-0.jpg`, 'photo')
  files.set(`${owner}/queue/q1/recording-0.m4a`, 'audio')
}

// Home, the workspace, the location chosen: the observations list shows.
async function openWorkspace() {
  await renderRouter(routes)
  await chooseStaircase()
}

async function chooseStaircase() {
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
  await fireEvent.press(await screen.findByRole('button', { name: /Staircase/ }))
}

// Opens the first card in the list.
async function openObservation() {
  await fireEvent.press((await screen.findAllByTestId('observation-open'))[0])
  return screen.findByTestId('observation-detail')
}

beforeEach(() => {
  Object.assign(mockPlayer, { currentTime: 0, duration: 0 })
  ;[mockPlayer.play, mockPlayer.pause, mockPlayer.replace, mockPlayer.seekTo].forEach((fn) => fn.mockClear())
})

describe('observation detail', () => {
  it('opens from the workspace with the whole observation, and goes back (AC1, AC2)', async () => {
    gateway([
      observation('o1', 'l1', {
        note: 'Sprinkler valve chained open\nSecond floor, east riser.',
        severity: 'high',
        copeDimensions: ['Protection', 'Exposure'],
        engineer: 'Ava Tan',
        location: STAIRCASE,
      }),
    ])
    await openWorkspace()

    const detail = within(await openObservation())

    // The card cuts the note to two lines; the detail shows all of it.
    expect(detail.getByText(/Sprinkler valve chained open/)).toBeTruthy()
    expect(detail.getByText(/Second floor, east riser\./)).toBeTruthy()
    expect(detail.getByText('High')).toBeTruthy()
    expect(detail.getByText('Protection · Exposure')).toBeTruthy()
    expect(detail.getByText('Block B · Level 2 · Staircase')).toBeTruthy()
    expect(detail.getByText(/Ava Tan/)).toBeTruthy()

    await testRouter.back()
    expect(await screen.findByTestId('workspace')).toBeTruthy()
    expect(screen.queryByTestId('observation-detail')).toBeNull()
  })

  it('shows photos and handwritten pages with their transcripts (AC3)', async () => {
    const url = (kind: string, id: string) => `/api/observations/o1/${kind}/${id}/image`
    gateway([
      observation('o1', 'l1', {
        photos: [
          { id: 'p1', name: 'Photo 1.jpg', url: url('photos', 'p1') },
          { id: 'p2', name: 'Photo 2.jpg', url: url('photos', 'p2') },
        ],
        pages: [
          { id: 'g1', url: url('pages', 'g1'), transcription: { status: 'transcribed', transcript: 'Valve 4 shut', error: null } },
          { id: 'g2', url: url('pages', 'g2'), transcription: { status: 'transcribing', transcript: null, error: null } },
          { id: 'g3', url: url('pages', 'g3'), transcription: { status: 'failed', transcript: null, error: 'The page is too dark.' } },
        ],
      }),
    ])
    await openWorkspace()

    const detail = within(await openObservation())

    // Full width, from the gateway behind the session cookie.
    const photos = detail.getAllByTestId('detail-photo')
    expect(photos).toHaveLength(2)
    expect(photos[0].props.source.uri).toMatch(/\/api\/observations\/o1\/photos\/p1\/image$/)
    expect(detail.getAllByTestId('detail-page')).toHaveLength(3)
    expect(detail.getByText('Valve 4 shut')).toBeTruthy()
    expect(detail.getByText('Reading the handwriting')).toBeTruthy()
    expect(detail.getByText("Couldn't read: The page is too dark.")).toBeTruthy()
  })

  it('plays voice notes and shows each transcript status (AC4)', async () => {
    const audio = (id: string) => `/api/observations/o1/recordings/${id}/audio`
    const gone = { status: 'transcribed' as const, error: null }
    gateway(
      [
        observation('o1', 'l1', {
          recordings: [
            { id: 'r1', url: audio('r1'), transcription: { ...gone, transcript: 'raw words', correction: { text: 'corrected words' } } },
            { id: 'r2', url: audio('r2'), transcription: { status: 'transcribing', transcript: null, error: null } },
            { id: 'r3', url: audio('r3'), transcription: { status: 'failed', transcript: null, error: 'The recording is silent.' } },
          ],
        }),
      ],
      { 'GET /api/observations/o1/recordings/r1/audio': { status: 200, body: '' } },
    )
    await openWorkspace()

    const detail = within(await openObservation())

    // A correction made on the web replaces what Whisper heard.
    expect(detail.getByText('corrected words')).toBeTruthy()
    expect(detail.queryByText('raw words')).toBeNull()
    expect(detail.getByText('Transcribing')).toBeTruthy()
    expect(detail.getByText("Couldn't transcribe: The recording is silent.")).toBeTruthy()

    // Play fetches the audio behind the session cookie, then plays the file.
    await fireEvent.press(detail.getByRole('button', { name: 'Play voice note 1' }))
    await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled())
    expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: expect.stringContaining('voice-r1') })
  })

  it('opens an observation waiting to upload, read only, from the phone (AC5)', async () => {
    queueOnPhone()
    // Still offline, so it stays waiting while the test looks at it.
    gateway([], { [`POST /api/assessments/${REF}/capture-session`]: new TypeError('Network request failed') })
    await openWorkspace()

    const detail = within(await openObservation())

    expect(detail.getByText('Waiting to upload')).toBeTruthy()
    expect(detail.getByText('Queued note, nothing uploaded')).toBeTruthy()
    // Its photo and voice note are files on the phone, and it has no transcript yet.
    expect(detail.getByTestId('detail-photo').props.source.uri).toMatch(/^file:.*photo-0\.jpg$/)
    expect(detail.queryByText('Transcribing')).toBeNull()
    mockPlayer.replace.mockClear()
    await fireEvent.press(detail.getByRole('button', { name: 'Play voice note 1' }))
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: expect.stringMatching(/recording-0\.m4a$/) }))
  })

  it("shows why the gateway refused a waiting observation (AC5)", async () => {
    queueOnPhone('The assessment is archived.')
    gateway([], { [`POST /api/assessments/${REF}/capture-session`]: new TypeError('Network request failed') })
    await openWorkspace()

    const detail = within(await openObservation())

    expect(detail.getByText("Couldn't upload: The assessment is archived.")).toBeTruthy()
  })

  it('opens from the last copy with no signal, and says what is missing (AC6)', async () => {
    gateway([
      observation('o1', 'l1', {
        note: 'Valve chained open',
        location: STAIRCASE,
        photos: [{ id: 'p1', url: '/api/observations/o1/photos/p1/image' }],
      }),
    ])
    await openWorkspace()
    await screen.findByText('Valve chained open')

    // The signal goes, and the app is closed and opened again.
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch
    await screen.unmount()
    await renderRouter(routes)
    await chooseStaircase()

    const detail = within(await openObservation())

    expect(await detail.findByText("You're offline. Showing what was saved on this device.")).toBeTruthy()
    expect(detail.getByText(/Valve chained open/)).toBeTruthy()
    // A photo the phone never loaded can't be fetched now.
    await fireEvent(detail.getByTestId('detail-photo'), 'error')
    expect(detail.getByText('Not available offline')).toBeTruthy()
  })

  it("says when the observation isn't there any more, and goes back (AC7)", async () => {
    gateway([observation('o1', 'l1')])
    await openWorkspace()

    await act(async () =>
      router.push({ pathname: '/assessment/[reference]/observation/[id]', params: { reference: REF, id: 'removed-on-the-web' } }),
    )

    expect(await screen.findByText("This observation isn't available")).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByTestId('workspace')).toBeTruthy()
  })

  it('plays a voice note again from the start once it has finished (AC4)', async () => {
    gateway(
      [observation('o1', 'l1', { recordings: [{ id: 'r1', url: '/api/observations/o1/recordings/r1/audio' }] })],
      { 'GET /api/observations/o1/recordings/r1/audio': { status: 200, body: '' } },
    )
    await openWorkspace()
    const detail = within(await openObservation())
    await fireEvent.press(detail.getByRole('button', { name: 'Play voice note 1' }))
    await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(1))
    mockPlayer.seekTo.mockClear()

    // It reached the end, so the player is stopped at the end.
    Object.assign(mockPlayer, { currentTime: 12, duration: 12 })
    await fireEvent.press(detail.getByRole('button', { name: 'Play voice note 1' }))

    await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(2))
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0)
  })

  it("doesn't keep a Wi-Fi login page as a voice note, and plays it once the gateway answers (AC4)", async () => {
    let portal = true
    gateway(
      [observation('o1', 'l1', { recordings: [{ id: 'portal', url: '/api/observations/o1/recordings/portal/audio' }] })],
      {
        // A captive portal answers 200 with a web page, not the audio.
        'GET /api/observations/o1/recordings/portal/audio': () =>
          portal ? { status: 200, html: true } : { status: 200, body: '' },
      },
    )
    await openWorkspace()
    const detail = within(await openObservation())

    await fireEvent.press(detail.getByRole('button', { name: 'Play voice note 1' }))
    expect(await detail.findByText(/Couldn't load this voice note|Not available offline/)).toBeTruthy()
    expect(mockPlayer.replace).not.toHaveBeenCalled()

    // The bad reply wasn't saved, so the next Play asks again.
    portal = false
    await fireEvent.press(detail.getByRole('button', { name: 'Play voice note 1' }))
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: expect.stringContaining('voice-portal') }))
  })

  it('shows a web correction even when transcribing failed, and says when no speech was found (AC4)', async () => {
    const audio = (id: string) => `/api/observations/o1/recordings/${id}/audio`
    gateway([
      observation('o1', 'l1', {
        recordings: [
          {
            id: 'a1',
            url: audio('a1'),
            transcription: { status: 'failed', transcript: null, error: 'Too quiet.', correction: { text: 'typed on the web' } },
          },
          { id: 'a2', url: audio('a2'), transcription: { status: 'transcribed', transcript: '', error: null } },
        ],
      }),
    ])
    await openWorkspace()

    const detail = within(await openObservation())

    expect(detail.getByText('typed on the web')).toBeTruthy()
    expect(detail.queryByText(/Too quiet/)).toBeNull()
    expect(detail.getByText('No speech found.')).toBeTruthy()
  })

  it('tries a photo again when its box is tapped (AC6)', async () => {
    gateway([observation('o1', 'l1', { photos: [{ id: 'p1', url: '/api/observations/o1/photos/p1/image' }] })])
    await openWorkspace()
    const detail = within(await openObservation())
    await fireEvent(detail.getByTestId('detail-photo'), 'error')
    expect(detail.getByText("Couldn't load this image")).toBeTruthy()

    await fireEvent.press(detail.getByRole('button', { name: 'Try loading the image again' }))

    expect(detail.getByTestId('detail-photo')).toBeTruthy()
  })

  it('Back leaves the unavailable message even when the screen was opened by a link (AC7)', async () => {
    gateway([observation('o1', 'l1')])
    // Opened straight on the detail: nothing behind it to go back to.
    await renderRouter(routes, { initialUrl: `/assessment/${REF}/observation/removed-on-the-web` })
    expect(await screen.findByText("This observation isn't available")).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }))

    expect(await screen.findByTestId('workspace')).toBeTruthy()
  })

  it("says it couldn't load, not that it was removed, when the list fails (AC7)", async () => {
    let calls = 0
    gateway([], {
      // The workspace loads it fine; the detail's own load fails.
      [`GET /api/assessments/${REF}/observations`]: () =>
        calls++ === 0 || calls === 1
          ? { status: 200, body: [observation('o1', 'l1')] }
          : { status: 500, body: { error: 'Something went wrong.' } },
    })
    await openWorkspace()
    await fireEvent.press((await screen.findAllByTestId('observation-open'))[0])

    expect(await screen.findByText("Couldn't load this observation")).toBeTruthy()
    expect(screen.queryByText("This observation isn't available")).toBeNull()
  })

  it('says it was uploaded when the waiting observation uploads while open (AC5)', async () => {
    queueOnPhone()
    // The app comes to the front: one of the ways the queue uploads.
    let appState: (state: AppStateStatus) => void = () => {}
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      appState = handler as typeof appState
      return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>
    })
    let online = false
    const up = (reply: Reply) => () => (online ? reply : new TypeError('Network request failed'))
    gateway([], {
      [`POST /api/assessments/${REF}/capture-session`]: up({ status: 200, body: {} }),
      [`POST /api/assessments/${REF}/observations`]: up({ status: 201, body: observation('o9', 'l1') }),
    })
    await openWorkspace()
    await openObservation()

    online = true
    await act(async () => appState('active'))

    expect(await screen.findByText('This observation was uploaded')).toBeTruthy()
  })
})
