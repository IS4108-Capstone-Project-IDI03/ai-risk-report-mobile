// MB-17 (A and B): the Scans view of an assessment's handwritten pages, and Read again on a page that
// was read. Real routes, gateway mocked; the page poll is shortened so the test is quick.
import { fireEvent, renderRouter, screen, testRouter, waitFor, within } from 'expo-router/testing-library'
import { Alert } from 'react-native'
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
jest.mock('@/features/observations/transcriptPoll', () => ({ POLL_MS: 20, POLL_LIMIT: 3 }))

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const STAIRCASE = { id: 'l1', building: 'Block B', floor: 'Level 2', name: 'Staircase' }
const done = (transcript: string) => ({ status: 'transcribed', transcript, error: null })
const working = { status: 'transcribing', transcript: null, error: null }
const failed = (error: string) => ({ status: 'failed', transcript: null, error })

// What the gateway holds: o1 (older, two pages), o2 (newer, one page), o3 (no pages).
let pages1: object[]
let pages2: object[]
const held = () => [
  observation('o2', 'l1', { note: 'Newer note', location: STAIRCASE, pages: pages2, recordedAt: '2026-04-12T01:42:00.000Z' }),
  observation('o1', 'l1', { note: 'Valve', location: STAIRCASE, pages: pages1 }),
  observation('o3', 'l1', { note: 'No scans here' }),
]

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Staircase', 'Block B', 'Level 2')] },
    [`GET /api/assessments/${REF}/observations`]: () => ({ status: 200, body: held() }),
    ...overrides,
  })
}

async function openWorkspace() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
}
async function openScans() {
  await openWorkspace()
  // The Scans button was taken out of the workspace band on 19 Nov (Miya); the screen is still a route.
  await testRouter.push(`/assessment/${REF}/scans`)
  return within(await screen.findByTestId('scans'))
}
async function openDetail() {
  await openWorkspace()
  await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
  await fireEvent.press(await screen.findByRole('button', { name: /^Staircase/ }))
  await fireEvent.press(await screen.findByText('Valve')) // o1's card
  return within(await screen.findByTestId('observation-detail'))
}
// Presses the dialog button with this label, as a person would.
const answerAlert = (label: string) =>
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === label)?.onPress?.())
const posts = (fetchMock: jest.Mock, tail: string) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(tail) && init?.method === 'POST')

beforeEach(() => {
  jest.restoreAllMocks()
  pages1 = [
    { id: 'g1', url: '/api/observations/o1/pages/g1/image', transcription: done('Valve four is shut') },
    { id: 'g2', url: '/api/observations/o1/pages/g2/image', transcription: working },
  ]
  pages2 = [{ id: 'g3', url: '/api/observations/o2/pages/g3/image', transcription: done('') }]
})

describe('Scans view (A)', () => {
  it('lists every page of the live observations, newest first, with its reading or status (AC2)', async () => {
    gateway()
    const scans = await openScans()

    const rows = await scans.findAllByTestId('scan-row')
    expect(rows).toHaveLength(3)
    // o2's page first (newer), then o1's two.
    expect(within(rows[0]).getByText('No handwriting found.')).toBeTruthy()
    expect(within(rows[1]).getByText('Valve four is shut')).toBeTruthy()
    expect(within(rows[2]).getByText('Reading the handwriting')).toBeTruthy()
    expect(within(rows[1]).getByText(/ · Valve$/)).toBeTruthy() // the observation it belongs to
  })

  it('shows why a page could not be read (AC2)', async () => {
    pages1 = [{ id: 'g1', url: '/x', transcription: failed('The page is too dark.') }]
    pages2 = []
    gateway()
    const scans = await openScans()

    expect(await scans.findByText("Couldn't read: The page is too dark.")).toBeTruthy()
  })

  it("shows the engineer's correction instead of the reading (MB-17 C)", async () => {
    pages1 = [{ id: 'g1', url: '/x', transcription: { ...done('FHR 7 bor'), correction: { text: 'FHR 7 bar' } } }]
    pages2 = []
    gateway()
    const scans = await openScans()

    expect(await scans.findByText('FHR 7 bar')).toBeTruthy()
    expect(scans.queryByText('FHR 7 bor')).toBeNull()
  })

  it('says so when there are no pages (AC6)', async () => {
    pages1 = []
    pages2 = []
    gateway()
    const scans = await openScans()

    expect(await scans.findByText('No scanned pages yet. Scan a page when you add an observation.')).toBeTruthy()
  })

  it("opens a page's observation when tapped (AC3)", async () => {
    gateway()
    const scans = await openScans()

    await fireEvent.press((await scans.findAllByTestId('scan-row'))[1])

    const detail = within(await screen.findByTestId('observation-detail'))
    expect(await detail.findByText('Valve')).toBeTruthy()
  })

  it('reads again while a page is still being read, until it has the text (AC4)', async () => {
    gateway()
    const scans = await openScans()
    await scans.findAllByTestId('scan-row')

    pages1 = [pages1[0], { id: 'g2', url: '/y', transcription: done('Boiler room') }]

    expect(await scans.findByText('Boiler room')).toBeTruthy()
  })
})

describe('Read again (B)', () => {
  it('is shown on a page that was read, not one that is working or failed (AC7)', async () => {
    pages1 = [
      { id: 'g1', url: '/a', transcription: done('Valve four is shut') },
      { id: 'g2', url: '/b', transcription: working },
      { id: 'g4', url: '/c', transcription: failed('Too dark.') },
    ]
    gateway()
    const detail = await openDetail()

    await detail.findByText('Valve four is shut')
    expect(detail.getAllByRole('button', { name: /Read again/ })).toHaveLength(1)
    expect(detail.getByRole('button', { name: 'Try again: handwritten page 3' })).toBeTruthy()
  })

  it('asks first, then starts one reading and shows the new text when it arrives (AC8, AC9, AC10)', async () => {
    const alert = answerAlert('Read again')
    const fetchMock = gateway({
      'POST /api/observations/o1/pages/g1/retranscribe': () => {
        pages1 = [{ ...(pages1[0] as object), transcription: working }, pages1[1]]
        setTimeout(() => (pages1 = [{ id: 'g1', url: '/a', transcription: done('Valve four is OPEN') }, pages1[1]]), 30)
        return { status: 200, body: held()[1] }
      },
    })
    const detail = await openDetail()

    const button = await detail.findByRole('button', { name: 'Read again: handwritten page 1' })
    await fireEvent.press(button)
    await fireEvent.press(button) // a second quick tap

    expect(alert).toHaveBeenCalledWith('Read this page again?', 'The current text will be replaced.', expect.any(Array))
    expect(await detail.findByText('Valve four is OPEN')).toBeTruthy()
    expect(posts(fetchMock, '/pages/g1/retranscribe')).toHaveLength(1)
  })

  it('does nothing when I cancel (AC8)', async () => {
    answerAlert('Cancel')
    const fetchMock = gateway()
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Read again: handwritten page 1' }))

    expect(posts(fetchMock, '/pages/g1/retranscribe')).toHaveLength(0)
    expect(detail.getByText('Valve four is shut')).toBeTruthy()
  })

  it("shows the gateway's reason when it refuses, and changes nothing (AC10)", async () => {
    answerAlert('Read again')
    gateway({
      'POST /api/observations/o1/pages/g1/retranscribe': { status: 409, body: { error: 'This page is already being transcribed.' } },
    })
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Read again: handwritten page 1' }))

    expect(await detail.findByText('This page is already being transcribed.')).toBeTruthy()
    await waitFor(() => expect(detail.getByText('Valve four is shut')).toBeTruthy())
  })

  it('says so with no signal, and the text stays (AC10)', async () => {
    answerAlert('Read again')
    gateway({ 'POST /api/observations/o1/pages/g1/retranscribe': new TypeError('Network request failed') })
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Read again: handwritten page 1' }))

    expect(await detail.findByText(/Can't reach the server/)).toBeTruthy()
    expect(detail.getByText('Valve four is shut')).toBeTruthy()
  })
})
