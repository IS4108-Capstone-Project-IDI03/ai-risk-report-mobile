// MB-16 AC19: on a wide iPad window the Site walks list and the review still work (the workspace sits
// beside Home's list there). The window width is faked through useSplitView, as in site-pins-wide.test.tsx.
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, pointAtTestGateway, routes, signedIn } from '../test/gateway'

pointAtTestGateway()
jest.mock('@/lib/device', () => ({ ...jest.requireActual('@/lib/device'), useSplitView: () => true }))

const REF = 'RPT-2026-0411'
const WALKS = `/api/assessments/${REF}/site-walks`
const proposal = {
  locations: [{ ref: 'loc-1', existingId: null, kind: 'building', building: 'Block A', floor: 'Level 1', name: 'Loading bay' }],
  observations: [
    { ref: 'obs-1', note: 'Pallets block the sprinklers', copeDimension: 'Protection', severity: 'high', locationRef: 'loc-1', recordingSeq: 1, start: 2, end: 9, photoIds: [], check: { severity: false, category: false, location: false } },
  ],
}
const walk = { id: 'w1', status: 'ready', name: 'Yard walk', createdAt: '2026-11-15T03:00:00.000Z', recordings: [], photos: [], media: [], notes: [], typedText: null, error: null, proposal }

beforeEach(() => {
  mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Lobby')] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    [`GET ${WALKS}`]: { status: 200, body: [walk] },
    [`GET ${WALKS}/w1`]: { status: 200, body: walk },
  })
})

it('lists the walk and opens its review on a wide window (AC19)', async () => {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByRole('button', { name: /RPT-2026-0411/ }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Site walk' }))

  const list = within(await screen.findByTestId('site-walks'))
  expect(await list.findByText('Yard walk')).toBeTruthy()
  expect(list.getByText('Ready to review')).toBeTruthy()

  await fireEvent.press(list.getByRole('button', { name: 'Review: Yard walk' }))
  const review = within(await screen.findByTestId('walk-review'))
  expect(await review.findByText('Pallets block the sprinklers')).toBeTruthy()
  expect(review.getByRole('button', { name: 'Create all' })).toBeTruthy()
})
