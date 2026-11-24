// MB-20 (web AS-06): the Overview of an assessment's workspace: an Overview button in the band that
// opens the MarshBot screen, and from there the Overview sheet, on the phone and the iPad alike. Real routes, gateway mocked. It reads
// GET .../assistant/summary, which is read only; the web's GET .../assistant (records an open,
// can start paid AI) is never called.
import { act, fireEvent, renderRouter, screen, testRouter, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, observation, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

pointAtTestGateway()

// Whole-app tests: opening the sheet goes through the chat and back, which needs more than Jest's 5 s on a busy machine.
jest.setTimeout(20000)

const REF = 'RPT-2026-0411'
const SUMMARY = `GET /api/assessments/${REF}/assistant/summary`

const glance = [
  { icon: 'camera', label: 'Observations', value: '3', tone: 'normal' },
  { icon: 'list-checks', label: 'Checklist', value: '0 of 44', tone: 'amber' },
  { icon: 'calendar', label: 'Report Due', value: '19 Nov', tone: 'red' },
]
const row = (id: string, weight: string, link: object | null, extra: object = {}) => ({
  id,
  weight,
  icon: 'circle-alert',
  title: `Title ${id}`,
  detail: `Detail ${id}`,
  link,
  ...extra,
})
// The gateway's summary (server/src/services/assistant/summary.ts), with what a test changes.
const summary = (extra: object = {}) => ({
  reference: REF,
  stage: 'capture',
  stageLabel: 'Capture',
  stageIndex: 2,
  glance,
  next: { text: 'A recording could not be transcribed.', link: { tab: 'observations' }, label: 'Open observations' },
  items: [row('fix1', 'fix_now', { tab: 'observations', params: { obs: 'o9' } }), row('gap1', 'gap', { tab: 'checklist' })],
  areas: [{ area: 'Security', covered: 1, total: 4, link: { tab: 'checklist', params: { area: 'Security' } } }],
  updatedAt: '2026-11-19T02:00:00.000Z',
  ...extra,
})

const chat = {
  reference: REF,
  viewer: 'engineer',
  stage: 'capture',
  status: { text: 'On track', tone: 'green', icon: 'circle-check' },
  glance,
  session: { id: 's1', turns: [] },
  replies: [],
  thinking: false,
  updatedAt: '2026-11-20T03:00:00.000Z',
}

let reply: Reply | (() => Reply)
let online = true

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Staircase', 'Block B', 'Level 2')] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [observation('o9', 'l1', { note: 'Valve' })] },
    [`GET /api/assessments/${REF}/checklist`]: { status: 200, body: { scope: { facilityType: 'warehouse', jurisdiction: 'SG' }, standards: [], checklist: null } },
    [`GET /api/assessments/${REF}/site-walks`]: { status: 200, body: [] },
    // The chat the bar opens (MB-20); these tests are about the sheet, so it is empty.
    [`GET /api/assessments/${REF}/assistant`]: () => (!online ? new TypeError('Network request failed') : { status: 200, body: chat }),
    [SUMMARY]: () => (!online ? new TypeError('Network request failed') : typeof reply === 'function' ? reply() : reply),
    ...overrides,
  })
}
// `wide`: Jest has no layout pass, so tell the workspace its pane is as wide as an iPad's (side by side).
async function openWorkspace(wide = false) {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  if (wide) await fireEvent(screen.getByTestId('workspace-screen'), 'layout', { nativeEvent: { layout: { width: 996, height: 800, x: 0, y: 0 } } })
}
// The Overview bar (phone and iPad) and its sheet.
const overviewButton = (name: RegExp | string = /^Overview/) => screen.findByRole('button', { name })
// The sheet opens from the chat's Summary button (MB-20): tap the bar, then Summary in the chat, which comes back here.
async function sheet() {
  await fireEvent.press(await overviewButton())
  await fireEvent.press(await screen.findByRole('button', { name: 'Summary' }))
  return within(await screen.findByTestId('overview-sheet'))
}

beforeEach(() => {
  jest.restoreAllMocks()
  online = true
  reply = { status: 200, body: summary() }
})

describe('the Overview button on the phone (A)', () => {
  it('sits in the band beside Site pins with a count of what the phone can act on; no card above the list', async () => {
    gateway()
    await openWorkspace()

    // The fixture's observation fix and checklist gap, plus the Security area: 1 to fix, 2 gaps.
    // The full-width bar (changed 20 Nov, Miya, from the web's phone view): the stage, eight segments and one chip.
    const button = await overviewButton('Overview, 1 to fix, 2 gaps')
    expect(within(button).getByText('Capture · stage 3 of 8')).toBeTruthy()
    expect(within(button).getByText('1 to fix')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Site pins' })).toBeTruthy()
    // The Scans button was taken out of the band (19 Nov, Miya).
    expect(screen.queryByRole('button', { name: 'Scans' })).toBeNull()
    expect(screen.queryByTestId('overview-card')).toBeNull()
    // The list starts straight under the switch: nothing of the Overview is above it.
    expect(screen.getByTestId('workspace')).toBeTruthy()
  })

  it('counts gaps when nothing is to fix, and shows the report due note beside the chip', async () => {
    reply = { status: 200, body: summary({ items: [], areas: [{ area: 'Security', covered: 1, total: 4, link: { tab: 'checklist', params: { area: 'Security' } } }] }) }
    gateway({ 'GET /api/assessments': { status: 200, body: [{ ...assessment(REF, 'capturing'), reportDueDate: '2020-01-01' }] } })
    await openWorkspace()

    const button = await overviewButton('Overview, 1 gap')
    expect(within(button).getByText('1 gap')).toBeTruthy()
    // The Home card's note (dueNote), with "Report" in front: the report is past its due date.
    expect(within(button).getByText('Report overdue')).toBeTruthy()
  })

  it('opens a sheet with the stage, the next step, then To fix, Gaps and the thin areas (AC1-AC6)', async () => {
    gateway()
    await openWorkspace()
    const sh = await sheet()

    expect(sh.getByText('Capture · stage 3 of 8')).toBeTruthy()
    expect(within(sh.getByTestId('next-step')).getByText('A recording could not be transcribed.')).toBeTruthy()
    expect(sh.getByRole('button', { name: 'Open observations' })).toBeTruthy()
    expect(sh.getByText('To fix · 1')).toBeTruthy()
    expect(sh.getByText('Gaps · 2')).toBeTruthy()
    expect(sh.getByRole('button', { name: /^Fix now, Title fix1/ })).toBeTruthy()
    expect(sh.getByRole('button', { name: /^Gap, Title gap1/ })).toBeTruthy()
    expect(sh.getByText('Security')).toBeTruthy()
    expect(sh.getByText('1 of 4')).toBeTruthy()
    // No tiles on the phone: the observation count is already on the screen.
    expect(sh.queryByLabelText('Report Due, 19 Nov')).toBeNull()
  })

  it('puts what only the web can do under On the web, greyed, leaves it out of the count, and makes the phone\'s next step the first thing it can do (AC10)', async () => {
    reply = {
      status: 200,
      body: summary({
        items: [row('f1', 'fix_now', { tab: 'observations', params: { obs: 'o9' } }), row('r1', 'fix_now', { tab: 'generate' }), row('r2', 'reminder', { tab: 'review' })],
        areas: [],
        next: { text: "Review each section's findings.", link: { tab: 'review' }, label: 'Open Review' },
      }),
    }
    gateway()
    await openWorkspace()
    await overviewButton('Overview, 1 to fix, 0 gaps')
    const sh = await sheet()

    // The gateway's next step is a web-only Review; the phone's is the first item it can act on.
    expect(within(sh.getByTestId('next-step')).getByText('Title f1: Detail f1.')).toBeTruthy()
    expect(sh.getByRole('button', { name: 'Open observations' })).toBeTruthy()
    expect(sh.queryByRole('button', { name: 'Open Review' })).toBeNull()
    expect(sh.getByText('On the web · 2')).toBeTruthy()
    const web = sh.getByRole('button', { name: /^Fix now, Title r1/ })
    expect(web.props.accessibilityState.disabled).toBe(true)
    expect(sh.getAllByText(/Continue on the web\./).length).toBeGreaterThan(0)
  })

  it('has no count and says "Nothing needs you right now." when nothing is open (AC7)', async () => {
    reply = { status: 200, body: summary({ items: [], areas: [], next: { text: 'The report is exported. Nothing more to do.', link: null, label: null } }) }
    gateway()
    await openWorkspace()

    const button = await overviewButton('Overview, 0 gaps')
    expect(within(button).getByText('All clear')).toBeTruthy()
    const sh = await sheet()
    expect(sh.getByText('Nothing needs you right now.')).toBeTruthy()
  })

  it('closes with Close, and the button is there again (AC3)', async () => {
    gateway()
    await openWorkspace()
    const sh = await sheet()

    await fireEvent.press(sh.getAllByRole('button', { name: 'Close' })[0])
    await waitFor(() => expect(screen.queryByTestId('overview-sheet')).toBeNull())
    expect(await overviewButton()).toBeTruthy()
  })

  it('goes straight to the checklist, an observation or the site walks, closing the sheet first (AC8, AC9)', async () => {
    reply = { status: 200, body: summary({ next: { text: 'Read the checklist.', link: { tab: 'checklist' }, label: 'Open checklist' } }) }
    gateway()
    await openWorkspace()
    let sh = await sheet()
    await fireEvent.press(sh.getByRole('button', { name: 'Open checklist' }))
    expect((await screen.findByRole('tab', { name: 'Checklist' })).props.accessibilityState.selected).toBe(true)
    expect(screen.queryByTestId('overview-sheet')).toBeNull()

    sh = await sheet()
    await fireEvent.press(sh.getByRole('button', { name: /^Fix now, Title fix1/ }))
    await waitFor(() => expect(screen).toHavePathname(`/assessment/${REF}/observation/o9`))
  })
})

describe('the Uncategorised gap (AC9)', () => {
  const held = [
    observation('o1', 'l1', { note: 'Roof covering', copeDimensions: ['Construction'] }),
    observation('o2', 'l2', { note: 'Valve four', location: { id: 'l2', building: null, floor: null, name: 'Boiler room' } }),
    observation('o3', 'l1', { note: 'Pallets by the beam' }),
  ]
  const uncategorised = row('uncategorised', 'gap', { tab: 'observations' }, { title: 'Uncategorised Observations', detail: '2 observations with no category yet' })

  it('lists the observations with no category under the gap, each tappable, and leaves the main list as it is', async () => {
    reply = { status: 200, body: summary({ items: [uncategorised], areas: [] }) }
    gateway({ [`GET /api/assessments/${REF}/observations`]: { status: 200, body: held } })
    await openWorkspace()
    // No location is chosen, so the main list shows none.
    expect(screen.queryByText('Valve four')).toBeNull()
    const sh = await sheet()

    // Both without a category, from every location, each with where it was found; not the categorised one.
    expect(sh.getByText('2 observations with no category yet')).toBeTruthy()
    expect(sh.getByRole('button', { name: 'Valve four, Boiler room' })).toBeTruthy()
    expect(sh.getByRole('button', { name: 'Pallets by the beam, Any' })).toBeTruthy()
    expect(sh.queryByText('Roof covering')).toBeNull()

    await fireEvent.press(sh.getByRole('button', { name: 'Valve four, Boiler room' }))

    await waitFor(() => expect(screen).toHavePathname(`/assessment/${REF}/observation/o2`))
  })

  it('opens the first one from the next step button', async () => {
    reply = { status: 200, body: summary({ items: [uncategorised], areas: [], next: { text: 'Report 12 days overdue.', link: { tab: 'review' }, label: 'Open Review' } }) }
    gateway({ [`GET /api/assessments/${REF}/observations`]: { status: 200, body: held } })
    await openWorkspace()
    const sh = await sheet()

    // The phone's next step is the gap it can act on, not the web-only report.
    await fireEvent.press(sh.getByRole('button', { name: 'Open the first one' }))

    await waitFor(() => expect(screen).toHavePathname(`/assessment/${REF}/observation/o2`))
  })
})

describe('the Overview button: fresh and honest (C)', () => {
  it("has no button on someone else's assessment (403)", async () => {
    reply = { status: 403, body: { error: 'Only the assigned engineer can open this.' } }
    gateway()
    await openWorkspace()

    // Site pins is there once the band has drawn; the Overview button never is.
    await screen.findByRole('button', { name: 'Site pins' })
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Overview/ })).toBeNull())
    expect(screen.queryByText(/Only the assigned engineer/)).toBeNull()
  })

  it('says an archived assessment is archived, in the sheet (409)', async () => {
    reply = { status: 409, body: { error: `Assessment ${REF} is archived.` } }
    gateway()
    await openWorkspace()
    const sh = await sheet()

    expect(await sh.findByText('This assessment is archived.')).toBeTruthy()
  })

  it('says so with no signal and no copy (AC12)', async () => {
    online = false
    gateway()
    await openWorkspace()
    const sh = await sheet()

    expect(await sh.findByText("Can't show the next step. Connect, then pull down to try again.")).toBeTruthy()
  })

  it('shows the last copy with no signal (AC12)', async () => {
    gateway()
    await openWorkspace()
    await overviewButton('Overview, 1 to fix, 2 gaps')

    await testRouter.back()
    online = false
    await fireEvent.press(await screen.findByText(REF))
    expect(await overviewButton('Overview, 1 to fix, 2 gaps')).toBeTruthy()
  })
})

// Changed 24 Nov (Miya): the iPad uses the phone's Overview bar, which opens the MarshBot screen, and the same sheet
// from its Summary button. The inline card is gone: it filled 370pt of an 11-inch iPad's 686pt pane and pushed the
// bottom bar under the tab bar. The sheet's own content is tested above (it is the same component).
describe('the Overview bar on the iPad (A)', () => {
  it('shows the bar, not a card, and opens the MarshBot screen from it', async () => {
    gateway()
    await openWorkspace(true)

    const button = await overviewButton('Overview, 1 to fix, 2 gaps')
    expect(within(button).getByText('Capture · stage 3 of 8')).toBeTruthy()
    expect(screen.queryByTestId('overview-card')).toBeNull()

    await fireEvent.press(button)
    expect(await screen.findByRole('button', { name: 'Summary' })).toBeTruthy()
  })

  it('opens the Overview sheet from Summary, in a wide pane too', async () => {
    gateway()
    await openWorkspace(true)
    await fireEvent.press(await overviewButton())
    await fireEvent.press(await screen.findByRole('button', { name: 'Summary' }))
    // Coming back may mount the workspace again, which starts narrow: widen it again.
    await fireEvent(await screen.findByTestId('workspace-screen'), 'layout', { nativeEvent: { layout: { width: 996, height: 800, x: 0, y: 0 } } })

    expect(await screen.findByTestId('overview-sheet')).toBeTruthy()
  })
})

describe('read only (D)', () => {
  it('sends one GET to the summary and nothing to the web conversation (AC14, AC15)', async () => {
    const fetchMock = gateway()
    await openWorkspace()
    await overviewButton('Overview, 1 to fix, 2 gaps')

    const assistant = fetchMock.mock.calls
      .filter(([url]) => new URL(String(url)).pathname.includes('/assistant'))
      .map(([url, init]) => `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}`)
    expect(assistant).toEqual([`GET /api/assessments/${REF}/assistant/summary`])
  })
})
