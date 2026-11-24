// MB-03: capture an observation. Opens a workspace, chooses a location, then
// drives the capture bar and sheet. The gateway, camera, photo library and
// recorder are all mocked, so no test reaches a server or a paid service.
import * as ImagePicker from 'expo-image-picker'
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library'
import { Alert } from 'react-native'
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
const shot = (uri: string) =>
  ({ canceled: false, assets: [{ uri, mimeType: 'image/jpeg', fileName: null }] }) as never

// Node's FormData turns React Native's { uri, name, type } files into text, so
// the tests record what's appended instead.
class RecordingFormData {
  parts: [string, unknown][] = []
  append(key: string, value: unknown) {
    this.parts.push([key, value])
  }
}
const realFormData = globalThis.FormData

beforeEach(() => {
  jest.clearAllMocks()
  globalThis.FormData = RecordingFormData as unknown as typeof FormData
  picker.requestCameraPermissionsAsync.mockResolvedValue(granted)
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted)
  picker.launchCameraAsync.mockResolvedValue(shot('file:///cache/photo-1.jpg'))
})
afterAll(() => {
  globalThis.FormData = realFormData
})

const REF = 'RPT-2026-0411'
const staircase = location('l1', 'Staircase', 'Block A', 'Level 2')

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [staircase] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    ...overrides,
  })
}

const sheet = () => within(screen.getByTestId('capture-sheet'))

// Opens the workspace; with `at`, chooses that location first.
async function openWorkspace(at?: string) {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  if (at) {
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose location' }))
    await fireEvent.press(await screen.findByRole('button', { name: at }))
  }
}

// From a workspace at Staircase, opens a new observation.
async function openSheet() {
  await openWorkspace('Staircase')
  await fireEvent.press(await screen.findByRole('button', { name: 'New observation' }))
  await screen.findByTestId('capture-sheet')
}

const tap = async (name: string) => fireEvent.press(await sheet().findByRole('button', { name }))

describe('starting', () => {
  it('offers one New observation button once a location is chosen (AC1)', async () => {
    gateway()
    await openSheet()

    expect(sheet().getByText('Block A · Level 2 · Staircase')).toBeTruthy()
    // Since MB-07 (AC10) photos, voice notes and scans share one Media tray.
    for (const section of ['Note', 'Media · 0']) {
      expect(sheet().getByText(section)).toBeTruthy()
    }
  })

  it('opens the location picker first when no location is chosen (AC2)', async () => {
    gateway()
    await openWorkspace()
    await fireEvent.press(await screen.findByRole('button', { name: 'New observation' }))

    expect(await screen.findByRole('button', { name: 'Staircase' })).toBeTruthy()
    expect(screen.queryByTestId('capture-sheet')).toBeNull()
  })
})

describe('in the sheet', () => {
  it('takes photos with the camera and adds more from the library (AC3)', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///lib/a.jpg' }, { uri: 'file:///lib/b.jpg' }],
    } as never)
    gateway()
    await openSheet()
    await tap('Take photo')
    await tap('Add photo from library')

    expect(await sheet().findAllByTestId('evidence-photo')).toHaveLength(3)
    // Since MB-07 (AC9) the count is a badge on the Take photo button.
    expect(within(sheet().getByRole('button', { name: 'Take photo' })).getByText('3')).toBeTruthy()
  })

  it('records a voice note and shows it with its length (AC4)', async () => {
    gateway()
    await openSheet()
    await tap('Record voice note')

    expect(await sheet().findByText('Recording…')).toBeTruthy()
    expect(mockRecorder.record).toHaveBeenCalled()
    await tap('Stop recording')

    const row = within(await sheet().findByTestId('evidence-voice-note'))
    expect(row.getByText('Voice note 1')).toBeTruthy()
    expect(row.getByText('0:42')).toBeTruthy()
  })

  it('takes a note of up to 5,000 characters (AC5)', async () => {
    gateway()
    await openSheet()

    expect(sheet().getByLabelText('Note').props.maxLength).toBe(5000)
  })

  it('scans handwritten notes into their own section (AC6)', async () => {
    picker.launchCameraAsync.mockResolvedValue(shot('file:///cache/page-1.jpg'))
    gateway()
    await openSheet()
    await tap('Scan handwritten notes')

    expect(await sheet().findAllByTestId('evidence-page')).toHaveLength(1)
    expect(sheet().queryAllByTestId('evidence-photo')).toHaveLength(0)
  })

  it('adds nothing when the camera is cancelled (AC7)', async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never)
    gateway()
    await openSheet()
    await tap('Take photo')

    await act(async () => {})
    expect(sheet().queryAllByTestId('evidence-photo')).toHaveLength(0)
    expect(screen.getByTestId('capture-sheet')).toBeTruthy()
  })

  it('removes a photo, a voice note and a scan (AC8)', async () => {
    gateway()
    await openSheet()
    await tap('Take photo')
    await tap('Scan handwritten notes')
    await tap('Record voice note')
    await tap('Stop recording')
    await tap('Remove photo')
    await tap('Remove scan')
    await tap('Remove voice note')

    expect(sheet().queryAllByTestId('evidence-photo')).toHaveLength(0)
    expect(sheet().queryAllByTestId('evidence-page')).toHaveLength(0)
    expect(sheet().queryAllByTestId('evidence-voice-note')).toHaveLength(0)
  })

  // Changed for MB-23 AC12: severity is optional, because the gateway now suggests it after the save (CP-24).
  // Only evidence is needed to save, and the sheet says the AI fills in what is left empty.
  it('says what is missing until it can be saved: only evidence, not a severity (AC10, MB-23 AC12)', async () => {
    gateway()
    await openSheet()
    const save = () => sheet().getByRole('button', { name: 'Save observation' })

    expect(save()).toBeDisabled()
    expect(sheet().getByText('Add a note, photo, voice note or scan.')).toBeTruthy()
    expect(sheet().getByText('Leave one empty and the AI will suggest it.')).toBeTruthy()
    await fireEvent.changeText(sheet().getByLabelText('Note'), 'Fire door wedged open')
    expect(sheet().queryByText('Choose a severity to save.')).toBeNull()
    expect(save()).toBeEnabled()
  })
})

describe('saving', () => {
  it('starts the session, saves everything at the location, and lists it first (AC9, AC11)', async () => {
    const order: string[] = []
    let sent: RecordingFormData | undefined
    let saved = false
    gateway({
      [`POST /api/assessments/${REF}/capture-session`]: () => {
        order.push('session')
        return { status: 200, body: {} }
      },
      [`POST /api/assessments/${REF}/observations`]: (init) => {
        order.push('observation')
        sent = init?.body as unknown as RecordingFormData
        saved = true
        return { status: 201, body: observation('o1', 'l1') }
      },
      [`GET /api/assessments/${REF}/observations`]: () => ({
        status: 200,
        body: saved ? [observation('o1', 'l1', { note: 'Sprinkler valve chained open', severity: 'high' })] : [],
      }),
    })
    await openSheet()
    await fireEvent.changeText(sheet().getByLabelText('Note'), 'Sprinkler valve chained open')
    await tap('Take photo')
    picker.launchCameraAsync.mockResolvedValue(shot('file:///cache/page-1.jpg'))
    await tap('Scan handwritten notes')
    await tap('Record voice note')
    await tap('Stop recording')
    await tap('Exposure')
    await tap('Protection')
    await tap('High')
    await tap('Save observation')

    expect(await screen.findByText('Sprinkler valve chained open')).toBeTruthy()
    expect(screen.queryByTestId('capture-sheet')).toBeNull()
    expect(order).toEqual(['session', 'observation'])
    const part = (key: string) => sent!.parts.find(([k]) => k === key)![1]
    // COPE order, whatever order they were tapped in.
    expect(JSON.parse(String(part('details')))).toEqual({
      note: 'Sprinkler valve chained open',
      copeDimensions: ['Protection', 'Exposure'],
      severity: 'high',
      locationId: 'l1',
    })
    // Expo's fetch (SDK 58) reads a file part through bytes(); a bare { uri } part
    // fails with "Unsupported FormDataPart implementation".
    const bytes = expect.any(Function)
    expect(part('photo')).toMatchObject({ uri: 'file:///cache/photo-1.jpg', name: 'Photo 1.jpg', type: 'image/jpeg', bytes })
    expect(part('page')).toMatchObject({ uri: 'file:///cache/page-1.jpg', name: 'Page 1.jpg', type: 'image/jpeg', bytes })
    expect(part('recording')).toMatchObject({
      uri: 'file:///cache/recording-1.m4a',
      name: 'Voice note 1.m4a',
      type: 'audio/m4a',
      bytes,
    })
  })

  it('saves no categories as null, never an empty list (AC9)', async () => {
    let sent: RecordingFormData | undefined
    gateway({
      [`POST /api/assessments/${REF}/capture-session`]: { status: 200, body: {} },
      [`POST /api/assessments/${REF}/observations`]: (init) => {
        sent = init?.body as unknown as RecordingFormData
        return { status: 201, body: observation('o1', 'l1') }
      },
    })
    await openSheet()
    await fireEvent.changeText(sheet().getByLabelText('Note'), 'Housekeeping fine')
    await tap('Low')
    await tap('Save observation')

    await act(async () => {})
    const details = JSON.parse(String(sent!.parts.find(([k]) => k === 'details')![1]))
    expect(details.copeDimensions).toBeNull()
  })

  it('saves with no severity and no category as null, for the AI to suggest (MB-23 AC12)', async () => {
    let sent: RecordingFormData | undefined
    gateway({
      [`POST /api/assessments/${REF}/capture-session`]: { status: 200, body: {} },
      [`POST /api/assessments/${REF}/observations`]: (init) => {
        sent = init?.body as unknown as RecordingFormData
        return { status: 201, body: observation('o1', 'l1') }
      },
    })
    await openSheet()
    await fireEvent.changeText(sheet().getByLabelText('Note'), 'Fire door wedged open')
    await tap('Save observation')

    await act(async () => {})
    const details = JSON.parse(String(sent!.parts.find(([k]) => k === 'details')![1]))
    expect(details).toEqual({ note: 'Fire door wedged open', copeDimensions: null, severity: null, locationId: 'l1' })
  })

  it("shows the gateway's refusal and keeps everything in the sheet (AC11)", async () => {
    gateway({
      [`POST /api/assessments/${REF}/capture-session`]: { status: 200, body: {} },
      [`POST /api/assessments/${REF}/observations`]: {
        status: 415,
        body: { error: 'Photo 1.jpg is not a JPG or PNG image. Save it as JPG or PNG and add it again.' },
      },
    })
    await openSheet()
    await tap('Take photo')
    await tap('Moderate')
    await tap('Save observation')

    expect(await sheet().findByText(/is not a JPG or PNG image/)).toBeTruthy()
    expect(sheet().getAllByTestId('evidence-photo')).toHaveLength(1)
  })

  it('asks before discarding a sheet with something in it (AC12)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Discard')?.onPress?.()
    })
    gateway()
    await openSheet()
    await tap('Take photo')
    await sheet().findAllByTestId('evidence-photo')
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }))

    expect(alert).toHaveBeenCalledWith('Discard this observation?', expect.any(String), expect.any(Array))
    await act(async () => {})
    expect(screen.queryByTestId('capture-sheet')).toBeNull()
  })

  it('says when camera access is off, with Open Settings (AC13)', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never)
    gateway()
    await openSheet()
    await tap('Take photo')

    expect(await sheet().findByText('Camera access is off. Turn it on in Settings to take photos.')).toBeTruthy()
    expect(sheet().getByRole('button', { name: 'Open Settings' })).toBeTruthy()
    expect(picker.launchCameraAsync).not.toHaveBeenCalled()
  })
})
