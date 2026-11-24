// MB-19 (web CP-60): the Calendar tab. Real routes, gateway mocked. "Today" is fixed at
// Wednesday 18 Nov 2026 (only Date is faked). The window is phone width (a compact month
// with dots) unless a test sets `mockWide`, which turns on the wide grid of bars.
import { act, fireEvent, renderRouter, screen, testRouter, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, openTab, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

pointAtTestGateway()

let mockWide = false
jest.mock('@/lib/device', () => ({
  ...jest.requireActual('@/lib/device'),
  useCalendarGrid: () => mockWide,
}))

beforeEach(() => {
  mockWide = false
  online = true
  // Only the clock is fake: timers and promises run for real.
  jest.useFakeTimers({
    now: new Date(2026, 10, 18, 9),
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'],
  })
})
afterEach(() => jest.useRealTimers())

const me = { id: 'u1', name: 'Ava Tan' }
const site = (id: string, name: string) => ({ id, code: id, name, address: null })
const A = assessment('RPT-A', 'capturing', {
  client: 'Harbour Malls', surveyType: 'Resurvey', site: site('s1', 'Marina Point'),
  siteVisitDate: '2026-11-17', siteVisitEndDate: '2026-11-19', reportDueDate: '2026-11-30', engineer: me,
  siteContacts: [{ name: 'Mei Lin', role: 'Facilities manager' }],
})
const B = assessment('RPT-B', 'draft', {
  client: 'Northgate', surveyType: 'First survey', site: site('s2', 'Tilbury Centre'),
  siteVisitDate: '2026-11-25', siteVisitEndDate: null, reportDueDate: '2026-11-12', engineer: me,
})
const C = assessment('RPT-C', 'not_started', {
  client: 'Fennick Foods', surveyType: 'Follow-up visit', site: site('s3', 'Leeds Cold Store'),
  siteVisitDate: null, reportDueDate: null, engineer: me,
})
const D = assessment('RPT-D', 'capturing', {
  client: 'Sable Retail', surveyType: 'First survey', site: site('s4', 'Dock Road'),
  siteVisitDate: '2026-11-20', reportDueDate: null, engineer: { id: 'u2', name: 'Ben Lim' },
})
const ARCHIVED = assessment('RPT-X', 'archived', { site: site('s5', 'Old Depot'), siteVisitDate: '2026-11-18', engineer: me })

let list: object[]
let online = true
type Route = Reply | ((init?: RequestInit) => Reply)
function gateway(overrides: Record<string, Route> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': () => (online ? { status: 200, body: list } : new Error('offline')),
    'GET /api/assessments/RPT-A/observations': { status: 200, body: [] },
    'GET /api/assessments/RPT-A/locations': { status: 200, body: [location('l1', 'Pump room')] },
    ...overrides,
  })
}
const open = async () => {
  await renderRouter(routes)
  await openTab('Calendar')
  await screen.findByTestId('calendar')
}
const calendar = () => within(screen.getByTestId('calendar'))
// Taps a day in the month (the phone's grid, or the wide grid's cell, which opens its week).
const day = async (spoken: string) => fireEvent.press(await calendar().findByRole('button', { name: spoken }))
// Opens the sheet that slides up for a day.
const today = () => day('Wednesday 18 Nov 2026')
// The first match: a late report is in the Late list and in its day.
const label = async (re: RegExp) => (await calendar().findAllByRole('button', { name: re }))[0]

beforeEach(() => void (list = [A, B, C, D, ARCHIVED]))

describe('on a phone: a month grid (AC15)', () => {
  it('shows the month as a grid with dots, today picked, and leaves archived out (AC1, AC2)', async () => {
    gateway()
    await open()

    expect(await calendar().findByText('November 2026')).toBeTruthy()
    expect(calendar().getByTestId('phone-month')).toBeTruthy()
    // The grid fills the screen: no sheet until a day is tapped.
    expect(calendar().queryByTestId('day-sheet')).toBeNull()
    // Today (18 Nov): the three-day survey covers it, and the archived one (also 18 Nov) is left out.
    await today()
    expect(calendar().getByText('Today · Wed 18 Nov')).toBeTruthy()
    expect(await label(/Resurvey, Marina Point, Harbour Malls, 17 Nov 2026 to 19 Nov 2026/)).toBeTruthy()
    expect(calendar().queryByText(/Old Depot/)).toBeNull()
    // A day with nothing says so; a day with entries says how many.
    await day('Monday 16 Nov 2026')
    expect(calendar().getByText('Nothing on this day.')).toBeTruthy()
    expect(calendar().getByRole('button', { name: 'Tuesday 17 Nov 2026' }).props.accessibilityValue.text).toBe('1 entry')
    // The survey is on each of its three days.
    await day('Thursday 19 Nov 2026')
    expect(await label(/Resurvey, Marina Point/)).toBeTruthy()
    // No week on a phone, and not the wide grid of bars.
    expect(calendar().queryByRole('button', { name: 'Week' })).toBeNull()
    expect(calendar().queryByTestId('calendar-grid')).toBeNull()
  })

  it('counts a due date as late, soon or on track (AC3)', async () => {
    gateway()
    await open()

    await day('Thursday 12 Nov 2026')
    expect(await label(/Report due, Tilbury Centre, Northgate, 12 Nov 2026, 6 days late/)).toBeTruthy()
    await day('Monday 30 Nov 2026')
    expect(await label(/Report due, Marina Point, Harbour Malls, 30 Nov 2026, in 12 days/)).toBeTruthy()
  })

  it('lists late reports oldest first, and the footer opens the oldest late month (AC7)', async () => {
    const overdue = assessment('RPT-L', 'draft', { site: site('s6', 'Early Depot'), siteVisitDate: '2026-11-02', reportDueDate: '2026-10-05', engineer: me })
    list = [A, B, overdue]
    gateway()
    await open()

    const late = within(await screen.findByText('Late reports').then((t) => t.parent!.parent!))
    expect(late.getAllByText(/days late/).map((n) => n.props.children.join?.('') ?? n.props.children)).toEqual(
      expect.arrayContaining([expect.stringContaining('44 days late'), expect.stringContaining('6 days late')]),
    )
    await fireEvent.press(await calendar().findByRole('button', { name: '2 reports late' }))
    expect(await calendar().findByText('October 2026')).toBeTruthy()
    expect(calendar().getByRole('button', { name: 'Report due dates' }).props.accessibilityState.selected).toBe(true)
  })

  it('lists assessments with no survey date, and Set dates opens the form (AC7, AC12)', async () => {
    gateway()
    await open()

    expect(await calendar().findByText('Leeds Cold Store')).toBeTruthy()
    await fireEvent.press(await calendar().findByRole('button', { name: 'Set dates for Leeds Cold Store' }))
    expect(within(await screen.findByTestId('reschedule-sheet')).getByText('Reschedule Leeds Cold Store')).toBeTruthy()
  })

  it('steps months, goes to Today, and filters by dates and type (AC4, AC6)', async () => {
    gateway()
    await open()
    await today()
    await label(/Marina Point/)

    // Another month closes the sheet; a day there opens its own.
    await fireEvent.press(calendar().getByRole('button', { name: 'Next month' }))
    expect(await calendar().findByText('December 2026')).toBeTruthy()
    expect(calendar().queryByTestId('day-sheet')).toBeNull()
    await day('Tuesday 1 Dec 2026')
    expect(calendar().getByText('Tue 1 Dec')).toBeTruthy()
    expect(calendar().getByText('Nothing on this day.')).toBeTruthy()
    await fireEvent.press(calendar().getByRole('button', { name: 'Today' }))
    expect(await calendar().findByText('November 2026')).toBeTruthy()

    await fireEvent.press(calendar().getByRole('button', { name: 'Survey dates' }))
    // The month's days lose the due dates; the Late list follows only the type (AC5).
    await day('Thursday 12 Nov 2026')
    expect(calendar().getByText('Nothing on this day.')).toBeTruthy()
    await day('Wednesday 18 Nov 2026')
    // The survey is a bar in the grid and a row in the day's sheet, both named the same.
    expect(calendar().getAllByRole('button', { name: /Resurvey, Marina Point/ }).length).toBeGreaterThan(0)

    await fireEvent.press(calendar().getByRole('button', { name: 'Follow-up' }))
    // Only a Follow-up is left, so the count and both lists follow it.
    expect(calendar().getByText('1 assessment')).toBeTruthy()
    expect(calendar().queryByRole('button', { name: /Resurvey, Marina Point/ })).toBeNull()
    expect(calendar().getByText('No late reports match.')).toBeTruthy()
  })
})

describe('entry details and Open assessment (AC8, AC9, AC13, AC17)', () => {
  it('shows the details of an entry', async () => {
    gateway()
    await open()
    await today()
    await fireEvent.press(await label(/Resurvey, Marina Point/))

    const sheet = within(await screen.findByTestId('entry-details'))
    for (const text of ['Marina Point', 'Harbour Malls', 'RPT-A', 'Resurvey', 'Capturing', '17 Nov 2026 to 19 Nov 2026', 'Mei Lin · Facilities manager'])
      expect(sheet.getByText(text)).toBeTruthy()
    expect(sheet.getByText(/30 Nov 2026/)).toBeTruthy()
  })

  it('opens the assessment, and Back finds the same period and filters', async () => {
    gateway()
    await open()
    await fireEvent.press(await calendar().findByRole('button', { name: 'Next month' }))
    await fireEvent.press(calendar().getByRole('button', { name: 'Survey dates' }))
    await fireEvent.press(await calendar().findByRole('button', { name: 'Previous month' }))
    await today()
    await fireEvent.press(await label(/Marina Point/))
    await fireEvent.press(within(await screen.findByTestId('entry-details')).getByRole('button', { name: 'Open assessment' }))
    expect(await screen.findByTestId('workspace')).toBeTruthy()

    await testRouter.back()
    expect(await calendar().findByText('November 2026')).toBeTruthy()
    expect(calendar().getByRole('button', { name: 'Survey dates' }).props.accessibilityState.selected).toBe(true)
  })

  it("greys Reschedule on someone else's assessment, with the reason", async () => {
    gateway()
    await open()
    await day('Friday 20 Nov 2026')
    await fireEvent.press(await label(/Dock Road/))

    const sheet = within(await screen.findByTestId('entry-details'))
    expect(sheet.getByText('Ben Lim')).toBeTruthy()
    expect(sheet.getByText('Only the assigned engineer can change these dates.')).toBeTruthy()
    expect(sheet.getByRole('button', { name: 'Reschedule' }).props.accessibilityState.disabled).toBe(true)
  })
})

describe('Reschedule (AC10, AC11)', () => {
  const sheet = () => within(screen.getByTestId('reschedule-sheet'))
  async function openReschedule() {
    await open()
    await today()
    await fireEvent.press(await label(/Resurvey, Marina Point/))
    await fireEvent.press(within(await screen.findByTestId('entry-details')).getByRole('button', { name: 'Reschedule' }))
    await screen.findByTestId('reschedule-sheet')
  }
  // Taps a date field and picks a day in the native picker.
  async function pick(field: string, day: Date) {
    await fireEvent.press(sheet().getByRole('button', { name: field }))
    await fireEvent(await screen.findByTestId('date-picker'), 'valueChange', {}, day)
  }

  it('saves all three dates with the type unchanged, then redraws from a fresh list', async () => {
    let body: Record<string, unknown> = {}
    gateway({
      'PUT /api/assessments/RPT-A': (init) => {
        body = JSON.parse(init!.body as string)
        list = [{ ...A, siteVisitDate: '2026-11-20', siteVisitEndDate: '2026-11-22' }, B, C, D]
        return { status: 204 }
      },
    })
    await openReschedule()
    // Greyed until something changes.
    expect(sheet().getByRole('button', { name: 'Save dates' }).props.accessibilityState.disabled).toBe(true)

    await pick('Survey start', new Date(2026, 10, 20, 12))
    await pick('Survey end', new Date(2026, 10, 22, 12))
    await fireEvent.press(sheet().getByRole('button', { name: 'Save dates' }))

    expect(body).toEqual({ surveyType: 'Resurvey', siteVisitDate: '2026-11-20', siteVisitEndDate: '2026-11-22', reportDueDate: '2026-11-30' })
    expect(await calendar().findByText('Dates saved for RPT-A.')).toBeTruthy()
    // 18 Nov is no longer in its days; 21 Nov is.
    await day('Saturday 21 Nov 2026')
    expect(await label(/Marina Point, Harbour Malls, 20 Nov 2026 to 22 Nov 2026/)).toBeTruthy()
  })

  it('counts an end on the start day as no change, since the gateway keeps no end for one day', async () => {
    gateway()
    await open()
    await day('Wednesday 25 Nov 2026')
    await fireEvent.press(await label(/First survey, Tilbury Centre, Northgate, 25 Nov 2026/))
    await fireEvent.press(within(await screen.findByTestId('entry-details')).getByRole('button', { name: 'Reschedule' }))
    await pick('Survey end', new Date(2026, 10, 25, 12))

    expect(sheet().getByRole('button', { name: 'Save dates' }).props.accessibilityState.disabled).toBe(true)
  })

  it('clears the survey end and the due date', async () => {
    let body: Record<string, unknown> = {}
    gateway({ 'PUT /api/assessments/RPT-A': (init) => ((body = JSON.parse(init!.body as string)), { status: 204 }) })
    await openReschedule()

    await fireEvent.press(sheet().getByRole('button', { name: 'Clear Survey end' }))
    await fireEvent.press(sheet().getByRole('button', { name: 'Clear Report due' }))
    await fireEvent.press(sheet().getByRole('button', { name: 'Save dates' }))

    expect(body).toMatchObject({ siteVisitDate: '2026-11-17', siteVisitEndDate: '', reportDueDate: '' })
  })

  it('blocks an end before the start, an end with no start, and a due before the start', async () => {
    const g = gateway({ 'PUT /api/assessments/RPT-A': { status: 204 } })
    await openReschedule()
    const puts = () => g.mock.calls.filter(([, init]) => init?.method === 'PUT')

    await pick('Survey end', new Date(2026, 10, 15, 12))
    await fireEvent.press(sheet().getByRole('button', { name: 'Save dates' }))
    expect(await sheet().findByText('Pick a day on or after 17 Nov 2026, the survey start.')).toBeTruthy()

    await pick('Report due', new Date(2026, 10, 10, 12))
    await fireEvent.press(sheet().getByRole('button', { name: 'Clear Survey start' }))
    await fireEvent.press(sheet().getByRole('button', { name: 'Save dates' }))
    expect(await sheet().findByText('Add the survey start.')).toBeTruthy()
    expect(puts()).toHaveLength(0)
  })

  it("shows the gateway's refusal beside the field and keeps the sheet open", async () => {
    gateway({ 'PUT /api/assessments/RPT-A': { status: 400, body: { error: 'The assessment details are invalid.', fields: { reportDueDate: 'Report due must be a real day.' } } } })
    await openReschedule()

    await pick('Report due', new Date(2026, 10, 28, 12))
    await fireEvent.press(sheet().getByRole('button', { name: 'Save dates' }))

    expect(await sheet().findByText('Report due must be a real day.')).toBeTruthy()
    expect(sheet().getByText('Dates not saved')).toBeTruthy()
    expect(sheet().getByText('Fix the dates marked below, then save again.')).toBeTruthy()
  })

  it('Set dates puts an unscheduled assessment on the calendar', async () => {
    gateway({
      'PUT /api/assessments/RPT-C': () => {
        list = [A, B, { ...C, siteVisitDate: '2026-11-23' }, D]
        return { status: 204 }
      },
    })
    await open()
    await fireEvent.press(await calendar().findByRole('button', { name: 'Set dates for Leeds Cold Store' }))
    await pick('Survey start', new Date(2026, 10, 23, 12))
    await fireEvent.press(sheet().getByRole('button', { name: 'Save dates' }))

    // It left the No survey date list and is on its day.
    await waitFor(() => expect(calendar().queryByRole('button', { name: 'Set dates for Leeds Cold Store' })).toBeNull())
    await day('Monday 23 Nov 2026')
    expect(await label(/Follow-up, Leeds Cold Store, Fennick Foods, 23 Nov 2026/)).toBeTruthy()
  })
})

it('offline: shows the saved list and greys Reschedule with its reason (AC14)', async () => {
  gateway()
  await open()
  await today()
  await label(/Marina Point/)

  online = false
  await openTab('Home')
  await openTab('Calendar')
  await today()
  await fireEvent.press(await label(/Resurvey, Marina Point/))

  const sheet = within(await screen.findByTestId('entry-details'))
  expect(sheet.getByText('Connect to reschedule.')).toBeTruthy()
  expect(sheet.getByRole('button', { name: 'Reschedule' }).props.accessibilityState.disabled).toBe(true)
})

describe('on a wide window: the grid (AC16)', () => {
  beforeEach(() => void (mockWide = true))

  it('draws a survey as one bar, three entries then "+N more" that opens the week (AC2, AC4)', async () => {
    const busy = ['RPT-1', 'RPT-2', 'RPT-3', 'RPT-4'].map((r, i) =>
      assessment(r, 'draft', { client: 'Busy Co', surveyType: 'First survey', site: site(`b${i}`, `Busy ${i}`), siteVisitDate: '2026-11-26', reportDueDate: null, engineer: me }),
    )
    list = [A, ...busy]
    gateway()
    await open()

    expect(await calendar().findByTestId('calendar-grid')).toBeTruthy()
    // One bar across three days: one button, not three.
    expect(calendar().getAllByRole('button', { name: /Resurvey, Marina Point/ })).toHaveLength(1)
    expect(calendar().getByText('+1 more')).toBeTruthy()
    expect(calendar().queryAllByRole('button', { name: /First survey, Busy/ })).toHaveLength(3)

    await fireEvent.press(calendar().getByRole('button', { name: /1 more on Thursday 26 Nov 2026/ }))
    expect(await calendar().findByText('23 – 29 Nov 2026')).toBeTruthy()
    expect(calendar().getAllByRole('button', { name: /First survey, Busy/ })).toHaveLength(4)
  })

  it('opens the week that holds today when switching from the month (AC3)', async () => {
    gateway()
    await open()

    await fireEvent.press(await calendar().findByRole('button', { name: 'Week' }))
    expect(await calendar().findByText('16 – 22 Nov 2026')).toBeTruthy()
    expect(calendar().getByRole('button', { name: /Resurvey, Marina Point/ })).toBeTruthy()
    await fireEvent.press(calendar().getByRole('button', { name: 'Next week' }))
    expect(await calendar().findByText('23 – 29 Nov 2026')).toBeTruthy()
  })

  it("opens a day's week by tapping the day", async () => {
    gateway()
    await open()

    await fireEvent.press(await calendar().findByRole('button', { name: 'Wednesday 25 Nov 2026' }))
    expect(await calendar().findByText('23 – 29 Nov 2026')).toBeTruthy()
  })
})
