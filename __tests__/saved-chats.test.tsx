// MB-14 AC1, AC2, AC6, AC10: the chat is saved on the gateway as you ask, and the last one
// reopens after the app is closed. Drives the Chatbot tab against a mocked gateway; no test
// reaches a model. The answer program is a one-line Answer so the tests stay short.
import * as FileSystem from 'expo-file-system'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { chunkedStream, mockGateway, openTab, pointAtTestGateway, routes, signedIn, sse, type Reply } from '../test/gateway'

pointAtTestGateway()

const files = (FileSystem as unknown as { __files: Map<string, string> }).__files
const PROGRAM = 'root = Answer([p1])\np1 = Paragraph([s1])\ns1 = Statement("Inspect quarterly.", [])\n'
const answerStream = (id: string) => [
  sse({ type: 'TEXT_MESSAGE_START', messageId: id, role: 'assistant' }),
  sse({ type: 'TEXT_MESSAGE_CONTENT', messageId: id, delta: PROGRAM }),
  sse({ type: 'TEXT_MESSAGE_END', messageId: id }),
]

type Sent = { messages: { id?: string; role: string; content: string }[]; threadId?: string }

// The gateway: one chat is created on the first question; each POST /api/chat answers with
// the next id (m1, m2…). `saved` is what GET /conversations/t1 returns.
function gateway(saved: object[] = [], overrides: Record<string, Reply | ((init?: RequestInit, url?: string) => Reply)> = {}) {
  const sent: Sent[] = []
  let created = 0
  const fetchMock = mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [] },
    'GET /api/knowledge-documents/ingested': { status: 200, body: [] },
    'POST /api/chat/conversations': () => {
      created += 1
      return { status: 201, body: { id: `t${created}`, title: 'New chat', createdAt: '2026-11-09T01:00:00.000Z' } }
    },
    'GET /api/chat/conversations/t1': { status: 200, body: { messages: saved, versions: [] } },
    'POST /api/chat': (init) => {
      sent.push(JSON.parse(String(init?.body)))
      const s = chunkedStream()
      answerStream(`m${sent.length}`).forEach((c) => s.send(c))
      s.close()
      return { status: 200, stream: s.stream }
    },
    ...overrides,
  })
  return { fetchMock, sent }
}

const settle = async () => act(async () => { for (let i = 0; i < 30; i++) await Promise.resolve() })

async function openChat() {
  await renderRouter(routes)
  await openTab('Chatbot')
}
async function ask(question: string) {
  await fireEvent.changeText(await screen.findByLabelText('Question'), question)
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }))
  await settle()
}
const posts = (fetchMock: jest.Mock, tail: string) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(tail) && init?.method === 'POST')

beforeEach(() => {
  files.clear()
  // A fresh Alert spy each test, so one test's menu isn't read by the next.
  jest.restoreAllMocks()
})

it('saves the chat on the first question, then asks inside it (AC1)', async () => {
  const g = gateway()
  await openChat()
  await ask('How often is NFPA 25 inspection?')

  expect(posts(g.fetchMock, '/api/chat/conversations')).toHaveLength(1)
  expect(JSON.parse(String(posts(g.fetchMock, '/api/chat/conversations')[0][1].body))).toEqual({
    message: { content: 'How often is NFPA 25 inspection?' },
  })
  expect(g.sent[0].threadId).toBe('t1')
  expect(g.sent[0].messages).toEqual([{ id: expect.any(String), role: 'user', content: 'How often is NFPA 25 inspection?' }])
})

it('sends the earlier messages with their ids on a follow-up, in the same chat (AC1)', async () => {
  const g = gateway()
  await openChat()
  await ask('First question')
  await ask('Second question')

  expect(posts(g.fetchMock, '/api/chat/conversations')).toHaveLength(1)
  expect(g.sent[1].threadId).toBe('t1')
  // The question keeps its id; the answer has the stream's id. The gateway links by these.
  expect(g.sent[1].messages).toEqual([
    { id: g.sent[0].messages[0].id, role: 'user', content: 'First question' },
    { id: 'm1', role: 'assistant', content: PROGRAM },
    { id: expect.any(String), role: 'user', content: 'Second question' },
  ])
})

it('reopens the last chat after the app is closed and opened again (AC2)', async () => {
  gateway([])
  await openChat()
  await ask('First question')
  await screen.unmount()

  gateway([
    { id: 'u1', role: 'user', content: 'First question' },
    { id: 'm1', role: 'assistant', content: PROGRAM },
  ])
  await openChat()

  expect(await screen.findByText('First question')).toBeTruthy()
  expect(await screen.findByText('Inspect quarterly.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'NFPA 25 inspection intervals' })).toBeNull()
})

it('asks the next question inside the restored chat, with its ids (AC2)', async () => {
  gateway([])
  await openChat()
  await ask('First question')
  await screen.unmount()

  const g = gateway([
    { id: 'u1', role: 'user', content: 'First question' },
    { id: 'a1', role: 'assistant', content: PROGRAM },
  ])
  await openChat()
  await screen.findByText('First question')
  await ask('Second question')

  expect(posts(g.fetchMock, '/api/chat/conversations')).toHaveLength(0)
  expect(g.sent[0].threadId).toBe('t1')
  expect(g.sent[0].messages.slice(0, 2)).toEqual([
    { id: 'u1', role: 'user', content: 'First question' },
    { id: 'a1', role: 'assistant', content: PROGRAM },
  ])
})

it('starts empty, and forgets the chat, when it was deleted elsewhere (AC2)', async () => {
  gateway([])
  await openChat()
  await ask('First question')
  await screen.unmount()

  gateway([], { 'GET /api/chat/conversations/t1': { status: 404, body: { error: 'Chat not found.' } } })
  await openChat()

  expect(await screen.findByRole('button', { name: 'NFPA 25 inspection intervals' })).toBeTruthy()
  expect([...files.keys()].some((k) => k.includes('lastChat'))).toBe(false)
})

it('New chat shows the starters, and the next question makes a second chat (AC6)', async () => {
  const g = gateway()
  await openChat()
  await ask('First question')

  await fireEvent.press(screen.getByRole('button', { name: 'New chat' }))
  expect(await screen.findByRole('button', { name: 'NFPA 25 inspection intervals' })).toBeTruthy()
  await ask('Another question')

  expect(posts(g.fetchMock, '/api/chat/conversations')).toHaveLength(2)
  expect(g.sent[1].threadId).toBe('t2')
  expect(g.sent[1].messages).toHaveLength(1)
})

it("keeps the last chat in the signed-in engineer's own folder (AC10)", async () => {
  gateway()
  await openChat()
  await ask('First question')

  const keys = [...files.keys()].filter((k) => k.includes('lastChat'))
  expect(keys).toHaveLength(1)
  expect(keys[0]).toContain('/users/u1/')
  await waitFor(() => expect(screen.getByText('First question')).toBeTruthy())
})

// ---- MB-14 commit 2: the Chats list (AC3-AC9) ----

const threads = [
  { id: 't2', title: 'Sprinkler density for OH2', createdAt: '2026-11-09T03:00:00.000Z' },
  { id: 't1', title: 'NFPA 25 inspection intervals', createdAt: '2026-11-08T03:00:00.000Z' },
]

// The gateway with a list of saved chats; `?q=` keeps the ones whose name has the text.
function withChats(extra: Record<string, Reply | ((init?: RequestInit, url?: string) => Reply)> = {}) {
  let list = [...threads]
  const g = gateway(
    [
      { id: 'u9', role: 'user', content: 'Which density?' },
      { id: 'a9', role: 'assistant', content: PROGRAM },
    ],
    {
      'GET /api/chat/conversations': (_init, url) => {
        const q = new URL(String(url), 'http://x').searchParams.get('q')?.toLowerCase()
        return { status: 200, body: { threads: q ? list.filter((t) => t.title.toLowerCase().includes(q)) : list } }
      },
      'GET /api/chat/conversations/t2': {
        status: 200,
        body: { messages: [{ id: 'u9', role: 'user', content: 'Which density?' }, { id: 'a9', role: 'assistant', content: PROGRAM }], versions: [] },
      },
      'PATCH /api/chat/conversations/t1': (init) => {
        const { title } = JSON.parse(String(init?.body))
        list = list.map((t) => (t.id === 't1' ? { ...t, title } : t))
        return { status: 200, body: { id: 't1', title, createdAt: threads[1].createdAt } }
      },
      'DELETE /api/chat/conversations/t1': () => {
        list = list.filter((t) => t.id !== 't1')
        return { status: 204, body: null }
      },
      ...extra,
    },
  )
  return g
}

// The panel's own rows: the chat behind it has a starter question with the same words.
const inList = () => within(screen.getByTestId('chat-list'))

// Presses a button of the menu `Alert.alert` was last given (call number `n`), by its name.
const menu = (alert: jest.SpyInstance, n: number, name: string) =>
  (alert.mock.calls[n][2] as { text: string; onPress?: () => void }[]).find((b) => b.text === name)!.onPress!()

async function openList() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Open chats' }))
  return screen.findByText('Sprinkler density for OH2')
}

describe('the Chats list', () => {
  it('lists my chats, newest first, with names and dates (AC3)', async () => {
    withChats()
    await openChat()
    await openList()

    const names = screen.getAllByTestId('chat-title').map((n) => n.props.children)
    expect(names).toEqual(['Sprinkler density for OH2', 'NFPA 25 inspection intervals'])
    expect(screen.getByText('9 Nov 2026')).toBeTruthy()
  })

  it('searches by what I type (AC4)', async () => {
    const g = withChats()
    await openChat()
    await openList()

    await fireEvent.changeText(screen.getByLabelText('Search chats'), 'inspection')

    await waitFor(() => expect(inList().queryByText('Sprinkler density for OH2')).toBeNull())
    expect(inList().getByText('NFPA 25 inspection intervals')).toBeTruthy()
    expect(g.fetchMock.mock.calls.some(([url]) => String(url).includes('/api/chat/conversations?q=inspection'))).toBe(true)
  })

  it('opens a chat, closes the panel, and the next question goes into it (AC5)', async () => {
    const g = withChats()
    await openChat()
    await fireEvent.press(await openList())

    expect(await screen.findByText('Which density?')).toBeTruthy()
    await waitFor(() => expect(screen.queryByTestId('chats-panel')).toBeNull())
    await ask('And for OH1?')
    expect(g.sent[0].threadId).toBe('t2')
    expect(g.sent[0].messages[0]).toEqual({ id: 'u9', role: 'user', content: 'Which density?' })
  })

  it('renames a chat from its press-and-hold menu (AC7)', async () => {
    const alert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {})
    const g = withChats()
    await openChat()
    await openList()

    await fireEvent(screen.getByRole('button', { name: 'Open NFPA 25 inspection intervals' }), 'longPress')
    await act(async () => menu(alert, 0, 'Rename'))
    await fireEvent.changeText(screen.getByLabelText('Chat name'), 'Yearly checks')
    await fireEvent.press(screen.getByRole('button', { name: 'Save name' }))

    expect(await inList().findByText('Yearly checks')).toBeTruthy()
    expect(inList().queryByText('NFPA 25 inspection intervals')).toBeNull()
    expect(JSON.parse(String(g.fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH')![1]!.body))).toEqual({ title: 'Yearly checks' })
  })

  it('opens the same Rename and Delete menu from the … on a row (AC7, AC8)', async () => {
    const alert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {})
    withChats()
    await openChat()
    await openList()

    await fireEvent.press(screen.getByRole('button', { name: 'More for NFPA 25 inspection intervals' }))

    const names = (alert.mock.calls[0][2] as { text: string }[]).map((b) => b.text)
    expect(names).toEqual(['Rename', 'Delete', 'Cancel'])
  })

  it('deletes a chat only after I confirm (AC8)', async () => {
    const alert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {})
    const g = withChats()
    await openChat()
    await openList()

    await fireEvent(screen.getByRole('button', { name: 'Open NFPA 25 inspection intervals' }), 'longPress')
    await act(async () => menu(alert, 0, 'Delete'))
    // The confirmation: nothing is deleted until "Delete" in it.
    expect(g.fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false)
    await act(async () => menu(alert, 1, 'Delete'))

    await waitFor(() => expect(inList().queryByText('NFPA 25 inspection intervals')).toBeNull())
    expect(inList().getByText('Sprinkler density for OH2')).toBeTruthy()
  })

  it('New chat in the list starts a fresh chat and closes the list (AC6)', async () => {
    withChats()
    await openChat()
    await fireEvent.press(await openList())
    await screen.findByText('Which density?')

    await fireEvent.press(await screen.findByRole('button', { name: 'Open chats' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Start a new chat' }))

    expect(await screen.findByRole('button', { name: 'NFPA 25 inspection intervals' })).toBeTruthy()
    expect(screen.queryByText('Which density?')).toBeNull()
  })

  it('shows the last copy of the list with no signal (AC9)', async () => {
    withChats()
    await openChat()
    await openList()
    await screen.unmount()

    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch
    await openChat()
    await fireEvent.press(await screen.findByRole('button', { name: 'Open chats' }))

    expect(await screen.findByText('Sprinkler density for OH2')).toBeTruthy()
  })
})
