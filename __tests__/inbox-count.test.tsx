// MB-22 AC5: Home's Inbox count is read again every 10 seconds while Home is in front, and not once it is
// covered. Its own file, so the fake clock cannot touch the Inbox tests. The gateway is mocked.
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { router } from 'expo-router'
import { View } from 'react-native'
import { InboxButton } from '../src/features/inbox/components/InboxButton'
import { mockGateway, pointAtTestGateway } from '../test/gateway'

pointAtTestGateway()

let todo = 3
const counts = () => mockGateway({ 'GET /api/notifications/count': () => ({ status: 200, body: { total: 0, unread: 0, inboxTodo: todo, newestInbox: null, newestBell: null } }) })

afterEach(() => jest.useRealTimers())

it('reads the count every 10 seconds while the screen is in front, and stops when it is covered', async () => {
  const fetchMock = counts()
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'queueMicrotask'] })
  await renderRouter({
    index: () => <View><InboxButton /></View>,
    inbox: () => <View testID="covering" />,
  })
  expect(await screen.findByRole('button', { name: 'Inbox, 3 to do' })).toBeTruthy()
  const reads = () => fetchMock.mock.calls.length

  // Another window gave this engineer one more.
  todo = 4
  await act(async () => jest.advanceTimersByTime(10_000))
  expect(await screen.findByRole('button', { name: 'Inbox, 4 to do' })).toBeTruthy()

  // Covered by the Inbox: no more reads.
  await fireEvent.press(screen.getByRole('button', { name: 'Inbox, 4 to do' }))
  await screen.findByTestId('covering')
  const before = reads()
  await act(async () => jest.advanceTimersByTime(30_000))
  expect(reads()).toBe(before)
  await act(async () => router.back())
})
