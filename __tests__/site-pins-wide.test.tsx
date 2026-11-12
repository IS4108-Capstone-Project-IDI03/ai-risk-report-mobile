// MB-02 AC34: on a wide iPad the Site pins screen is two columns, the map filling the left and the
// rows (and the edit panel) in a column on the right. The window width is faked through
// useSplitView, as in split-view.test.tsx.
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, pointAtTestGateway, routes, signedIn } from '../test/gateway'

pointAtTestGateway()
jest.mock('@/lib/device', () => ({ ...jest.requireActual('@/lib/device'), useSplitView: () => true }))

const REF = 'RPT-2026-0411'

beforeEach(() => {
  const site = { id: 's1', code: 'S-002', name: 'Tilbury', address: null, coordinates: { lat: 1.2966, lng: 103.852 }, pins: [] }
  mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing', { site })] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Lobby', 'Block A')] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
  })
})

async function openSitePins() {
  await renderRouter(routes)
  // On this width the workspace sits beside Home's list, so tap the row first.
  await fireEvent.press(await screen.findByRole('button', { name: /RPT-2026-0411/ }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Site pins' }))
  return within(await screen.findByTestId('site-pins'))
}

it('shows the map and the rows side by side, with no Hide map bar (AC34)', async () => {
  const pins = await openSitePins()

  expect(pins.getByTestId('site-map')).toBeTruthy()
  expect(pins.getByTestId('pin-row-Site')).toBeTruthy()
  expect(pins.getByTestId('pin-row-Block A')).toBeTruthy()
  expect(pins.queryByRole('button', { name: 'Hide map' })).toBeNull()
  expect(pins.getByTestId('pins-columns')).toBeTruthy()
})

it('keeps the edit panel in the right-hand column, beside the map (AC34)', async () => {
  const pins = await openSitePins()

  await fireEvent.press(pins.getByRole('button', { name: 'Set Block A pin' }))

  expect(within(pins.getByTestId('pins-side')).getByTestId('edit-pin')).toBeTruthy()
  expect(pins.getByTestId('site-map')).toBeTruthy()
})
