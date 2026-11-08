// MB-09: the iPad split view. With a wide window, Home shows the assessments
// beside the open workspace. The window width is faked through useSplitView;
// every other test runs at phone width. Gateway mocked.
import { fireEvent, renderRouter, screen, testRouter, within } from 'expo-router/testing-library'
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

jest.mock('@/lib/device', () => ({ ...jest.requireActual('@/lib/device'), useSplitView: () => true }))

const tilbury = assessment('RPT-2026-0411', 'capturing', {
  client: 'Northgate Logistics',
  site: { id: 's1', code: 'S-002', name: 'Tilbury Distribution Centre', address: null },
})
const leeds = assessment('RPT-2026-0408', 'under_review', {
  client: 'Fennick Foods',
  site: { id: 's2', code: 'S-003', name: 'Leeds Cold Store', address: null },
})

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [tilbury, leeds] },
    'GET /api/assessments/RPT-2026-0411/observations': { status: 200, body: [] },
    'GET /api/assessments/RPT-2026-0408/observations': { status: 200, body: [] },
    'GET /api/assessments/RPT-2026-0411/locations': { status: 200, body: [location('l1', 'Pump room')] },
    ...overrides,
  })
}

const pane = () => within(screen.getByTestId('workspace-screen'))

it('shows the list beside the capturing assessment’s workspace (AC1, AC2)', async () => {
  gateway()
  await renderRouter(routes)

  expect(await screen.findByTestId('assessment-list')).toBeTruthy()
  expect(await pane().findByText('Northgate Logistics')).toBeTruthy()
  expect(screen.queryByTestId('capturing-now')).toBeNull()
  expect(screen.getByRole('button', { name: /RPT-2026-0411/ }).props.accessibilityState).toMatchObject({ selected: true })
})

it('opens on the assessment whose capture started most recently (AC2)', async () => {
  const earlier = assessment('RPT-2026-0004', 'capturing', {
    client: 'Earlier Client',
    site: { id: 's3', code: 'S-004', name: 'CP26 Test Site', address: null },
    captureStartedAt: '2026-11-05T09:07:00.000Z',
  })
  const startedLast = assessment('RPT-2026-0003', 'capturing', {
    client: 'Fennick Foods',
    site: { id: 's4', code: 'S-005', name: 'Leeds Cold Store', address: null },
    captureStartedAt: '2026-11-06T02:52:00.000Z',
  })
  gateway({
    'GET /api/assessments': { status: 200, body: [earlier, startedLast] },
    'GET /api/assessments/RPT-2026-0003/observations': { status: 200, body: [] },
    'GET /api/assessments/RPT-2026-0003/locations': { status: 200, body: [] },
  })
  await renderRouter(routes)

  expect(await pane().findByText('Fennick Foods')).toBeTruthy()
  expect(pane().queryByText('Earlier Client')).toBeNull()
})

it('asks to choose an assessment when none is capturing (AC2)', async () => {
  gateway({ 'GET /api/assessments': { status: 200, body: [leeds] } })
  await renderRouter(routes)

  expect(await screen.findByText('Choose an assessment')).toBeTruthy()
  expect(screen.queryByTestId('workspace-screen')).toBeNull()
})

it('switches the workspace without leaving Home when a row is tapped (AC3)', async () => {
  gateway()
  await renderRouter(routes)
  await pane().findByText('Northgate Logistics')

  await fireEvent.press(screen.getByRole('button', { name: /RPT-2026-0408/ }))

  expect(await pane().findByText('Fennick Foods')).toBeTruthy()
  expect(screen.getByTestId('assessment-list')).toBeTruthy()
  expect(screen.getByRole('button', { name: /RPT-2026-0408/ }).props.accessibilityState).toMatchObject({ selected: true })
})

it('captures from the right-hand workspace', async () => {
  gateway()
  await renderRouter(routes)
  await pane().findByText('Northgate Logistics')

  await fireEvent.press(pane().getByRole('button', { name: 'New observation' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Pump room' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'New observation' }))

  expect(await screen.findByTestId('capture-sheet')).toBeTruthy()
})

// MB-11 AC8: an observation opened from the right-hand pane fills the window,
// and Back returns to the same split view.
it('opens an observation over the split view and returns to it (MB-11 AC8)', async () => {
  gateway({
    'GET /api/assessments/RPT-2026-0411/observations': {
      status: 200,
      body: [observation('o1', 'l1', { note: 'Valve chained open', location: { id: 'l1', building: null, floor: null, name: 'Pump room' } })],
    },
  })
  await renderRouter(routes)
  await pane().findByText('Northgate Logistics')
  await fireEvent.press(pane().getByRole('button', { name: 'Choose location' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Pump room' }))

  await fireEvent.press(await screen.findByTestId('observation-open'))

  const detail = await screen.findByTestId('observation-detail')
  expect(within(detail).getByText(/Valve chained open/)).toBeTruthy()
  await testRouter.back()
  expect(await screen.findByTestId('assessment-list')).toBeTruthy()
  expect(await pane().findByText('Northgate Logistics')).toBeTruthy()
})
