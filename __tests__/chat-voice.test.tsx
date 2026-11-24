// MB-25 (web CB-10, core only): ask the chatbot by voice and hear the answer. Drives the Chatbot tab with the
// recorder, the speaker and the gateway mocked: a recording becomes text in the box (never sent by itself),
// and an answer is read aloud without its citation numbers. No test reaches a server, a model or a microphone.
import * as Speech from 'expo-speech'
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Linking } from 'react-native'
import { chunkedStream, mockGateway, openTab, pointAtTestGateway, routes, signedIn, sse, type Reply } from '../test/gateway'

pointAtTestGateway()
jest.setTimeout(20000)

// The recorder, as capture's tests do: expo-audio needs a phone.
const mockRecorder = {
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(),
  stop: jest.fn(async () => {}),
  pause: jest.fn(),
  uri: 'file:///cache/question.m4a',
}
let mockPermission = { granted: true }
let mockMillis = 7_000
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: mockMillis }),
  requestRecordingPermissionsAsync: jest.fn(async () => mockPermission),
  setAudioModeAsync: jest.fn(async () => {}),
}))

const PROGRAM =
  'root = Answer([p1], meta)\n' +
  'p1 = Paragraph([s1, s2])\n' +
  's1 = Statement("NFPA 13 needs **0.20 gpm/ft²** for OH2.", [c1])\n' +
  'c1 = Cite("P1", "0.20 gpm/ft²")\n' +
  's2 = Statement("The design area is 1,500 ft².", [c1])\n' +
  'meta = Meta([{label: "P1", passageId: "pa1", documentId: "d1", pageStart: 81, pageEnd: 81, withdrawn: false}], [])\n'
const SPOKEN = 'NFPA 13 needs 0.20 gpm/ft² for OH2. The design area is 1,500 ft².'

type Transcribed = { type?: string; bytes: number }
let transcribed: Transcribed[]
let asked: { messages: { role: string; content: string }[] }[]
let transcribeReply: () => Reply | Promise<Reply>

function gateway(overrides: Record<string, Reply | ((init?: RequestInit, url?: string) => Reply | Promise<Reply>)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [] },
    'GET /api/knowledge-documents/ingested': { status: 200, body: [] },
    'POST /api/chat/conversations': { status: 201, body: { id: 't1', title: 'New chat', createdAt: '2026-11-09T01:00:00.000Z' } },
    'POST /api/chat/transcribe': (init) => {
      transcribed.push({ type: (init?.headers as Record<string, string>)['Content-Type'], bytes: (init?.body as Uint8Array).length })
      return transcribeReply()
    },
    'POST /api/chat': (init) => {
      asked.push(JSON.parse(String(init?.body)))
      const s = chunkedStream()
      ;[
        sse({ type: 'TEXT_MESSAGE_START', messageId: `m${asked.length}`, role: 'assistant' }),
        sse({ type: 'TEXT_MESSAGE_CONTENT', messageId: `m${asked.length}`, delta: PROGRAM }),
        sse({ type: 'TEXT_MESSAGE_END', messageId: `m${asked.length}` }),
      ].forEach((c) => s.send(c))
      s.close()
      return { status: 200, stream: s.stream }
    },
    ...overrides,
  })
}

const settle = async () => act(async () => { for (let i = 0; i < 40; i++) await Promise.resolve() })

async function openChat() {
  await renderRouter(routes)
  await openTab('Chatbot')
  await screen.findByLabelText('Question')
}

// Speak, then Stop: the clip is sent for transcription.
async function speakAndStop() {
  await fireEvent.press(screen.getByRole('button', { name: 'Speak' }))
  await settle()
  await fireEvent.press(await screen.findByRole('button', { name: 'Stop recording' }))
  await settle()
}

async function ask(question: string) {
  await fireEvent.changeText(await screen.findByLabelText('Question'), question)
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }))
  await settle()
}

const speak = Speech.speak as jest.Mock
// What the speaker calls when it has finished.
const finished = () => (speak.mock.calls.at(-1)?.[1] as { onDone(): void }).onDone()

beforeEach(() => {
  jest.clearAllMocks()
  mockPermission = { granted: true }
  mockMillis = 7_000
  mockRecorder.uri = 'file:///cache/question.m4a'
  transcribed = []
  asked = []
  transcribeReply = () => ({ status: 200, body: { text: 'How often is NFPA 25 tested?' } })
})

describe('speak a question (A)', () => {
  it('shows a Speak microphone while the box is empty, and Send once there is text (AC1)', async () => {
    gateway()
    await openChat()
    expect(screen.getByRole('button', { name: 'Speak' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()

    await fireEvent.changeText(screen.getByLabelText('Question'), 'hello')
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Speak' })).toBeNull()
  })

  it('records on Speak and shows the time and Stop (AC1)', async () => {
    gateway()
    await openChat()
    await fireEvent.press(screen.getByRole('button', { name: 'Speak' }))
    await settle()

    expect(mockRecorder.record).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('0:07')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeTruthy()
  })

  it('sends the clip on Stop and puts the text in the box, asking nothing (AC2)', async () => {
    gateway()
    await openChat()
    await speakAndStop()

    expect(transcribed).toEqual([{ type: 'audio/m4a', bytes: expect.any(Number) }])
    await waitFor(() => expect(screen.getByLabelText('Question').props.value).toBe('How often is NFPA 25 tested?'))
    expect(asked).toEqual([])
  })

  it('says it is turning the voice into text, and says why when that fails (AC3)', async () => {
    let release!: () => void
    const held = new Promise<void>((r) => (release = r))
    transcribeReply = async () => {
      await held
      return { status: 503, body: { error: 'The speech service could not be reached.' } }
    }
    gateway()
    await openChat()
    await speakAndStop()

    expect(await screen.findByText('Turning your voice into text')).toBeTruthy()
    await act(async () => release())
    expect(await screen.findByText('The speech service could not be reached.')).toBeTruthy()
    expect(screen.getByLabelText('Question').props.value).toBe('')
  })

  it('shows the gateway\'s words for no speech and for a clip that is too long (AC4)', async () => {
    transcribeReply = () => ({ status: 422, body: { error: 'No speech was heard. Try again closer to the microphone.' } })
    gateway()
    await openChat()
    await speakAndStop()
    expect(await screen.findByText('No speech was heard. Try again closer to the microphone.')).toBeTruthy()
    expect(screen.getByLabelText('Question').props.value).toBe('')

    transcribeReply = () => ({ status: 413, body: { error: 'That recording is too long. Ask in a shorter clip.' } })
    await speakAndStop()
    expect(await screen.findByText('That recording is too long. Ask in a shorter clip.')).toBeTruthy()
  })

  it('says the microphone is off, with the usual words and Open Settings (AC5)', async () => {
    mockPermission = { granted: false }
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    gateway()
    await openChat()
    await fireEvent.press(screen.getByRole('button', { name: 'Speak' }))

    expect(await screen.findByText('Microphone access is off. Turn it on in Settings to record voice notes.')).toBeTruthy()
    expect(mockRecorder.record).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }))
    expect(settings).toHaveBeenCalled()
  })

  it('stops the recording and sends nothing when I leave the chat (AC5)', async () => {
    gateway()
    await openChat()
    await fireEvent.press(screen.getByRole('button', { name: 'Speak' }))
    await settle()
    expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeTruthy()

    await openTab('Home')
    await settle()

    expect(mockRecorder.stop).toHaveBeenCalledTimes(1)
    expect(transcribed).toEqual([])
  })

  it('does not send a clip I left behind, even if I come back before it is saved (AC5)', async () => {
    let release!: () => void
    mockRecorder.stop.mockImplementationOnce(() => new Promise<void>((r) => (release = r)))
    gateway()
    await openChat()
    await fireEvent.press(screen.getByRole('button', { name: 'Speak' }))
    await settle()

    await openTab('Home')
    await settle()
    await openTab('Chatbot')
    await act(async () => release())
    await settle()

    expect(transcribed).toEqual([])
    expect(screen.getByLabelText('Question').props.value).toBe('')
  })

  it('still offers Stop recording when a tapped starter makes the chat busy (AC1)', async () => {
    // An answer that never ends, so the chat stays busy.
    gateway({ 'POST /api/chat': () => ({ status: 200, stream: chunkedStream().stream }) })
    await openChat()
    await fireEvent.press(screen.getByRole('button', { name: 'Speak' }))
    await settle()
    await fireEvent.press(await screen.findByText('NFPA 25 inspection intervals'))
    await settle()

    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeTruthy()
  })

  it('sends one request for two quick taps on Stop, and records once (AC10)', async () => {
    gateway()
    await openChat()
    await fireEvent.press(screen.getByRole('button', { name: 'Speak' }))
    await settle()
    const stop = await screen.findByRole('button', { name: 'Stop recording' })
    await fireEvent.press(stop)
    await fireEvent.press(stop)
    await settle()

    expect(mockRecorder.record).toHaveBeenCalledTimes(1)
    expect(transcribed).toHaveLength(1)
  })

  it('does not send a clip shorter than a second, so an accidental tap costs nothing (AC10)', async () => {
    mockMillis = 300
    gateway()
    await openChat()
    await speakAndStop()

    expect(await screen.findByText('That was too short. Hold on a little longer, then tap Stop.')).toBeTruthy()
    expect(transcribed).toEqual([])
  })
})

describe('hear the answer (B)', () => {
  it('reads an answer aloud without its citation numbers or bold marks (AC6)', async () => {
    gateway()
    await openChat()
    await ask('What density for OH2?')
    await fireEvent.press(await screen.findByRole('button', { name: 'Play answer' }))

    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak.mock.calls[0][0]).toBe(SPOKEN)
  })

  it('pauses, resumes and stops, and Play comes back when it is done (AC7)', async () => {
    gateway()
    await openChat()
    await ask('What density for OH2?')
    await fireEvent.press(await screen.findByRole('button', { name: 'Play answer' }))

    await fireEvent.press(await screen.findByRole('button', { name: 'Pause answer' }))
    expect(Speech.pause).toHaveBeenCalled()
    await fireEvent.press(await screen.findByRole('button', { name: 'Resume answer' }))
    expect(Speech.resume).toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'Stop answer' }))
    expect(Speech.stop).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Play answer' })).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Play answer' }))
    await act(async () => finished())
    expect(await screen.findByRole('button', { name: 'Play answer' })).toBeTruthy()
  })

  it('reads one answer at a time, and a new question stops the one reading (AC7)', async () => {
    gateway()
    await openChat()
    await ask('First question?')
    await ask('Second question?')
    const plays = await screen.findAllByRole('button', { name: 'Play answer' })
    expect(plays).toHaveLength(2)

    await fireEvent.press(plays[0])
    await fireEvent.press((await screen.findAllByRole('button', { name: 'Play answer' }))[0])
    // The first is reading; playing the second stops it first.
    expect(speak).toHaveBeenCalledTimes(2)
    expect(Speech.stop).toHaveBeenCalled()

    ;(Speech.stop as jest.Mock).mockClear()
    await ask('Third question?')
    expect(Speech.stop).toHaveBeenCalled()
  })

  it('stops reading when I start a new chat (AC7)', async () => {
    gateway()
    await openChat()
    await ask('What density for OH2?')
    await fireEvent.press(await screen.findByRole('button', { name: 'Play answer' }))
    ;(Speech.stop as jest.Mock).mockClear()

    await fireEvent.press(screen.getByRole('button', { name: 'New chat' }))
    expect(Speech.stop).toHaveBeenCalled()
  })

  it('keeps reading when Play is tapped again just after Stop, whatever the old reading reports late (AC7)', async () => {
    gateway()
    await openChat()
    await ask('What density for OH2?')
    await fireEvent.press(await screen.findByRole('button', { name: 'Play answer' }))
    const first = speak.mock.calls[0][1] as { onStopped(): void }
    await fireEvent.press(screen.getByRole('button', { name: 'Stop answer' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Play answer' }))

    // The first reading's "stopped" arrives after the second began.
    await act(async () => first.onStopped())
    expect(screen.getByRole('button', { name: 'Stop answer' })).toBeTruthy()
  })

  it('has no Play when the phone has no voice to read with (AC8)', async () => {
    ;(Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([])
    gateway()
    await openChat()
    await ask('What density for OH2?')

    await screen.findByText(/NFPA 13 needs/)
    expect(screen.queryByRole('button', { name: 'Play answer' })).toBeNull()
  })
})

describe('honest states (C)', () => {
  it('greys Speak with its words when there is no signal, and Play still works (AC9)', async () => {
    const g = gateway()
    await openChat()
    await ask('What density for OH2?')
    await screen.findByRole('button', { name: 'Play answer' })
    // The gateway goes away: the next call fails and the app is offline.
    g.mockImplementation(async () => { throw new TypeError('Network request failed') })
    await ask('And another?')
    await settle()

    expect(await screen.findByText('Connect to attach or speak.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Speak' }).props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(screen.getAllByRole('button', { name: 'Play answer' })[0])
    expect(speak).toHaveBeenCalled()
  })
})
