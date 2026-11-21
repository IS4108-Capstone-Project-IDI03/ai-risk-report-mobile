// MB-21 (web CP-01, CP-23): start a new assessment from Home. Real routes, gateway mocked: the client
// list, a client's sites and the one POST that creates it. A test must never reach a real server.
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

pointAtTestGateway()

const NEW_REF = 'RPT-2026-0099'
const CLIENTS = [
  { id: 'c1', name: 'Fennick Foods', division: null, sites: 2, rename: { allowed: true }, remove: { allowed: true } },
  { id: 'c2', name: 'Harbour Malls', division: 'Retail', sites: 1, rename: { allowed: true }, remove: { allowed: true } },
]
const LEEDS = { id: 's1', code: 'S-1', name: 'Leeds Cold Store', address: '1 Dock Road', jurisdiction: 'SG', facilityType: 'Cold store', latest: { reference: 'RPT-OLD', siteVisitDate: '2026-10-24', locations: 3, buildings: 1 } }
const EMPTY = { id: 's2', code: 'S-2', name: 'Pier Depot', address: null, jurisdiction: 'SG', facilityType: 'Port terminal', latest: null }

let online = true
let created: Reply
let posted: { url: string; body: any }[] = []

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(NEW_REF, 'not_started', { client: 'Fennick Foods', site: { id: 's1', code: 'S-1', name: 'Leeds Cold Store', address: null } })] },
    'GET /api/clients': () => (online ? { status: 200, body: CLIENTS } : new TypeError('Network request failed')),
    'GET /api/clients/c1/sites': { status: 200, body: [LEEDS, EMPTY] },
    'GET /api/clients/c2/sites': { status: 200, body: [] },
    'POST /api/assessments': (init) => {
      posted.push({ url: '/api/assessments', body: JSON.parse(String(init?.body)) })
      return created
    },
    [`GET /api/assessments/${NEW_REF}/locations`]: { status: 200, body: [location('l1', 'Dock', null, null)] },
    [`GET /api/assessments/${NEW_REF}/observations`]: { status: 200, body: [] },
    [`GET /api/assessments/${NEW_REF}/checklist`]: { status: 200, body: { scope: { facilityType: 'cold store', jurisdiction: 'SG' }, standards: [], checklist: null } },
    ...overrides,
  })
}

// Home, then the header's New button, then the form.
async function openForm() {
  await renderRouter(routes)
  await screen.findByTestId('assessment-list')
  await fireEvent.press(await screen.findByRole('button', { name: 'New assessment' }))
  return within(await screen.findByTestId('new-assessment'))
}
const form = () => within(screen.getByTestId('new-assessment'))
async function chooseClient(name: string) {
  // Before a client is chosen the field says Choose a client; after, it names the client and Change.
  await fireEvent.press(await form().findByRole('button', { name: /^(Choose a client|Client, .*Change)$/ }))
  const picker = within(await screen.findByTestId('client-picker'))
  await fireEvent.press(await picker.findByRole('button', { name: new RegExp(name) }))
}
async function chooseSite(name: RegExp | string) {
  await fireEvent.press(await form().findByRole('button', { name: typeof name === 'string' ? new RegExp(name) : name }))
}
const create = () => form().getByRole('button', { name: 'Create assessment' })
// Picks a day in the native picker of a date field.
async function pick(field: string, day: Date) {
  await fireEvent.press(form().getByRole('button', { name: field }))
  await fireEvent(await screen.findByTestId('date-picker'), 'valueChange', {}, day)
}

beforeEach(() => {
  jest.restoreAllMocks()
  online = true
  posted = []
  created = { status: 201, body: { clientId: 'c1', assessments: [assessment(NEW_REF, 'not_started', { client: 'Fennick Foods' })] } }
})

describe('start it (A)', () => {
  it('opens from the Home header, with clients to choose and nothing else yet (AC1)', async () => {
    gateway()
    const f = await openForm()

    expect(f.getByText('Client')).toBeTruthy()
    expect(await f.findByRole('button', { name: 'Choose a client' })).toBeTruthy()
    expect(f.queryByText('Site')).toBeNull()
    expect(create().props.accessibilityState.disabled).toBe(true)
  })

  it('marks every required field with a star, as the web does, and leaves the dates unmarked (AC7)', async () => {
    gateway()
    const f = await openForm()
    expect(f.getByText('Fields marked * are required.')).toBeTruthy()
    expect(f.getByLabelText('Client, required')).toBeTruthy()

    await chooseClient('Fennick Foods')
    await fireEvent.press(await form().findByRole('button', { name: 'Add a new site' }))
    for (const label of ['Site, required', 'Visit type, required', 'Site name, required', 'Address, required', 'Jurisdiction (two letters, for example SG), required', 'Facility type, required'])
      expect(form().getByLabelText(label)).toBeTruthy()
    // Optional: the dates carry no star.
    expect(form().queryByLabelText(/Survey start, required|Survey end, required|Report due, required|Dates, required/)).toBeNull()
  })

  it('lists clients with their division and site count, and searches them by name (AC2)', async () => {
    gateway()
    await openForm()
    await fireEvent.press(await form().findByRole('button', { name: 'Choose a client' }))
    const picker = within(await screen.findByTestId('client-picker'))

    expect(await picker.findByRole('button', { name: 'Fennick Foods, 2 sites' })).toBeTruthy()
    expect(picker.getByRole('button', { name: 'Harbour Malls, Retail, 1 site' })).toBeTruthy()
    await fireEvent.changeText(picker.getByLabelText('Search clients'), 'harb')
    expect(picker.queryByText('Fennick Foods')).toBeNull()
    expect(picker.getByText('Harbour Malls')).toBeTruthy()
    await fireEvent.changeText(picker.getByLabelText('Search clients'), 'zzz')
    expect(picker.getByText('No client matches. Check the spelling.')).toBeTruthy()
  })

  it("lists the chosen client's sites with Add a new site, and changing client clears the choice (AC3)", async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')

    expect(await form().findByRole('button', { name: /Leeds Cold Store, 1 Dock Road/ })).toBeTruthy()
    expect(form().getByText('Last visit 24 Oct 2026')).toBeTruthy()
    expect(form().getByText('No visit yet')).toBeTruthy()
    expect(form().getByRole('button', { name: 'Add a new site' })).toBeTruthy()

    await chooseSite('Leeds Cold Store')
    expect(form().getByText('Visit type')).toBeTruthy()
    await chooseClient('Harbour Malls')
    // The other client has its own sites, so the visit type and dates go with the old choice.
    await waitFor(() => expect(form().queryByText('Visit type')).toBeNull())
  })

  it('asks a new site for its four details, and only a First survey can start it (AC4, AC5, AC7)', async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')
    await fireEvent.press(await form().findByRole('button', { name: 'Add a new site' }))

    // First survey is chosen for them, the other two are greyed, with the reason.
    expect(form().getByRole('button', { name: 'First survey' }).props.accessibilityState.selected).toBe(true)
    expect(form().getByRole('button', { name: 'Resurvey' }).props.accessibilityState.disabled).toBe(true)
    expect(form().getByText('A site with no earlier assessment starts with a First survey.')).toBeTruthy()
    // Greyed until the four details are in.
    expect(create().props.accessibilityState.disabled).toBe(true)
    await fireEvent.changeText(form().getByLabelText('Site name'), 'Tuas Depot')
    await fireEvent.changeText(form().getByLabelText('Address'), '9 Tuas Road')
    expect(form().getByLabelText('Jurisdiction').props.value).toBe('SG')
    expect(create().props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(form().getByRole('button', { name: 'Cold store' }))
    expect(create().props.accessibilityState.disabled).toBe(false)
  })

  it('lets a site with a visit take all three types, and a site with none only the first (AC5)', async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')

    await chooseSite('Leeds Cold Store')
    expect(form().getByRole('button', { name: 'Resurvey' }).props.accessibilityState.disabled).toBe(false)
    expect(form().queryByText('A site with no earlier assessment starts with a First survey.')).toBeNull()
    await chooseSite('Pier Depot')
    expect(form().getByRole('button', { name: 'Follow-up' }).props.accessibilityState.disabled).toBe(true)
  })

  it('sends a listed site with its locations copied, the type as stored, and opens the new workspace (AC6, AC8)', async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')
    await chooseSite('Leeds Cold Store')
    expect(create().props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(form().getByRole('button', { name: 'Follow-up' }))
    await pick('Survey start', new Date(2026, 10, 23, 12))
    await pick('Report due', new Date(2026, 10, 30, 12))
    expect(create().props.accessibilityState.disabled).toBe(false)

    await fireEvent.press(create())

    // The workspace of the reference the gateway allocated.
    expect(await screen.findByTestId('workspace')).toBeTruthy()
    expect(screen).toHavePathname(`/assessment/${NEW_REF}`)
    expect(posted).toHaveLength(1)
    // No survey end was picked, so none is sent; Follow-up goes as the gateway stores it.
    expect(posted[0].body).toEqual({
      client: { id: 'c1' },
      sites: [{ ref: 'site-1', id: 's1', copyLocations: true, assessments: [{ ref: 'assessment-1', visitType: 'Follow-up visit', siteVisitDate: '2026-11-23', reportDueDate: '2026-11-30' }] }],
    })
  })

  it('sends a new site with its details, and no dates when none were picked (AC4, AC8)', async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')
    await fireEvent.press(await form().findByRole('button', { name: 'Add a new site' }))
    await fireEvent.changeText(form().getByLabelText('Site name'), '  Tuas Depot ')
    await fireEvent.changeText(form().getByLabelText('Address'), '9 Tuas Road')
    await fireEvent.changeText(form().getByLabelText('Jurisdiction'), 'my')
    await fireEvent.press(form().getByRole('button', { name: 'Distribution warehouse' }))

    await fireEvent.press(create())

    await screen.findByTestId('workspace')
    expect(posted[0].body.sites[0]).toEqual({
      ref: 'site-1',
      name: 'Tuas Depot',
      address: '9 Tuas Road',
      jurisdiction: 'MY',
      facilityType: 'Distribution warehouse',
      assessments: [{ ref: 'assessment-1', visitType: 'First survey' }],
    })
  })
})

describe('said clearly when wrong (B)', () => {
  async function ready() {
    await openForm()
    await chooseClient('Fennick Foods')
    await chooseSite('Leeds Cold Store')
    await fireEvent.press(form().getByRole('button', { name: 'Resurvey' }))
  }

  it('names an end or a due date before the start, and sends nothing (AC9)', async () => {
    gateway()
    await ready()
    await pick('Survey start', new Date(2026, 10, 23, 12))
    await pick('Survey end', new Date(2026, 10, 23, 12))
    await pick('Report due', new Date(2026, 10, 24, 12))
    // Moving the start past both makes both wrong.
    await pick('Survey start', new Date(2026, 10, 27, 12))
    await fireEvent.press(create())

    expect(await form().findAllByText('Pick a day on or after 27 Nov 2026, the survey start.')).toHaveLength(2)
    expect(posted).toHaveLength(0)
  })

  it("shows the gateway's problems beside their fields and keeps the form filled in (AC10)", async () => {
    created = { status: 400, body: { error: 'The assessment details are invalid.', fields: { 'sites.0.assessments.0.reportDueDate': 'Report due date must be on or after the visit.', 'sites.0.assessments.0.visitType': 'Choose a visit type.' } } }
    gateway()
    await ready()
    await fireEvent.press(create())

    expect(await form().findByText('Report due date must be on or after the visit.')).toBeTruthy()
    expect(form().getByText('Choose a visit type.')).toBeTruthy()
    expect(form().getByText('Fix the fields marked below, then create again.')).toBeTruthy()
    // Still the same form: the site and type are as they were, and nothing opened.
    expect(form().getByRole('button', { name: 'Resurvey' }).props.accessibilityState.selected).toBe(true)
    expect(screen).toHavePathname('/new-assessment')
  })

  it('says a refusal with no field in the box, with its cause (AC10)', async () => {
    created = { status: 403, body: { error: 'You may not start assessments.' } }
    gateway()
    await ready()
    await fireEvent.press(create())

    expect(await form().findByText('You may not start assessments.')).toBeTruthy()
    expect(form().getByText('Assessment not created')).toBeTruthy()
  })
})

describe('honest about the signal (C)', () => {
  it('says to connect and greys Create when the clients cannot be reached (AC11)', async () => {
    online = false
    gateway()
    await openForm()

    expect(await form().findByText("Can't reach the server. Check your connection, then try again.")).toBeTruthy()
    expect(create().props.accessibilityState.disabled).toBe(true)
  })

  it('sends one request for two quick taps (AC12)', async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')
    await chooseSite('Leeds Cold Store')
    await fireEvent.press(form().getByRole('button', { name: 'Resurvey' }))

    const button = create()
    await fireEvent.press(button)
    await fireEvent.press(button)

    await screen.findByTestId('workspace')
    expect(posted).toHaveLength(1)
  })
})
