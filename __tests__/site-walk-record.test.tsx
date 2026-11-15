// MB-16 parts B and C (AC6-AC12): recording a walk in parts, photos, notes, and sending it all.
// The recorder, camera and gateway are mocked; nothing is recorded, and Finish only calls a mocked
// gateway, so no paid AI step runs.
import * as FileSystem from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import { useKeepAwake } from 'expo-keep-awake'
import { AppState } from 'react-native'
import { router } from 'expo-router'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

pointAtTestGateway()
jest.mock('@/features/sitewalk/poll', () => ({ WALK_POLL_MS: 20 }))

const mockState = { millis: 42_000 }
const mockRecorder = { prepareToRecordAsync: jest.fn(async () => {}), record: jest.fn(), pause: jest.fn(), stop: jest.fn(async () => {}), uri: 'file:///cache/part.m4a' }
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => ({ isRecording: true, durationMillis: mockState.millis }),
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => {}),
}))

const files = (FileSystem as unknown as { __files: Map<string, string> }).__files
const picker = ImagePicker as jest.Mocked<typeof ImagePicker>

// Node's FormData turns React Native's { uri, name, type } files into text: record the parts.
class RecordingFormData {
  parts: [string, unknown][] = []
  append(key: string, value: unknown) {
    this.parts.push([key, value])
  }
}
const realFormData = globalThis.FormData

const REF = 'RPT-2026-0411'
const base = { name: null, createdAt: '2026-11-12T03:00:00.000Z', recordings: [], photos: [], notes: [], media: [], typedText: null, proposal: null, error: null }
let held: { recordings: { seq: number; durationSec: number }[]; notes: { seq: number; text: string }[]; photos: { id: string }[] }
const calls: string[] = []
const forms: Record<string, RecordingFormData> = {}

// A walk as the gateway holds it, with what has been sent so far.
const walk = () => ({
  id: 'w9',
  status: 'recording',
  ...base,
  recordings: held.recordings.map((r) => ({ ...r, transcription: 'queued', transcript: null, audioUrl: '/x' })),
  notes: held.notes,
  photos: held.photos.map((p) => ({ ...p, url: '/p', recordingSeq: null, offsetSec: null })),
})

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Lobby')] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    [`GET /api/assessments/${REF}/site-walks`]: { status: 200, body: [] },
    [`POST /api/assessments/${REF}/site-walks`]: { status: 201, body: { id: 'w9', status: 'recording', ...base } },
    [`GET /api/assessments/${REF}/site-walks/w9`]: () => ({ status: 200, body: walk() }),
    [`PUT /api/assessments/${REF}/site-walks/w9/recordings/1`]: (init) => {
      calls.push('recording 1')
      forms['recording 1'] = init?.body as unknown as RecordingFormData
      held.recordings.push({ seq: 1, durationSec: 42 })
      return { status: 200, body: walk() }
    },
    [`PUT /api/assessments/${REF}/site-walks/w9/recordings/2`]: (init) => {
      calls.push('recording 2')
      held.recordings.push({ seq: 2, durationSec: 42 })
      return { status: 200, body: walk() }
    },
    ...overrides,
  })
}

async function openRecorder() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await screen.findByRole('button', { name: 'Site walk' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Start a walk' }))
  return within(await screen.findByTestId('walk-recording'))
}

// One part: Record, then Stop (the mocked recorder says 42 seconds).
async function onePart(rec: ReturnType<typeof within>) {
  await fireEvent.press(await rec.findByRole('button', { name: 'Record' }))
  await fireEvent.press(await rec.findByRole('button', { name: 'Stop recording' }))
}

beforeEach(() => {
  jest.clearAllMocks()
  held = { recordings: [], notes: [], photos: [] }
  calls.length = 0
  mockState.millis = 42_000
  files.set('file:///cache/part.m4a', 'audio')
  files.set('file:///cache/shot.jpg', 'image')
  globalThis.FormData = RecordingFormData as unknown as typeof FormData
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse)
  picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/shot.jpg' }] } as never)
})
afterAll(() => {
  globalThis.FormData = realFormData
})

describe('recording a walk', () => {
  it('keeps the screen on while recording (AC9)', async () => {
    gateway()
    await openRecorder()

    expect(useKeepAwake).toHaveBeenCalled()
  })

  it('makes each stopped part the next numbered recording, kept then sent (AC6, AC11)', async () => {
    gateway()
    const rec = await openRecorder()

    await onePart(rec)

    expect(await rec.findByText('Part 1 · 0:42')).toBeTruthy()
    await waitFor(() => expect(calls).toEqual(['recording 1']))
    expect(forms['recording 1'].parts.map(([k]) => k)).toEqual(['recording', 'durationSec'])
    expect(forms['recording 1'].parts[1][1]).toBe('42')
    expect(await rec.findByText('Sent')).toBeTruthy()

    await onePart(rec)
    expect(await rec.findByText('Part 2 · 0:42')).toBeTruthy()
    await waitFor(() => expect(calls).toEqual(['recording 1', 'recording 2']))
  })

  it('adds a typed note with the next number, and sends it (AC8)', async () => {
    let sent: unknown
    gateway({
      [`PUT /api/assessments/${REF}/site-walks/w9/notes/1`]: (init) => {
        sent = JSON.parse(String(init?.body))
        held.notes.push({ seq: 1, text: 'Pump room door propped open' })
        return { status: 200, body: walk() }
      },
    })
    const rec = await openRecorder()

    await fireEvent.changeText(rec.getByLabelText('Note'), 'Pump room door propped open')
    await fireEvent.press(rec.getByRole('button', { name: 'Add note' }))

    expect(await rec.findByText('Pump room door propped open')).toBeTruthy()
    await waitFor(() => expect(sent).toEqual({ text: 'Pump room door propped open' }))
  })

  it('saves the part first when a photo is taken, and ties the photo to it (AC7)', async () => {
    // A fixed photo id, so the route can be named: "p" + Date.now() in base 36 + a bit of Math.random().
    jest.spyOn(Date, 'now').mockReturnValue(1000)
    jest.spyOn(Math, 'random').mockReturnValue(0.5)
    let photoForm: RecordingFormData | undefined
    gateway({
      [`PUT /api/assessments/${REF}/site-walks/w9/photos/prsi`]: (init) => {
        photoForm = init?.body as unknown as RecordingFormData
        held.photos.push({ id: 'prsi' })
        return { status: 200, body: walk() }
      },
    })
    const rec = await openRecorder()

    await fireEvent.press(await rec.findByRole('button', { name: 'Record' }))
    await fireEvent.press(rec.getByRole('button', { name: 'Take photo' }))

    await waitFor(() => expect(photoForm).toBeTruthy())
    expect(mockRecorder.stop).toHaveBeenCalled()
    const parts = Object.fromEntries(photoForm!.parts.map(([k, v]) => [k, v]))
    expect(parts.recordingSeq).toBe('1')
    expect(parts.offsetSec).toBe('42')
    expect(await rec.findByText('1 photo')).toBeTruthy()
  })

  it('stops the part and says so when the app leaves the foreground (AC9)', async () => {
    let onChange: ((s: string) => void) | undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
      onChange = cb
      return { remove: () => {} }
    }) as never)
    gateway()
    const rec = await openRecorder()
    await fireEvent.press(await rec.findByRole('button', { name: 'Record' }))
    await rec.findByRole('button', { name: 'Stop recording' })

    await act(async () => onChange?.('background'))

    expect(mockRecorder.stop).toHaveBeenCalled()
    expect(await rec.findByText('Recording stopped because the app was closed. Record again to continue.')).toBeTruthy()
  })

  it('keeps recording when the app only goes inactive, e.g. Control Center (AC9)', async () => {
    let onChange: ((s: string) => void) | undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
      onChange = cb
      return { remove: () => {} }
    }) as never)
    gateway()
    const rec = await openRecorder()
    await fireEvent.press(await rec.findByRole('button', { name: 'Record' }))
    await rec.findByRole('button', { name: 'Stop recording' })

    await act(async () => onChange?.('inactive'))

    expect(mockRecorder.stop).not.toHaveBeenCalled()
    expect(rec.getByRole('button', { name: 'Stop recording' })).toBeTruthy()
  })

  it('stops the part by itself at 20 minutes and keeps it (AC6)', async () => {
    mockState.millis = 20 * 60 * 1000
    gateway()
    const rec = await openRecorder()

    await fireEvent.press(await rec.findByRole('button', { name: 'Record' }))

    await waitFor(() => expect(mockRecorder.stop).toHaveBeenCalled())
    // The part is kept and sent with its 20 minutes (the on-screen label comes from this test's fake gateway).
    await waitFor(() => expect(calls).toEqual(['recording 1']))
    expect(forms['recording 1'].parts[1][1]).toBe('1200')
  })

  it('warns a minute before a part reaches 20 minutes (AC6)', async () => {
    mockState.millis = 19 * 60 * 1000 + 5000
    gateway()
    const rec = await openRecorder()

    await fireEvent.press(await rec.findByRole('button', { name: 'Record' }))

    expect(await rec.findByText('Under a minute left in this part.')).toBeTruthy()
  })
})

describe('sending and finishing', () => {
  it('keeps a part waiting with no signal, and Finish says so without finishing (AC11, AC12)', async () => {
    gateway({ [`PUT /api/assessments/${REF}/site-walks/w9/recordings/1`]: new TypeError('Network request failed') })
    const rec = await openRecorder()
    await onePart(rec)
    expect(await rec.findByText('Waiting to upload')).toBeTruthy()

    await fireEvent.press(rec.getByRole('button', { name: 'Finish walk' }))
    await fireEvent.changeText(rec.getByLabelText('Walk name'), 'Yard')
    await fireEvent.press(rec.getByRole('button', { name: 'Finish and send' }))

    expect(await rec.findByText('1 still to send. Connect to the internet, then finish the walk.')).toBeTruthy()
    expect(calls).not.toContain('finish')
  })

  it('says a gateway fault in words, and keeps the part waiting', async () => {
    gateway({ [`PUT /api/assessments/${REF}/site-walks/w9/recordings/1`]: { status: 500, body: {} } })
    const rec = await openRecorder()
    await onePart(rec)

    expect(await rec.findByText("The server couldn't save this yet. It's kept on this phone and will send later.")).toBeTruthy()
    expect(rec.queryByText('The server replied 500.')).toBeNull()
    expect(rec.getByText('Waiting to upload')).toBeTruthy()
  })

  it('Finish gives the gateway fault, not "connect to the internet", when it refused a part', async () => {
    gateway({ [`PUT /api/assessments/${REF}/site-walks/w9/recordings/1`]: { status: 500, body: {} } })
    const rec = await openRecorder()
    await onePart(rec)
    await rec.findByText('Waiting to upload')

    await fireEvent.press(rec.getByRole('button', { name: 'Finish walk' }))
    await fireEvent.changeText(rec.getByLabelText('Walk name'), 'Yard')
    await fireEvent.press(rec.getByRole('button', { name: 'Finish and send' }))

    expect(await rec.findByText("1 still to send. The server couldn't save this yet. It's kept on this phone and will send later.")).toBeTruthy()
    expect(calls).not.toContain('finish')
  })

  it('has nothing to finish until something is taken (AC10)', async () => {
    gateway()
    const rec = await openRecorder()

    expect(rec.getByRole('button', { name: 'Finish walk' }).props.accessibilityState.disabled).toBe(true)
  })

  it('sends everything, then finishes the walk under its name (AC10)', async () => {
    let name: unknown
    gateway({
      [`POST /api/assessments/${REF}/site-walks/w9/finish`]: (init) => {
        name = JSON.parse(String(init?.body)).name
        calls.push('finish')
        return { status: 200, body: { ...walk(), status: 'transcribing' } }
      },
    })
    const rec = await openRecorder()
    await onePart(rec)
    await rec.findByText('Sent')

    await fireEvent.press(rec.getByRole('button', { name: 'Finish walk' }))
    await fireEvent.changeText(rec.getByLabelText('Walk name'), 'Yard walk')
    await fireEvent.press(rec.getByRole('button', { name: 'Finish and send' }))

    await waitFor(() => expect(name).toBe('Yard walk'))
    expect(calls).toEqual(['recording 1', 'finish'])
    // Back on the Site walks screen.
    expect(await screen.findByTestId('site-walks')).toBeTruthy()
  })
})

// ---- Part J: the recorder as the web's (AC32-AC37) ----

describe('pause, resume and the clock (AC32)', () => {
  it('Pause holds the part, Resume goes on with the same one, Stop saves it once', async () => {
    gateway()
    const rec = await openRecorder()

    await fireEvent.press(await rec.findByRole('button', { name: 'Record' }))
    expect(await rec.findByText('0:42 of 20:00')).toBeTruthy()
    await fireEvent.press(rec.getByRole('button', { name: 'Pause recording' }))
    expect(mockRecorder.pause).toHaveBeenCalledTimes(1)
    expect(await rec.findByText('Recording paused')).toBeTruthy()

    await fireEvent.press(rec.getByRole('button', { name: 'Resume recording' }))
    // Resume is record() again on the same recorder; no second part, nothing sent yet.
    expect(mockRecorder.record).toHaveBeenCalledTimes(2)
    expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([])

    await fireEvent.press(await rec.findByRole('button', { name: 'Stop recording' }))
    await waitFor(() => expect(calls).toEqual(['recording 1']))
  })
})

describe('a photo while recording (AC33)', () => {
  it('saves the part, opens the camera, then starts the next part by itself', async () => {
    gateway()
    const rec = await openRecorder()

    await fireEvent.press(await rec.findByRole('button', { name: 'Record' }))
    await fireEvent.press(rec.getByRole('button', { name: 'Take photo' }))

    await waitFor(() => expect(calls).toContain('recording 1'))
    // Recording again: a second record() and the Stop button is back.
    await waitFor(() => expect(mockRecorder.record).toHaveBeenCalledTimes(2))
    expect(await rec.findByRole('button', { name: 'Stop recording' })).toBeTruthy()
  })

  it('does not start recording when a photo is taken while not recording', async () => {
    gateway()
    const rec = await openRecorder()

    await fireEvent.press(await rec.findByRole('button', { name: 'Take photo' }))

    expect(await rec.findByText('1 photo')).toBeTruthy()
    expect(mockRecorder.record).not.toHaveBeenCalled()
  })
})

describe('typed notes (AC34)', () => {
  const NOTES = `PUT /api/assessments/${REF}/site-walks/w9/notes/1`
  const sent: unknown[] = []
  const noteRoute = (init?: RequestInit) => {
    const { text } = JSON.parse(String(init?.body))
    sent.push(text)
    held.notes = text ? [{ seq: 1, text }] : []
    return { status: 200, body: walk() }
  }
  beforeEach(() => {
    sent.length = 0
  })

  it('edits a note that was sent, with the same number', async () => {
    gateway({ [NOTES]: noteRoute })
    const rec = await openRecorder()
    await fireEvent.changeText(rec.getByLabelText('Note'), 'First')
    await fireEvent.press(rec.getByRole('button', { name: 'Add note' }))
    await waitFor(() => expect(sent).toEqual(['First']))

    await fireEvent.press(await rec.findByRole('button', { name: 'Edit note: First' }))
    await fireEvent.changeText(rec.getByLabelText('Edit note'), 'Changed')
    await fireEvent.press(rec.getByRole('button', { name: 'Save note' }))

    await waitFor(() => expect(sent).toEqual(['First', 'Changed']))
    expect(await rec.findByText('Changed')).toBeTruthy()
    expect(rec.queryByText('First')).toBeNull()
  })

  it('removes a note: blank text under its number', async () => {
    gateway({ [NOTES]: noteRoute })
    const rec = await openRecorder()
    await fireEvent.changeText(rec.getByLabelText('Note'), 'First')
    await fireEvent.press(rec.getByRole('button', { name: 'Add note' }))
    await waitFor(() => expect(sent).toEqual(['First']))

    await fireEvent.press(await rec.findByRole('button', { name: 'Remove note: First' }))

    await waitFor(() => expect(sent).toEqual(['First', '']))
    await waitFor(() => expect(rec.queryByText('First')).toBeNull())
  })

  it('keeps a note that was typed but not added, for when the walk is opened again', async () => {
    gateway({ [`GET /api/assessments/${REF}/site-walks`]: () => ({ status: 200, body: [walk()] }) })
    const rec = await openRecorder()
    await fireEvent.changeText(rec.getByLabelText('Note'), 'Half a thought')

    await act(async () => router.back())
    await fireEvent.press(await screen.findByRole('button', { name: /^Continue recording/ }))

    expect((await within(await screen.findByTestId('walk-recording')).findByLabelText('Note')).props.value).toBe('Half a thought')
  })
})

describe('the rest of the recorder (AC35-AC37)', () => {
  it('offers Continue recording when the app was closed (AC35)', async () => {
    let onChange: ((s: string) => void) | undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
      onChange = cb
      return { remove: () => {} }
    }) as never)
    gateway()
    const rec = await openRecorder()
    await fireEvent.press(await rec.findByRole('button', { name: 'Record' }))
    await act(async () => onChange?.('background'))

    await fireEvent.press(await rec.findByRole('button', { name: 'Continue recording' }))

    expect(await rec.findByRole('button', { name: 'Stop recording' })).toBeTruthy()
  })

  it('explains how to record a walk (AC36)', async () => {
    gateway()
    const rec = await openRecorder()

    await fireEvent.press(await rec.findByRole('button', { name: 'How to record a walk' }))

    const help = within(await screen.findByTestId('help-sheet'))
    expect(help.getByText(/Pause/)).toBeTruthy()
    expect(help.getByText(/Finish walk/)).toBeTruthy()
  })

  it('says why Finish walk is off when nothing is recorded or typed (AC37)', async () => {
    gateway()
    const rec = await openRecorder()

    expect(await rec.findByText('Record or write something to finish.')).toBeTruthy()
    expect(rec.getByRole('button', { name: 'Finish walk' }).props.accessibilityState.disabled).toBe(true)
  })
})
