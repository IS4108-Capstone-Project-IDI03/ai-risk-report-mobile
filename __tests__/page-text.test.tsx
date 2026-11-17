// MB-17 part C: Edit text on a scanned page, in the edit screen's media list. The gateway keeps the model's reading and stores the
// engineer's correction (PUT .../pages/:pageId/transcript, the web repo's CP-20). Real routes, gateway mocked.
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
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

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const STAIRCASE = { id: 'l1', building: 'Block B', floor: 'Level 2', name: 'Staircase' }
const read = (transcript: string, correction?: string) => ({
  status: 'transcribed',
  transcript,
  error: null,
  ...(correction && { correction: { text: correction, at: '2026-04-11T02:00:00.000Z', by: { id: 'u1', name: 'Ava Tan' } } }),
})

// What the gateway holds: one observation with one page.
let page: object
const held = () => observation('o1', 'l1', { note: 'Valve', location: STAIRCASE, pages: [page] })

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
  await fireEvent.press(await screen.findByText('Valve'))
  return within(await screen.findByTestId('observation-detail'))
}
// The edit screen, from the detail's one Edit button.
async function openEdit() {
  const detail = await openDetail()
  await fireEvent.press(await detail.findByRole('button', { name: 'Edit observation' }))
  return within(await screen.findByTestId('observation-edit'))
}
const puts = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith('/pages/g1/transcript') && init?.method === 'PUT')

beforeEach(() => {
  jest.restoreAllMocks()
  page = { id: 'g1', url: '/api/observations/o1/pages/g1/image', transcription: read('FHR 7 bor') }
})

describe('Edit text (C)', () => {
  it('is in the edit screen for a page that was read, not one that failed, and not on the detail (AC11)', async () => {
    page = { id: 'g1', url: '/a', transcription: { status: 'failed', transcript: null, error: 'Too dark.' } }
    gateway()
    const edit = await openEdit()

    await edit.findByText('Handwritten page 1')
    expect(edit.queryByRole('button', { name: /Edit text/ })).toBeNull()
  })

  it('opens with the reading, saves the correction and shows it marked as corrected (AC11, AC12)', async () => {
    const fetchMock = gateway({
      'PUT /api/observations/o1/pages/g1/transcript': (init) => {
        const { text } = JSON.parse(String(init?.body))
        page = { ...(page as object), transcription: read('FHR 7 bor', text) }
        return { status: 200, body: held() }
      },
    })
    const edit = await openEdit()

    await fireEvent.press(await edit.findByRole('button', { name: 'Edit text: handwritten page 1' }))
    const field = await screen.findByLabelText('Corrected text')
    expect(field.props.value).toBe('FHR 7 bor')
    await fireEvent.changeText(field, 'FHR 7 bar')
    await fireEvent.press(screen.getByRole('button', { name: 'Save text' }))

    // Back on the edit screen the page is marked; leaving it shows the text on the detail.
    const back = within(await screen.findByTestId('observation-edit'))
    expect(await back.findByText('Corrected by you')).toBeTruthy()
    await fireEvent.press(back.getByRole('button', { name: 'Cancel' }))
    const detail = within(await screen.findByTestId('observation-detail'))
    expect(await detail.findByText('FHR 7 bar')).toBeTruthy()
    expect(detail.getByText('Corrected by you')).toBeTruthy()
    expect(puts(fetchMock)).toHaveLength(1)
    expect(JSON.parse(String(puts(fetchMock)[0][1].body))).toEqual({ text: 'FHR 7 bar' })
  })

  it('opens an earlier correction, not the reading (AC11)', async () => {
    page = { id: 'g1', url: '/a', transcription: read('FHR 7 bor', 'FHR 7 bar') }
    gateway()
    const edit = await openEdit()

    await fireEvent.press(await edit.findByRole('button', { name: 'Edit text: handwritten page 1' }))

    expect((await screen.findByLabelText('Corrected text')).props.value).toBe('FHR 7 bar')
  })

  it('shows the gateway\'s reason under the field and keeps what was typed (AC13)', async () => {
    gateway({
      'PUT /api/observations/o1/pages/g1/transcript': { status: 400, body: { error: 'The transcript is invalid.', fields: { text: 'Write the corrected transcript.' } } },
    })
    const edit = await openEdit()

    await fireEvent.press(await edit.findByRole('button', { name: 'Edit text: handwritten page 1' }))
    const field = await screen.findByLabelText('Corrected text')
    await fireEvent.changeText(field, '   ')
    await fireEvent.press(screen.getByRole('button', { name: 'Save text' }))

    expect(await screen.findByText('Write the corrected transcript.')).toBeTruthy()
    expect(screen.getByLabelText('Corrected text').props.value).toBe('   ')
  })

  it('says so with no signal and keeps what was typed (AC13)', async () => {
    gateway({ 'PUT /api/observations/o1/pages/g1/transcript': new TypeError('Network request failed') })
    const edit = await openEdit()

    await fireEvent.press(await edit.findByRole('button', { name: 'Edit text: handwritten page 1' }))
    await fireEvent.changeText(await screen.findByLabelText('Corrected text'), 'FHR 7 bar')
    await fireEvent.press(screen.getByRole('button', { name: 'Save text' }))

    expect(await screen.findByText(/Can't reach the server/)).toBeTruthy()
    expect(screen.getByLabelText('Corrected text').props.value).toBe('FHR 7 bar')
  })

  it('cannot save until the text changes (AC12)', async () => {
    const fetchMock = gateway()
    const edit = await openEdit()

    await fireEvent.press(await edit.findByRole('button', { name: 'Edit text: handwritten page 1' }))
    await screen.findByLabelText('Corrected text')
    await fireEvent.press(screen.getByRole('button', { name: 'Save text' }))

    expect(puts(fetchMock)).toHaveLength(0)
  })

  it('Cancel leaves the page as it was (AC11)', async () => {
    const fetchMock = gateway()
    const edit = await openEdit()

    await fireEvent.press(await edit.findByRole('button', { name: 'Edit text: handwritten page 1' }))
    await fireEvent.changeText(await screen.findByLabelText('Corrected text'), 'Something else')
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))

    // Back on the edit screen, then the detail: the reading is as it was, and nothing was sent.
    const back = within(await screen.findByTestId('observation-edit'))
    await fireEvent.press(await back.findByRole('button', { name: 'Cancel' }))
    const detail = within(await screen.findByTestId('observation-detail'))
    expect(detail.getByText('FHR 7 bor')).toBeTruthy()
    expect(puts(fetchMock)).toHaveLength(0)
  })

  it('Read again warns that it replaces a correction (AC15)', async () => {
    page = { id: 'g1', url: '/a', transcription: read('FHR 7 bor', 'FHR 7 bar') }
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    gateway()
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Read again: handwritten page 1' }))

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Read this page again?', 'This replaces your corrected text.', expect.any(Array)),
    )
  })
})
