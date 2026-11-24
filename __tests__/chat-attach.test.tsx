// MB-24 (web CB-08 and CB-09): ask the chatbot about a photo or a PDF. Drives the Chatbot tab against a
// mocked gateway: the pickers, the uploads (a raw body, not a form), the faces choice and what is sent
// with the question. No test reaches a server or a model.
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { mediaUri } from '@/features/observations/format'
import { chunkedStream, mockGateway, openTab, pointAtTestGateway, routes, signedIn, sse, type Reply } from '../test/gateway'

pointAtTestGateway()
jest.setTimeout(20000)

const PROGRAM = 'root = Answer([p1])\np1 = Paragraph([s1])\ns1 = Statement("The sprinkler heads are blocked.", [])\n'
const answer = (id: string, program = PROGRAM) => [
  sse({ type: 'TEXT_MESSAGE_START', messageId: id, role: 'assistant' }),
  sse({ type: 'TEXT_MESSAGE_CONTENT', messageId: id, delta: program }),
  sse({ type: 'TEXT_MESSAGE_END', messageId: id }),
]

type Upload = { kind: 'photo' | 'pdf'; type?: string; name?: string; bytes: number }
type Asked = { messages: { role: string; content: string }[]; threadId?: string; attachments?: string[]; pdfs?: string[] }

let uploads: Upload[]
let asked: Asked[]
// What the next photo upload answers (a test changes it), and a gate a test can hold an upload at.
let photoReply: () => Reply
let holdPdf: Promise<void> | null

const photoOk = (faces = 0): (() => Reply) => {
  let n = 0
  return () => {
    n += 1
    return { status: 200, body: { id: `ph${n}.jpg`, faces, blurredId: faces ? `ph${n}.blurred.jpg` : null } }
  }
}

function gateway(saved: object[] = [], overrides: Record<string, Reply | ((init?: RequestInit, url?: string) => Reply | Promise<Reply>)> = {}) {
  let pdfs = 0
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [] },
    'GET /api/knowledge-documents/ingested': { status: 200, body: [] },
    'POST /api/chat/conversations': { status: 201, body: { id: 't1', title: 'New chat', createdAt: '2026-11-09T01:00:00.000Z' } },
    'GET /api/chat/conversations/t1': { status: 200, body: { messages: saved, versions: [] } },
    'POST /api/chat/photos': (init) => {
      const reply = photoReply()
      uploads.push({ kind: 'photo', type: (init?.headers as Record<string, string>)['Content-Type'], bytes: (init?.body as Uint8Array).length })
      return reply
    },
    'POST /api/chat/pdfs': (init) => {
      pdfs += 1
      const headers = init?.headers as Record<string, string>
      const name = decodeURIComponent(headers['X-File-Name'])
      uploads.push({ kind: 'pdf', type: headers['Content-Type'], name: headers['X-File-Name'], bytes: (init?.body as Uint8Array).length })
      return { status: 200, body: { id: `pd${pdfs}`, name, pages: 3, skipped: [], flagged: name.includes('flagged') } }
    },
    'DELETE /api/chat/photos/ph1.jpg': { status: 204 },
    'DELETE /api/chat/pdfs/pd1': { status: 204 },
    'POST /api/chat': (init) => {
      asked.push(JSON.parse(String(init?.body)))
      const s = chunkedStream()
      answer(`m${asked.length}`).forEach((c) => s.send(c))
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

// Taps + and picks one of the choices on the card that floats above it.
async function attach(choice: 'Take photo' | 'Choose photo' | 'Choose PDF') {
  await fireEvent.press(screen.getByRole('button', { name: 'Attach' }))
  await fireEvent.press(await screen.findByRole('button', { name: choice }))
  await settle()
}

const pickPhoto = (...uris: string[]) => {
  ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true })
  ;(ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: uris.map((uri) => ({ uri })) })
}
const pickPdf = (name: string) =>
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: `file:///cache/${name}`, name, mimeType: 'application/pdf' }] })

async function ask(question: string) {
  await fireEvent.changeText(await screen.findByLabelText('Question'), question)
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }))
  await settle()
}

beforeEach(() => {
  jest.restoreAllMocks()
  uploads = []
  asked = []
  photoReply = photoOk()
  holdPdf = null
})

describe('attach (A)', () => {
  it('floats Take photo, Choose photo and Choose PDF above the + and closes when I tap away (AC1)', async () => {
    gateway()
    await openChat()
    expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Attach' }))

    for (const name of ['Take photo', 'Choose photo', 'Choose PDF']) expect(await screen.findByRole('button', { name })).toBeTruthy()
    await fireEvent.press(screen.getByLabelText('Close menu'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull())
  })

  it('uploads a photo at once as a raw body, shows it, and removes it (AC2)', async () => {
    gateway()
    await openChat()
    pickPhoto('file:///cache/p1.jpg')
    await attach('Take photo')

    expect(await screen.findByLabelText('Photo 1')).toBeTruthy()
    expect(uploads).toEqual([{ kind: 'photo', type: 'image/jpeg', bytes: expect.any(Number) }])
    await fireEvent.press(screen.getByRole('button', { name: 'Remove photo 1' }))
    await waitFor(() => expect(screen.queryByLabelText('Photo 1')).toBeNull())
  })

  it('asks what to do about faces, and sends the blurred copy by default (AC4)', async () => {
    photoReply = photoOk(2)
    gateway()
    await openChat()
    pickPhoto('file:///cache/p1.jpg')
    await attach('Take photo')

    expect(await screen.findByText('2 faces found')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Blur faces' }).props.accessibilityState.selected).toBe(true)
    await ask('What is wrong here?')
    expect(asked[0].attachments).toEqual(['ph1.blurred.jpg'])
  })

  it('sends the photo as it is when I choose Send as is (AC4)', async () => {
    photoReply = photoOk(1)
    gateway()
    await openChat()
    pickPhoto('file:///cache/p1.jpg')
    await attach('Take photo')
    await fireEvent.press(await screen.findByRole('button', { name: 'Send as is' }))

    await ask('What is wrong here?')
    expect(asked[0].attachments).toEqual(['ph1.jpg'])
  })

  // Try-out 24 Nov: the thumbnail and the sent bubble showed the sharp face while the gateway held the
  // blurred copy. The web draws the blurred copy as soon as Blur faces is on, so the phone does too.
  it('draws the blurred copy while Blur faces is on, and the photo itself after Send as is (AC4)', async () => {
    photoReply = photoOk(1)
    gateway()
    await openChat()
    pickPhoto('file:///cache/p1.jpg')
    await attach('Take photo')
    const shown = () => screen.getByLabelText('Photo 1').props.source.uri

    await screen.findByText('1 face found')
    expect(shown()).toBe(mediaUri('/api/chat/photos/ph1.blurred.jpg'))
    await fireEvent.press(screen.getByRole('button', { name: 'Send as is' }))
    expect(shown()).toBe('file:///cache/p1.jpg')
    await fireEvent.press(screen.getByRole('button', { name: 'Blur faces' }))

    await ask('What is wrong here?')
    expect(shown()).toBe(mediaUri('/api/chat/photos/ph1.blurred.jpg'))
  })

  // Try-out 24 Nov: Choose PDF closed the card and opened Files in the same moment. iOS cannot show a
  // picker while the card's Modal is still closing, so Files never appeared and the next try said
  // "Different document picking in progress". The card now stays until the picker is done.
  it('keeps the card open while Files opens, and closes it when the picker is done (AC1)', async () => {
    gateway()
    await openChat()
    let finish!: (result: unknown) => void
    ;(DocumentPicker.getDocumentAsync as jest.Mock).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    await attach('Choose PDF')

    expect(screen.getByRole('button', { name: 'Choose PDF' })).toBeTruthy()
    await act(async () => finish({ canceled: true }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Choose PDF' })).toBeNull())
  })

  it('keeps no photo when its faces could not be checked, and says so (AC4)', async () => {
    photoReply = () => ({ status: 503, body: { error: 'Faces could not be checked. Try again in a moment.' } })
    gateway()
    await openChat()
    pickPhoto('file:///cache/p1.jpg')
    await attach('Take photo')

    expect(await screen.findByText('Faces could not be checked. Try again in a moment.')).toBeTruthy()
    expect(screen.queryByLabelText('Photo 1')).toBeNull()
  })

  it('uploads a PDF with its name in a header and shows a chip with its pages (AC3)', async () => {
    gateway()
    await openChat()
    pickPdf('Client doc.pdf')
    await attach('Choose PDF')

    expect(await screen.findByText('Client doc.pdf')).toBeTruthy()
    expect(screen.getByText('3 pages')).toBeTruthy()
    expect(uploads).toEqual([{ kind: 'pdf', type: 'application/pdf', name: 'Client%20doc.pdf', bytes: expect.any(Number) }])
  })

  it('says why a file is refused, and attaches nothing (AC5)', async () => {
    gateway([], { 'POST /api/chat/pdfs': { status: 400, body: { error: 'That PDF is password-protected.' } } })
    await openChat()
    pickPdf('locked.pdf')
    await attach('Choose PDF')

    expect(await screen.findByText('That PDF is password-protected.')).toBeTruthy()
    expect(screen.queryByText('locked.pdf')).toBeNull()
  })

  it('stops a fourth PDF in one chat with the gateway\'s words (AC6)', async () => {
    gateway()
    await openChat()
    for (const name of ['a.pdf', 'b.pdf', 'c.pdf']) {
      pickPdf(name)
      await attach('Choose PDF')
      await screen.findByText(name)
    }
    pickPdf('d.pdf')
    await attach('Choose PDF')

    expect(await screen.findByText('A chat can use up to 3 PDFs. Start a new chat to use more.')).toBeTruthy()
    expect(uploads.filter((u) => u.kind === 'pdf')).toHaveLength(3)
  })

  it('says camera access is off, with the usual words, and uploads nothing (AC1)', async () => {
    gateway()
    await openChat()
    ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false })
    await attach('Take photo')

    expect(await screen.findByText('Camera access is off. Turn it on in Settings to take photos.')).toBeTruthy()
    expect(uploads).toEqual([])
  })

  it('stops at 3 photos in one question with the gateway\'s words (AC2, AC5)', async () => {
    gateway()
    await openChat()
    pickPhoto('file:///cache/a.jpg', 'file:///cache/b.jpg', 'file:///cache/c.jpg', 'file:///cache/d.jpg')
    await attach('Take photo')

    expect(await screen.findByText('Attach up to 3 photos to a question.')).toBeTruthy()
    expect(uploads.filter((u) => u.kind === 'photo')).toHaveLength(3)
    expect(screen.queryByLabelText('Photo 4')).toBeNull()
  })

  it('removes an unsent PDF from the chip and from the gateway (AC3)', async () => {
    const fetchMock = gateway()
    await openChat()
    pickPdf('a.pdf')
    await attach('Choose PDF')
    await screen.findByText('a.pdf')
    await fireEvent.press(screen.getByRole('button', { name: 'Remove a.pdf' }))

    await waitFor(() => expect(screen.queryByText('a.pdf')).toBeNull())
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => (init as RequestInit)?.method === 'DELETE' && String(url).endsWith('/api/chat/pdfs/pd1'))).toBe(true))
  })

  it('changes nothing when I cancel the picker (AC14)', async () => {
    gateway()
    await openChat()
    ;(DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null })
    await attach('Choose PDF')

    expect(uploads).toEqual([])
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull()
  })

  it('warns when a PDF holds instructions for the assistant (AC7)', async () => {
    gateway()
    await openChat()
    pickPdf('flagged.pdf')
    await attach('Choose PDF')

    expect(await screen.findByText('This PDF has text that gives instructions. It will be read as plain text.')).toBeTruthy()
  })
})

describe('ask (B)', () => {
  it('waits for an upload, then sends the ids with the chat id, once (AC8, AC11)', async () => {
    let release!: () => void
    holdPdf = new Promise((r) => (release = r))
    gateway([], {
      'POST /api/chat/pdfs': async () => {
        await holdPdf
        return { status: 200, body: { id: 'pd1', name: 'Client doc.pdf', pages: 3, skipped: [], flagged: false } }
      },
    })
    await openChat()
    pickPdf('Client doc.pdf')
    await attach('Choose PDF')
    await fireEvent.changeText(await screen.findByLabelText('Question'), 'Does it meet NFPA 13?')

    // The upload is still running: Send is off.
    expect(screen.getByRole('button', { name: 'Send' }).props.accessibilityState.disabled).toBe(true)
    await act(async () => release())
    await screen.findByText('Client doc.pdf')
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await settle()

    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({ threadId: 't1', pdfs: ['pd1'] })
    expect(asked[0].messages.at(-1)).toMatchObject({ role: 'user', content: 'Does it meet NFPA 13?' })
  })

  it('shows what was sent with my question, and empties the attachments (AC8)', async () => {
    gateway()
    await openChat()
    pickPhoto('file:///cache/p1.jpg')
    await attach('Take photo')
    await screen.findByLabelText('Photo 1')
    pickPdf('Client doc.pdf')
    await attach('Choose PDF')
    await screen.findByText('Client doc.pdf')

    await ask('What is wrong here?')

    const mine = within(screen.getByTestId('my-message'))
    expect(mine.getByText('What is wrong here?')).toBeTruthy()
    expect(mine.getByLabelText('Photo 1')).toBeTruthy()
    expect(mine.getByText('Client doc.pdf')).toBeTruthy()
    // The answer is drawn as any answer (AC9).
    expect(await screen.findByText('The sprinkler heads are blocked.')).toBeTruthy()
    // Nothing is left in the box for the next question.
    expect(screen.queryByRole('button', { name: 'Remove photo 1' })).toBeNull()
    expect(asked[0]).toMatchObject({ attachments: ['ph1.jpg'], pdfs: ['pd1'] })
  })

  it('opens the page a PDF citation points at, in the citation sheet (AC10)', async () => {
    const program =
      'root = Answer([p1], meta)\np1 = Paragraph([s1])\ns1 = Statement("Spacing is 12 ft.", [c1])\nc1 = Cite("P1", "12 ft")\n' +
      'meta = Meta([{label: "P1", passageId: "pdfp1", documentId: "pd1", pageStart: 2, pageEnd: 2, withdrawn: false}], [])\n'
    gateway([], {
      'POST /api/chat': (init) => {
        asked.push(JSON.parse(String(init?.body)))
        const s = chunkedStream()
        answer('m1', program).forEach((c) => s.send(c))
        s.close()
        return { status: 200, stream: s.stream }
      },
      'GET /api/chat/passages/pdfp1': { status: 200, body: { id: 'pdfp1', documentId: 'pd1', text: 'Sprinkler spacing is 12 ft on page 2.', headings: [], pageStart: 2, pageEnd: 2, boxes: [] } },
    })
    await openChat()
    pickPdf('Client doc.pdf')
    await attach('Choose PDF')
    await screen.findByText('Client doc.pdf')
    await ask('What spacing?')

    await fireEvent.press((await screen.findAllByRole('link'))[0])
    expect(await within(await screen.findByTestId('citation-sheet')).findByText(/Sprinkler spacing is 12 ft on page 2/)).toBeTruthy()
  })

  it('asks with no attachments as before', async () => {
    gateway()
    await openChat()
    await ask('How often is NFPA 25 tested?')

    expect(asked[0].attachments).toBeUndefined()
    expect(asked[0].pdfs).toBeUndefined()
  })
})

describe('saved chats and honest states (C)', () => {
  it('shows a reopened question\'s photos and PDF chips (AC12)', async () => {
    const saved = [
      { id: 'q1', role: 'user', content: 'What is wrong here?', attachments: [{ id: 'ph1.jpg', url: '/api/chat/photos/ph1.jpg' }], pdfs: [{ id: 'pd1', name: 'Client doc.pdf', flagged: false }] },
      { id: 'a1', role: 'assistant', content: PROGRAM },
    ]
    gateway(saved, {
      'GET /api/chat/conversations': { status: 200, body: { threads: [{ id: 't1', title: 'Client doc check', createdAt: '2026-11-09T01:00:00.000Z' }] } },
    })
    await openChat()
    await fireEvent.press(await screen.findByRole('button', { name: 'Open chats' }))
    await fireEvent.press(await screen.findByText('Client doc check'))

    const mine = within(await screen.findByTestId('my-message'))
    expect(mine.getByText('What is wrong here?')).toBeTruthy()
    expect(mine.getByLabelText('Photo 1').props.source).toEqual({ uri: 'http://gateway.test:4000/api/chat/photos/ph1.jpg' })
    expect(mine.getByText('Client doc.pdf')).toBeTruthy()
  })

  it('greys Attach with its words when there is no signal (AC13)', async () => {
    gateway([], { 'GET /api/knowledge-documents/ingested': new TypeError('Network request failed') })
    await openChat()

    expect(await screen.findByText('Connect to attach or speak.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Attach' }).props.accessibilityState.disabled).toBe(true)
  })

  it('says why an upload failed and keeps the rest attached (AC14)', async () => {
    gateway()
    await openChat()
    pickPdf('good.pdf')
    await attach('Choose PDF')
    await screen.findByText('good.pdf')

    pickPhoto('file:///cache/p1.jpg')
    photoReply = () => ({ status: 413, body: { error: 'That photo is over 8 MB.' } })
    await attach('Take photo')

    expect(await screen.findByText('That photo is over 8 MB.')).toBeTruthy()
    expect(screen.getByText('good.pdf')).toBeTruthy()
  })
})
