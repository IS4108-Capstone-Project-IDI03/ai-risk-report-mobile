// MB-14 AC3, AC5, AC8 on a wide iPad: the Chats list is a column beside the chat (no Chats
// button), tapping a chat opens it in place, and deleting the open chat starts over.
// The window width is faked through useSplitView, as in split-view.test.tsx.
import { Alert } from 'react-native'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { mockGateway, openTab, pointAtTestGateway, routes, signedIn } from '../test/gateway'

pointAtTestGateway()
jest.mock('@/lib/device', () => ({ ...jest.requireActual('@/lib/device'), useSplitView: () => true }))

const PROGRAM = 'root = Answer([p1])\np1 = Paragraph([s1])\ns1 = Statement("Inspect quarterly.", [])\n'
let list = [{ id: 't1', title: 'NFPA 25 inspection intervals', createdAt: '2026-11-08T03:00:00.000Z' }]

beforeEach(() => {
  list = [{ id: 't1', title: 'NFPA 25 inspection intervals', createdAt: '2026-11-08T03:00:00.000Z' }]
  mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [] },
    'GET /api/knowledge-documents/ingested': { status: 200, body: [] },
    'GET /api/chat/conversations': () => ({ status: 200, body: { threads: list } }),
    'GET /api/chat/conversations/t1': {
      status: 200,
      body: { messages: [{ id: 'u1', role: 'user', content: 'How often?' }, { id: 'a1', role: 'assistant', content: PROGRAM }], versions: [] },
    },
    'DELETE /api/chat/conversations/t1': () => {
      list = []
      return { status: 204, body: null }
    },
  })
})

async function openChat() {
  await renderRouter(routes)
  await openTab('Chatbot')
}

it('shows the list beside the chat from the start, and the two-line button hides it (AC3)', async () => {
  await openChat()

  expect(await within(await screen.findByTestId('chat-list')).findByText('NFPA 25 inspection intervals')).toBeTruthy()
  expect(screen.queryByTestId('chats-panel')).toBeNull()
  // The chat itself is still there, with its starters.
  expect(await screen.findByRole('button', { name: 'NFPA 25 inspection intervals' })).toBeTruthy()

  await fireEvent.press(screen.getByRole('button', { name: 'Close chats' }))
  expect(screen.queryByTestId('chat-list')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Open chats' }))
  expect(screen.getByTestId('chat-list')).toBeTruthy()
})

it('opens a chat in place when it is tapped (AC5)', async () => {
  await openChat()
  await fireEvent.press(await screen.findByRole('button', { name: 'Open NFPA 25 inspection intervals' }))

  expect(await screen.findByText('How often?')).toBeTruthy()
  expect(await screen.findByText('Inspect quarterly.')).toBeTruthy()
  expect(screen.getByTestId('chat-list')).toBeTruthy()
})

it('starts over when the open chat is deleted (AC8)', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  await openChat()
  await fireEvent.press(await screen.findByRole('button', { name: 'Open NFPA 25 inspection intervals' }))
  await screen.findByText('How often?')

  // Press and hold, then Delete in the menu, then Delete in the confirmation.
  const press = (n: number) => (alert.mock.calls[n][2] as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Delete')!.onPress!()
  await fireEvent(screen.getByRole('button', { name: 'Open NFPA 25 inspection intervals' }), 'longPress')
  await act(async () => press(0))
  await act(async () => press(1))

  await waitFor(() => expect(screen.queryByText('How often?')).toBeNull())
  expect(within(screen.getByTestId('chat-list')).queryByText('NFPA 25 inspection intervals')).toBeNull()
})
