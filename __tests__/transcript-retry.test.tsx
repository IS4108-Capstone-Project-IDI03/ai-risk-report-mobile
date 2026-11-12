// MB-12 AC27-AC32: Try again on a failed voice note or page, on the observation's detail.
// Renders the real routes with the gateway mocked; the retry route answers 202 and the
// list then shows what the gateway now holds. The poll is shortened so the test is quick.
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, observation, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => ({}),
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0 }),
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn(),
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn(), replace: jest.fn(), seekTo: jest.fn(), currentTime: 0, duration: 0 }),
  useAudioPlayerStatus: () => ({ playing: false }),
}))
// Every 20 ms, three times, instead of every 5 s for 2 minutes (src/features/observations/transcriptPoll.ts).
jest.mock('@/features/observations/transcriptPoll', () => ({ POLL_MS: 20, POLL_LIMIT: 3 }))

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const STAIRCASE = { id: 'l1', building: 'Block B', floor: 'Level 2', name: 'Staircase' }
const failed = (error: string) => ({ status: 'failed', transcript: null, error })
const working = { status: 'transcribing', transcript: null, error: null }
const done = (transcript: string) => ({ status: 'transcribed', transcript, error: null })

// What the gateway holds: one observation with a voice note and a page.
let note: object
let page: object
const held = () => observation('o1', 'l1', { note: 'Valve', location: STAIRCASE, recordings: [note], pages: [page] })

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Staircase', 'Block B', 'Level 2')] },
    [`GET /api/assessments/${REF}/observations`]: () => ({ status: 200, body: [held()] }),
    ...overrides,
  })
}

async function openDetail() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
  await fireEvent.press(await screen.findByRole('button', { name: /Staircase/ }))
  await fireEvent.press(await screen.findByTestId('observation-open'))
  return within(await screen.findByTestId('observation-detail'))
}

const retryCalls = (fetchMock: jest.Mock, tail: string) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(tail) && init?.method === 'POST')

beforeEach(() => {
  jest.restoreAllMocks()
  note = { id: 'r1', url: '/api/observations/o1/recordings/r1/audio', transcription: failed('The speech service could not be reached') }
  page = { id: 'g1', url: '/api/observations/o1/pages/g1/image', transcription: failed('The page is too dark.') }
})

describe('try a failed transcript again', () => {
  it('shows Try again on a failed voice note and a failed page, with the reason (AC27)', async () => {
    gateway()
    const detail = await openDetail()

    expect(await detail.findByText("Couldn't transcribe: The speech service could not be reached")).toBeTruthy()
    expect(detail.getByText("Couldn't read: The page is too dark.")).toBeTruthy()
    expect(detail.getByRole('button', { name: 'Try again: voice note 1' })).toBeTruthy()
    expect(detail.getByRole('button', { name: 'Try again: handwritten page 1' })).toBeTruthy()
  })

  it('has no button on a transcript that is done or in progress (AC27)', async () => {
    note = { id: 'r1', url: '/x', transcription: done('Valve four is shut') }
    page = { id: 'g1', url: '/y', transcription: working }
    gateway()
    const detail = await openDetail()

    await detail.findByText('Valve four is shut')
    expect(detail.queryByRole('button', { name: /Try again/ })).toBeNull()
  })

  it('starts one attempt, says Transcribing, then shows the transcript when it arrives (AC28, AC29)', async () => {
    let attempts = 0
    const fetchMock = gateway({
      'POST /api/observations/o1/recordings/r1/transcription/retry': () => {
        attempts += 1
        // The gateway works in the background: first still going, then done.
        note = { ...(note as object), transcription: working }
        setTimeout(() => (note = { ...(note as object), transcription: done('Valve four is shut') }), 30)
        return { status: 202, body: null }
      },
    })
    const detail = await openDetail()

    const button = await detail.findByRole('button', { name: 'Try again: voice note 1' })
    await fireEvent.press(button)
    await fireEvent.press(button) // a second quick tap

    expect(await detail.findByText('Transcribing')).toBeTruthy()
    expect(detail.queryByRole('button', { name: 'Try again: voice note 1' })).toBeNull()
    expect(await detail.findByText('Valve four is shut')).toBeTruthy()
    expect(attempts).toBe(1)
    expect(retryCalls(fetchMock, '/recordings/r1/transcription/retry')).toHaveLength(1)
  })

  it('retries a page the same way (AC27, AC28)', async () => {
    const fetchMock = gateway({
      'POST /api/observations/o1/pages/g1/transcription/retry': () => {
        page = { ...(page as object), transcription: working }
        return { status: 202, body: null }
      },
    })
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Try again: handwritten page 1' }))

    expect(await detail.findByText('Reading the handwriting')).toBeTruthy()
    expect(retryCalls(fetchMock, '/pages/g1/transcription/retry')).toHaveLength(1)
  })

  it('gives up after a while and says so (AC29)', async () => {
    gateway({
      'POST /api/observations/o1/recordings/r1/transcription/retry': () => {
        note = { ...(note as object), transcription: working }
        return { status: 202, body: null }
      },
    })
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Try again: voice note 1' }))

    expect(await detail.findByText('Still working. Check back soon.')).toBeTruthy()
  })

  it("says why when the gateway refuses, and shows how it stands now (AC30)", async () => {
    gateway({
      'POST /api/observations/o1/recordings/r1/transcription/retry': () => {
        // Already retried on the web.
        note = { ...(note as object), transcription: done('Valve four is shut') }
        return { status: 409, body: { error: 'This transcription is not failed.' } }
      },
    })
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Try again: voice note 1' }))

    expect(await detail.findByText('This transcription is not failed.')).toBeTruthy()
    await waitFor(() => expect(detail.getByText('Valve four is shut')).toBeTruthy())
  })

  it('says so with no signal, and the button stays (AC30)', async () => {
    gateway({ 'POST /api/observations/o1/recordings/r1/transcription/retry': new TypeError('Network request failed') })
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Try again: voice note 1' }))

    expect(await detail.findByText(/Can't reach the server/)).toBeTruthy()
    expect(detail.getByRole('button', { name: 'Try again: voice note 1' })).toBeTruthy()
  })
})
