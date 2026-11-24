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

// AC7: the list can be hidden, so the workspace (observations and checklist) gets the width.
it('hides the list into a slim bar and brings it back (AC7)', async () => {
  gateway()
  await renderRouter(routes)
  await pane().findByText('Northgate Logistics')

  await fireEvent.press(screen.getByRole('button', { name: 'Hide assessments' }))

  expect(screen.queryByTestId('assessment-list')).toBeNull()
  expect(pane().getByText('Northgate Logistics')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Show assessments' }))

  expect(screen.getByTestId('assessment-list')).toBeTruthy()
  expect(screen.getByRole('button', { name: /RPT-2026-0411/ }).props.accessibilityState).toMatchObject({ selected: true })
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

// AC4: on the wide iPad the form opens inside the workspace, in place of the observations,
// with the checklist beside it. Both stay on screen and scroll on their own.
it('opens New observation beside the checklist, inside the workspace (AC4)', async () => {
  gateway()
  await renderRouter(routes)
  await pane().findByText('Northgate Logistics')
  // Jest has no layout pass: tell the workspace its pane is wide enough for side by side.
  await fireEvent(screen.getByTestId('workspace-screen'), 'layout', { nativeEvent: { layout: { width: 996, height: 800, x: 0, y: 0 } } })

  await fireEvent.press(pane().getByRole('button', { name: 'New observation' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Pump room' }))

  // Picking the location returns to the workspace; the next tap opens the form there.
  await fireEvent.press(await screen.findByRole('button', { name: 'New observation' }))

  expect(await screen.findByTestId('capture-sheet')).toBeTruthy()
  expect(pane().getByTestId('checklist-pane')).toBeTruthy()
  expect(pane().queryByTestId('workspace')).toBeNull()

  // Close brings the observations back.
  await fireEvent.press(pane().getByRole('button', { name: 'Close' }))
  expect(await pane().findByTestId('workspace')).toBeTruthy()
  expect(pane().queryByTestId('capture-sheet')).toBeNull()
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

// MB-05 AC22: Confirm on a checklist item fills the form beside the checklist.
it('opens the form beside the checklist when Confirm is tapped (MB-05 AC22)', async () => {
  const item = {
    id: 'i1', area: '7', subsection: null, origin: 'template', hazard: null, text: 'Check the sprinkler heads are clear',
    fields: [], COPE_dimension: ['Protection'], citations: [], flags: [], check: null,
  }
  gateway({
    'GET /api/assessments/RPT-2026-0411/checklist': {
      status: 200,
      body: {
        scope: { facilityType: 'warehouse', jurisdiction: 'SG' },
        standards: [],
        checklist: {
          id: 'c1', facilityType: 'warehouse', jurisdiction: 'SG', standards: [], areas: [{ id: '7', title: 'Construction' }],
          hazards: [], sources: {}, items: [item], provenance: { generated_at: '2026-11-07T02:00:00.000Z' },
        },
      },
    },
  })
  await renderRouter(routes)
  await pane().findByText('Northgate Logistics')
  await fireEvent(screen.getByTestId('workspace-screen'), 'layout', { nativeEvent: { layout: { width: 996, height: 800, x: 0, y: 0 } } })
  await fireEvent.press(pane().getByRole('button', { name: 'New observation' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Pump room' }))
  await screen.findByTestId('workspace')

  await fireEvent.press(await screen.findByText('Check the sprinkler heads are clear'))
  await fireEvent.press(await screen.findByRole('button', { name: /Confirm/ }))

  const form = await screen.findByTestId('capture-sheet')
  expect(within(form).getByDisplayValue('Check the sprinkler heads are clear')).toBeTruthy()
  expect(screen.getByTestId('checklist-pane')).toBeTruthy()
  expect(screen.queryByTestId('answer-sheet')).toBeNull()
})

// The bottom bar: location and the two buttons share one row only when the pane has
// room (1000pt). On an 11-inch iPad's split view (about 820pt) they stack, so
// "Choose where you are" isn't squeezed to one word a line.
it('stacks the location above the buttons in a mid-width pane, one row when wide', async () => {
  gateway({ 'GET /api/assessments/RPT-2026-0411/locations': { status: 200, body: [] } })
  await renderRouter(routes)
  await pane().findByText('Northgate Logistics')

  await fireEvent(screen.getByTestId('workspace-screen'), 'layout', { nativeEvent: { layout: { width: 820, height: 800, x: 0, y: 0 } } })
  expect(screen.getByTestId('workspace-bar-row').props.className).not.toContain('flex-row')

  await fireEvent(screen.getByTestId('workspace-screen'), 'layout', { nativeEvent: { layout: { width: 1100, height: 800, x: 0, y: 0 } } })
  expect(screen.getByTestId('workspace-bar-row').props.className).toContain('flex-row')
})

// The navy band can shrink to one line, to give the workspace the height (wide only).
it('shrinks the band to one line and back (wide)', async () => {
  gateway()
  await renderRouter(routes)
  await pane().findByText('Northgate Logistics')
  await fireEvent(screen.getByTestId('workspace-screen'), 'layout', { nativeEvent: { layout: { width: 996, height: 800, x: 0, y: 0 } } })

  await fireEvent.press(pane().getByRole('button', { name: 'Collapse details' }))

  expect(pane().queryByText('Northgate Logistics')).toBeNull()
  expect(pane().getByText('Tilbury Distribution Centre')).toBeTruthy()
  await fireEvent.press(pane().getByRole('button', { name: 'Show details' }))
  expect(pane().getByText('Northgate Logistics')).toBeTruthy()
})
