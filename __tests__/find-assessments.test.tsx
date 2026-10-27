// MB-04: search and filter assessments on Home. Renders the real routes with
// the gateway mocked. Dates are relative to today, so the tests don't age.
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library'
import { assessment, mockGateway, pointAtTestGateway, routes, signedIn } from '../test/gateway'

pointAtTestGateway()

// Today's local calendar day plus `days`, as YYYY-MM-DD (as the gateway sends dates).
function day(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

// Five assessments covering each date rule; references name what they test.
const LIST = [
  assessment('RPT-OVERDUE', 'draft', { client: 'Northgate Logistics', reportDueDate: day(-2), siteVisitDate: day(-20) }),
  assessment('RPT-DUE-SOON', 'capturing', { client: 'Harbour Malls', reportDueDate: day(2), siteVisitDate: day(-5) }),
  assessment('RPT-VISIT-SOON', 'not_started', {
    client: 'Fennick Foods',
    site: { id: 's3', code: 'S-3', name: 'Leeds Cold Store', address: null },
    reportDueDate: day(30),
    siteVisitDate: day(3),
  }),
  assessment('RPT-FINALISED', 'finalised', { client: 'NUS', reportDueDate: day(-10), siteVisitDate: day(-40) }),
  assessment('RPT-LATER', 'under_review', { client: 'NUS', reportDueDate: day(20), siteVisitDate: day(-30) }),
]

async function openHome() {
  mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: LIST },
  })
  await renderRouter(routes)
  await screen.findByText('RPT-OVERDUE')
}

const listed = () =>
  screen.queryAllByText(/^RPT-/).map((t) => t.props.children as string)

const search = (text: string) =>
  fireEvent.changeText(screen.getByLabelText('Search site, client or report ID'), text)

it('searches by site, client or report ID, in any case (AC1)', async () => {
  await openHome()

  await search('leeds')
  expect(listed()).toEqual(['RPT-VISIT-SOON'])
  await search('NORTHGATE')
  expect(listed()).toEqual(['RPT-OVERDUE'])
  await search('rpt-later')
  expect(listed()).toEqual(['RPT-LATER'])
})

it('clears the search (AC2)', async () => {
  await openHome()
  await search('leeds')
  await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }))

  expect(screen.getByLabelText('Search site, client or report ID').props.value).toBe('')
  expect(listed()).toHaveLength(5)
})

it('filters by status (AC3)', async () => {
  await openHome()
  await fireEvent.press(screen.getByRole('button', { name: 'Capturing' }))

  expect(listed()).toEqual(['RPT-DUE-SOON'])
  await fireEvent.press(screen.getByRole('button', { name: 'All statuses' }))
  expect(listed()).toHaveLength(5)
})

it('counts in-progress assessments for each date chip, ignoring other filters (AC4)', async () => {
  await openHome()
  await search('nothing matches this')
  const chip = (name: string) => within(screen.getByRole('button', { name: new RegExp(`^${name}`) }))

  // The finalised one is past due but not counted.
  expect(chip('Overdue').getByText('1')).toBeTruthy()
  expect(chip('Due soon').getByText('1')).toBeTruthy()
  expect(chip('Site visits').getByText('1')).toBeTruthy()
})

it('filters by a date chip, and clears it when tapped again (AC5)', async () => {
  await openHome()
  const overdue = () => screen.getByRole('button', { name: /^Overdue/ })

  await fireEvent.press(overdue())
  expect(listed()).toEqual(['RPT-OVERDUE'])
  await fireEvent.press(overdue())
  expect(listed()).toHaveLength(5)
})

it('combines filters and says how many match (AC6)', async () => {
  await openHome()
  await search('nus')
  await fireEvent.press(screen.getByRole('button', { name: 'Under review' }))

  expect(listed()).toEqual(['RPT-LATER'])
  expect(screen.getByText('1 of 5 assessments')).toBeTruthy()
})

it('says when nothing matches, and Clear filters resets them all (AC7)', async () => {
  await openHome()
  await search('nus')
  await fireEvent.press(screen.getByRole('button', { name: /^Site visits/ }))

  expect(screen.getByText('No assessments match those filters.')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }))
  expect(listed()).toHaveLength(5)
})

it('shows each card’s report due note (AC8)', async () => {
  await openHome()
  const card = (ref: string) => within(screen.getByRole('button', { name: new RegExp(ref) }))

  expect(card('RPT-OVERDUE').getByText('Overdue')).toBeTruthy()
  expect(card('RPT-DUE-SOON').getByText('Due in 2 days')).toBeTruthy()
  expect(card('RPT-FINALISED').queryByText(/Due|Overdue/)).toBeNull()
})

it('words the countdown for today, one day and later, amber within 3 days (AC8)', async () => {
  mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': {
      status: 200,
      body: [
        assessment('RPT-TODAY', 'draft', { reportDueDate: day(0) }),
        assessment('RPT-TOMORROW', 'draft', { reportDueDate: day(1) }),
        assessment('RPT-IN-THREE', 'draft', { reportDueDate: day(3) }),
        assessment('RPT-IN-FOUR', 'draft', { reportDueDate: day(4) }),
      ],
    },
  })
  await renderRouter(routes)
  const note = async (ref: string, text: string) =>
    within(await screen.findByRole('button', { name: new RegExp(ref) })).getByText(text)

  expect(await note('RPT-TODAY', 'Due today')).toBeTruthy()
  expect(await note('RPT-TOMORROW', 'Due in 1 day')).toBeTruthy()
  expect((await note('RPT-IN-THREE', 'Due in 3 days')).props.className).toContain('text-warning-foreground')
  expect((await note('RPT-IN-FOUR', 'Due in 4 days')).props.className).toContain('text-muted-foreground')
})

it('keeps the filters on screen when a refresh fails', async () => {
  let calls = 0
  mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': () =>
      calls++ ? new TypeError('Network request failed') : { status: 200, body: LIST },
  })
  await renderRouter(routes)
  await screen.findByText('RPT-OVERDUE')
  await search('leeds')
  await act(async () => {
    await screen.getByTestId('assessment-list').props.refreshControl.props.onRefresh()
  })

  expect(await screen.findByText("Can't reach the server. Check your connection, then try again.")).toBeTruthy()
  expect(screen.getByLabelText('Search site, client or report ID').props.value).toBe('leeds')
})
