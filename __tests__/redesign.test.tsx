// MB-07: the site flow redesign's new behaviours. The Capturing now card on
// Home, photo thumbnails in the workspace, search in the location picker, and
// the capture sheet's buttons and media tray. Gateway, camera and recorder
// are mocked, so no test reaches a server or a paid service.
import * as ImagePicker from 'expo-image-picker'
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library'
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

// A recorder that "records" 42 seconds into a file (as in capture.test.tsx).
const mockRecorder = {
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(),
  stop: jest.fn(async () => {}),
  uri: 'file:///cache/recording-1.m4a',
}
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => ({ isRecording: true, durationMillis: 42_000 }),
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => {}),
}))

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>
const granted = { granted: true } as ImagePicker.PermissionResponse

beforeEach(() => {
  jest.clearAllMocks()
  picker.requestCameraPermissionsAsync.mockResolvedValue(granted)
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted)
  picker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///cache/photo-1.jpg', mimeType: 'image/jpeg', fileName: null }],
  } as never)
})

const REF = 'RPT-2026-0411'
const tilbury = assessment(REF, 'capturing', {
  client: 'Northgate Logistics',
  site: { id: 's1', code: 'S-002', name: 'Tilbury Distribution Centre', address: null },
})
const leeds = assessment('RPT-2026-0408', 'under_review', {
  site: { id: 's2', code: 'S-003', name: 'Leeds Cold Store', address: null },
})
const LOCATIONS = [location('l1', 'Pump room', 'Block A'), location('l2', 'Loading bay', 'Block A')]

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [tilbury, leeds] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: LOCATIONS },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    ...overrides,
  })
}

const capturingNow = () => within(screen.getByTestId('capturing-now'))

// From Home, Continue capturing, then (with `at`) choose that location.
async function openWorkspace(at?: string) {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByRole('button', { name: /^Continue capturing/ }))
  await screen.findByTestId('workspace')
  if (at) {
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose location' }))
    await fireEvent.press(await screen.findByRole('button', { name: at }))
  }
}

describe('Home', () => {
  it('shows the capturing assessment in its own card, not again in the list (AC1)', async () => {
    gateway()
    await renderRouter(routes)

    await screen.findByText('Capturing now')
    expect(capturingNow().getByText('Tilbury Distribution Centre')).toBeTruthy()
    expect(capturingNow().getByText(REF)).toBeTruthy()
    expect(screen.getAllByText(REF)).toHaveLength(1)
    expect(screen.getByText('Leeds Cold Store')).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: /^Continue capturing/ }))
    expect(await screen.findByTestId('workspace')).toBeTruthy()
  })

  it('shows only the latest capturing assessment in the card (AC1)', async () => {
    const older = assessment('RPT-2026-0300', 'capturing', {
      site: { id: 's3', code: 'S-004', name: 'Jurong Warehouse', address: null },
    })
    gateway({ 'GET /api/assessments': { status: 200, body: [tilbury, older] } })
    await renderRouter(routes)

    await screen.findByText('Capturing now')
    expect(capturingNow().queryByText('Jurong Warehouse')).toBeNull()
    expect(screen.getByText('Jurong Warehouse')).toBeTruthy()
  })

  it('picks the assessment whose capture started most recently, not the newest visit (AC1)', async () => {
    // Listed first (newest visit), but its capture started earlier than Leeds'.
    const newerVisit = assessment('RPT-2026-0004', 'capturing', {
      site: { id: 's3', code: 'S-004', name: 'CP26 Test Site', address: null },
      captureStartedAt: '2026-11-05T09:07:00.000Z',
    })
    const startedLast = assessment('RPT-2026-0003', 'capturing', {
      site: { id: 's4', code: 'S-005', name: 'Leeds Cold Store', address: null },
      captureStartedAt: '2026-11-06T02:52:00.000Z',
    })
    gateway({ 'GET /api/assessments': { status: 200, body: [newerVisit, startedLast] } })
    await renderRouter(routes)

    await screen.findByText('Capturing now')
    expect(capturingNow().getByText('Leeds Cold Store')).toBeTruthy()
    expect(capturingNow().queryByText('CP26 Test Site')).toBeNull()
  })

  it('has no card when nothing is capturing, or while filtering (AC2)', async () => {
    gateway()
    await renderRouter(routes)
    await screen.findByText('Capturing now')

    await fireEvent.changeText(screen.getByLabelText('Search site, client or report ID'), 'Tilbury')
    expect(screen.queryByText('Capturing now')).toBeNull()
    expect(screen.getByText(REF)).toBeTruthy()
  })
})

describe('Workspace', () => {
  it('shows the first photo as a thumbnail, else an icon (AC7)', async () => {
    gateway({
      [`GET /api/assessments/${REF}/observations`]: {
        status: 200,
        body: [
          observation('o1', 'l1', { photos: [{ url: '/api/observations/o1/photos/p1/image' }] }),
          observation('o2', 'l1', { recordings: [{ url: '/api/observations/o2/recordings/r1/audio' }] }),
        ],
      },
    })
    await openWorkspace('Pump room')

    const thumb = await screen.findByTestId('observation-photo')
    expect(thumb.props.source.uri).toBe('http://gateway.test:4000/api/observations/o1/photos/p1/image')
    expect(screen.getAllByTestId('observation-photo')).toHaveLength(1)
    expect(screen.getByLabelText('Voice note')).toBeTruthy()
  })
})

describe('Location picker', () => {
  it('narrows the list as I type, and says when nothing matches (AC8)', async () => {
    gateway()
    await openWorkspace()
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose location' }))
    const search = await screen.findByLabelText('Search locations')

    await fireEvent.changeText(search, 'pump')
    expect(screen.getByRole('button', { name: 'Pump room' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Loading bay' })).toBeNull()

    await fireEvent.changeText(search, 'roof')
    expect(screen.getByText('No location matches. Add it below.')).toBeTruthy()
  })
})

describe('New observation', () => {
  async function openSheet() {
    await openWorkspace('Pump room')
    await fireEvent.press(await screen.findByRole('button', { name: 'New observation' }))
    await screen.findByTestId('capture-sheet')
  }
  const sheet = () => within(screen.getByTestId('capture-sheet'))

  it('says how to add media while the tray is empty (AC10)', async () => {
    gateway()
    await openSheet()

    expect(sheet().getByText('Media · 0')).toBeTruthy()
    expect(sheet().getByText(/Nothing added yet/)).toBeTruthy()
  })

  it('puts photos and voice notes in one tray, and counts them on their buttons (AC9, AC10)', async () => {
    gateway()
    await openSheet()
    await fireEvent.press(sheet().getByRole('button', { name: 'Take photo' }))
    await sheet().findByTestId('evidence-photo')
    await fireEvent.press(sheet().getByRole('button', { name: 'Record voice note' }))
    await fireEvent.press(await sheet().findByRole('button', { name: 'Stop recording' }))
    await sheet().findByTestId('evidence-voice-note')

    expect(sheet().getByText('Media · 2')).toBeTruthy()
    expect(sheet().queryByText(/Nothing added yet/)).toBeNull()
    expect(within(sheet().getByRole('button', { name: 'Take photo' })).getByText('1')).toBeTruthy()
    expect(within(sheet().getByRole('button', { name: 'Record voice note' })).getByText('1')).toBeTruthy()
  })

  it('turns the Voice button into Stop with the timer while recording (AC12)', async () => {
    gateway()
    await openSheet()
    await fireEvent.press(sheet().getByRole('button', { name: 'Record voice note' }))

    const stop = await sheet().findByRole('button', { name: 'Stop recording' })
    expect(within(stop).getByText('Stop 0:42')).toBeTruthy()
    expect(sheet().queryByRole('button', { name: 'Record voice note' })).toBeNull()
  })

  it('adds scans from the library with their own link (AC11)', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///lib/page.jpg' }],
    } as never)
    gateway()
    await openSheet()
    await fireEvent.press(sheet().getByRole('button', { name: 'Add scan from library' }))

    expect(await sheet().findAllByTestId('evidence-page')).toHaveLength(1)
  })
})
