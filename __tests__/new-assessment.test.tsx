// MB-21 (web CP-01, CP-23): start a new assessment from Home. Real routes, gateway mocked: the client
// list, a client's sites and the one POST that creates it. A test must never reach a real server.
import * as Location from 'expo-location'
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { addDays, formatDay, todayIso } from '../src/features/calendar/calendar'
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

// Home, then its round New assessment button, then the form.
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
  it('opens from the round button on Home, with clients to choose and nothing else yet (AC1)', async () => {
    gateway()
    const f = await openForm()
    expect(f.getByText('Client')).toBeTruthy()
    expect(await f.findByRole('button', { name: 'Choose a client' })).toBeTruthy()
    expect(f.queryByText('Site')).toBeNull()
    expect(create().props.accessibilityState.disabled).toBe(true)
  })

  it('puts New assessment on Home as a round plus with no word, and no New in the header (AC1)', async () => {
    gateway()
    await renderRouter(routes)
    await screen.findByTestId('assessment-list')

    expect(await screen.findByRole('button', { name: 'New assessment' })).toBeTruthy()
    expect(screen.queryByText('New')).toBeNull()
  })

  it('marks every required field with a star, as the web does, and leaves the dates unmarked (AC7)', async () => {
    gateway()
    const f = await openForm()
    expect(f.getByText('Fields marked * are required.')).toBeTruthy()
    expect(f.getByLabelText('Client, required')).toBeTruthy()

    await chooseClient('Fennick Foods')
    await fireEvent.press(await form().findByRole('button', { name: 'Add a new site' }))
    for (const label of ['Site, required', 'Visit type, required', 'Site name, required', 'Address, required', 'Jurisdiction, required', 'Facility type, required', 'Survey start, required'])
      expect(form().getByLabelText(label)).toBeTruthy()
    // Optional: the survey end and the report due carry no star.
    expect(form().queryByLabelText(/Survey end, required|Report due, required|Dates, required/)).toBeNull()
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

  // Added 24 Nov (Miya): Add a new site sat last in the list and was easy to miss, so it is the first row now.
  it('puts Add a new site first in the list, under a line saying to pick a site or add one (AC3)', async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')

    expect(await form().findByText('Pick one of its sites, or add a new one.')).toBeTruthy()
    const names = form().getAllByRole('button').map((b) => String(b.props.accessibilityLabel))
    const add = names.indexOf('Add a new site')
    expect(add).toBeGreaterThan(-1)
    expect(add).toBeLessThan(names.findIndex((n) => n.startsWith('Leeds Cold Store')))
    expect(add).toBeLessThan(names.findIndex((n) => n.startsWith('Pier Depot')))
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
    expect(form().getByRole('button', { name: 'Singapore' }).props.accessibilityState.selected).toBe(true)
    expect(create().props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(form().getByRole('button', { name: 'Cold store' }))
    expect(create().props.accessibilityState.disabled).toBe(false)
  })

  it('offers the same eight jurisdictions as the web, as chips, so no other code can be typed (AC4)', async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')
    await fireEvent.press(await form().findByRole('button', { name: 'Add a new site' }))

    for (const name of ['Singapore', 'Malaysia', 'Indonesia', 'Thailand', 'Philippines', 'Vietnam', 'Hong Kong', 'United Kingdom'])
      expect(form().getByRole('button', { name })).toBeTruthy()
    await fireEvent.press(form().getByRole('button', { name: 'Hong Kong' }))
    expect(form().getByRole('button', { name: 'Hong Kong' }).props.accessibilityState.selected).toBe(true)
    expect(form().getByRole('button', { name: 'Singapore' }).props.accessibilityState.selected).toBe(false)
  })

  // Added 24 Nov (Miya): the web's New Assessment form has an optional Coordinates field on each new site.
  async function openNewSite() {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')
    await fireEvent.press(await form().findByRole('button', { name: 'Add a new site' }))
    await fireEvent.changeText(form().getByLabelText('Site name'), 'Tuas Depot')
    await fireEvent.changeText(form().getByLabelText('Address'), '9 Tuas Road')
    await fireEvent.press(form().getByRole('button', { name: 'Distribution warehouse' }))
  }

  it('asks a new site for optional Coordinates, with no star, and sends them as numbers (AC13)', async () => {
    await openNewSite()
    expect(form().getByLabelText('Coordinates')).toBeTruthy()
    expect(form().queryByLabelText('Coordinates, required')).toBeNull()
    expect(form().getByText('Optional. For example 1.2966, 103.8520.')).toBeTruthy()
    // Not needed to create.
    expect(create().props.accessibilityState.disabled).toBe(false)

    await fireEvent.changeText(form().getByLabelText('Coordinates'), '1.2966, 103.8520')
    await fireEvent.press(create())
    await screen.findByTestId('workspace')
    expect(posted[0].body.sites[0].coordinates).toEqual({ lat: 1.2966, lng: 103.852 })
  })

  it('takes a space between the two numbers, and a negative one (AC13)', async () => {
    await openNewSite()
    await fireEvent.changeText(form().getByLabelText('Coordinates'), '  -1.5 103  ')
    await fireEvent.press(create())
    await screen.findByTestId('workspace')
    expect(posted[0].body.sites[0].coordinates).toEqual({ lat: -1.5, lng: 103 })
  })

  it('fills Coordinates from the phone GPS with Pin where I am (AC13)', async () => {
    await openNewSite()
    await fireEvent.press(form().getByRole('button', { name: 'Pin where I am' }))
    await waitFor(() => expect(form().getByLabelText('Coordinates').props.value).toBe('1.296612, 103.852034'))
    await fireEvent.press(create())
    await screen.findByTestId('workspace')
    expect(posted[0].body.sites[0].coordinates).toEqual({ lat: 1.296612, lng: 103.852034 })
  })

  // MB-26: a map under Coordinates places the new site's pin (web CP-26). Jest's map is a View: a tap is a
  // 'press' with a coordinate, a drag is the pin's 'dragEnd'.
  const tapMap = (latitude: number, longitude: number) =>
    fireEvent(form().getByTestId('site-map'), 'press', { nativeEvent: { coordinate: { latitude, longitude } } })

  it('shows a map and its hint on a new site, and none on a listed one (MB-26 AC1, AC7)', async () => {
    await openNewSite()
    expect(form().getByTestId('site-map')).toBeTruthy()
    expect(form().getByText('Tap the map to place the pin.')).toBeTruthy()
    expect(form().queryByTestId('map-pin-site')).toBeNull()

    await chooseSite(/Leeds Cold Store/)
    expect(form().queryByTestId('site-map')).toBeNull()
  })

  it('places the pin where the map is tapped and fills Coordinates (MB-26 AC3)', async () => {
    await openNewSite()
    await tapMap(1.29661234, 103.85203456)
    expect(within(form().getByTestId('map-pin-site')).getByText('S')).toBeTruthy()
    expect(form().getByLabelText('Coordinates').props.value).toBe('1.296612, 103.852035')

    // A second tap moves it: still one pin.
    await tapMap(1.3, 103.9)
    expect(form().getByLabelText('Coordinates').props.value).toBe('1.3, 103.9')
    expect(form().getAllByTestId('map-pin-site')).toHaveLength(1)
  })

  it('follows a dragged pin (MB-26 AC4)', async () => {
    await openNewSite()
    await tapMap(1.3, 103.8)
    await fireEvent(form().getByTestId('map-pin-site'), 'dragEnd', { nativeEvent: { coordinate: { latitude: 1.31, longitude: 103.81 } } })
    expect(form().getByLabelText('Coordinates').props.value).toBe('1.31, 103.81')
  })

  it('shows the pin for typed Coordinates and drops it when they are cleared or not a point (MB-26 AC5)', async () => {
    await openNewSite()
    await fireEvent.changeText(form().getByLabelText('Coordinates'), '1.2966, 103.8520')
    expect(form().getByTestId('map-pin-site')).toBeTruthy()
    await fireEvent.changeText(form().getByLabelText('Coordinates'), '1.2966, abc')
    expect(form().queryByTestId('map-pin-site')).toBeNull()
    await fireEvent.changeText(form().getByLabelText('Coordinates'), '1.2966, 103.8520')
    await fireEvent.changeText(form().getByLabelText('Coordinates'), '')
    expect(form().queryByTestId('map-pin-site')).toBeNull()
  })

  it('shows the pin where Pin where I am found the phone (MB-26 AC6)', async () => {
    await openNewSite()
    await fireEvent.press(form().getByRole('button', { name: 'Pin where I am' }))
    expect(await form().findByTestId('map-pin-site')).toBeTruthy()
  })

  it('sends the tapped point, and nothing when the map was not used (MB-26 AC8)', async () => {
    await openNewSite()
    await tapMap(1.3, 103.9)
    await fireEvent.press(create())
    await screen.findByTestId('workspace')
    expect(posted[0].body.sites[0].coordinates).toEqual({ lat: 1.3, lng: 103.9 })
  })

  it('says why when the GPS is off, and keeps the form as it was (AC13)', async () => {
    ;(Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false, canAskAgain: false })
    await openNewSite()
    await fireEvent.press(form().getByRole('button', { name: 'Pin where I am' }))
    expect(await form().findByText('Location access is off. Turn it on in Settings, or save without a pin.')).toBeTruthy()
    expect(form().getByLabelText('Coordinates').props.value).toBe('')
    expect(create().props.accessibilityState.disabled).toBe(false)
  })

  it('starts the survey today and the report due 14 days later, as the web does, and the survey start cannot be cleared (AC6)', async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')
    await chooseSite('Leeds Cold Store')

    const today = todayIso()
    const due = addDays(today, 14)
    expect(form().getByRole('button', { name: 'Survey start' }).props.accessibilityValue.text).toBe(formatDay(today))
    expect(form().getByRole('button', { name: 'Report due' }).props.accessibilityValue.text).toBe(formatDay(due))
    expect(form().getByRole('button', { name: 'Survey end' }).props.accessibilityValue.text).toBe('Not set')
    // End and due can be cleared; the start cannot, because the web requires it.
    expect(form().queryByRole('button', { name: 'Clear Survey start' })).toBeNull()
    expect(form().getByRole('button', { name: 'Clear Report due' })).toBeTruthy()
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

  it('sends a new site with its details and the default dates (AC4, AC6, AC8)', async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')
    await fireEvent.press(await form().findByRole('button', { name: 'Add a new site' }))
    await fireEvent.changeText(form().getByLabelText('Site name'), '  Tuas Depot ')
    await fireEvent.changeText(form().getByLabelText('Address'), '9 Tuas Road')
    await fireEvent.press(form().getByRole('button', { name: 'Malaysia' }))
    await fireEvent.press(form().getByRole('button', { name: 'Distribution warehouse' }))

    await fireEvent.press(create())

    await screen.findByTestId('workspace')
    expect(posted[0].body.sites[0]).toEqual({
      ref: 'site-1',
      name: 'Tuas Depot',
      address: '9 Tuas Road',
      jurisdiction: 'MY',
      facilityType: 'Distribution warehouse',
      // Nothing was picked, so the start is today and the due is 14 days on; no end.
      assessments: [{ ref: 'assessment-1', visitType: 'First survey', siteVisitDate: todayIso(), reportDueDate: addDays(todayIso(), 14) }],
    })
  })
})

// Added 24 Nov (Miya): a client can be added from the phone, as on the web (AC2a to AC2d).
describe('a new client (AC2a-AC2d)', () => {
  const picker = async () => within(await screen.findByTestId('client-picker'))
  async function openPicker() {
    gateway()
    await openForm()
    await fireEvent.press(await form().findByRole('button', { name: 'Choose a client' }))
    return picker()
  }
  async function addClient(search = '') {
    const p = await openPicker()
    if (search) await fireEvent.changeText(p.getByLabelText('Search clients'), search)
    await fireEvent.press(await p.findByRole('button', { name: 'Add a new client' }))
  }
  async function fillSite() {
    await fireEvent.changeText(form().getByLabelText('Site name'), 'Tuas Depot')
    await fireEvent.changeText(form().getByLabelText('Address'), '9 Tuas Road')
    await fireEvent.press(form().getByRole('button', { name: 'Distribution warehouse' }))
  }

  it('lists Add a new client first, even with no match for what was searched (AC2a)', async () => {
    const p = await openPicker()
    const names = p.getAllByRole('button').map((b) => b.props.accessibilityLabel as string)
    expect(names.indexOf('Add a new client')).toBeGreaterThan(-1)
    expect(names.indexOf('Add a new client')).toBeLessThan(names.findIndex((n) => /Fennick Foods/.test(n)))

    await fireEvent.changeText(p.getByLabelText('Search clients'), 'zzz')
    expect(p.getByText('No client matches. Check the spelling.')).toBeTruthy()
    expect(p.getByRole('button', { name: 'Add a new client' })).toBeTruthy()
  })

  it('asks for a name (starred) and a division, carries over what was searched, and goes straight to the new site (AC2a, AC2b)', async () => {
    await addClient('Harbourline')

    expect(form().getByRole('button', { name: 'Client, New client. Change' })).toBeTruthy()
    expect(form().getByLabelText('Client name').props.value).toBe('Harbourline')
    expect(form().getByLabelText('Client name, required')).toBeTruthy()
    expect(form().getByLabelText('Division')).toBeTruthy()
    expect(form().queryByLabelText('Division, required')).toBeNull()
    // No site list for a client with no sites: the new site's details, and First survey only.
    expect(form().queryByRole('button', { name: 'Add a new site' })).toBeNull()
    expect(form().getByLabelText('Site name')).toBeTruthy()
    expect(form().getByText('A site with no earlier assessment starts with a First survey.')).toBeTruthy()
  })

  it('greys Create until the name and the site details are in, then sends the client by name (AC2b, AC2d)', async () => {
    await addClient()
    expect(create().props.accessibilityState.disabled).toBe(true)
    await fillSite()
    // The site is ready but the client has no name yet.
    expect(create().props.accessibilityState.disabled).toBe(true)

    await fireEvent.changeText(form().getByLabelText('Client name'), '  Harbourline Properties ')
    await fireEvent.changeText(form().getByLabelText('Division'), ' Logistics ')
    expect(create().props.accessibilityState.disabled).toBe(false)
    await fireEvent.press(create())
    await screen.findByTestId('workspace')

    expect(posted[0].body.client).toEqual({ name: 'Harbourline Properties', division: 'Logistics' })
    expect(posted[0].body.sites[0].id).toBeUndefined()
    expect(posted[0].body.sites[0].assessments[0].visitType).toBe('First survey')
  })

  it('leaves the division out when it is empty (AC2d)', async () => {
    await addClient('Harbourline Properties')
    await fillSite()
    await fireEvent.press(create())
    await screen.findByTestId('workspace')

    expect(posted[0].body.client).toEqual({ name: 'Harbourline Properties' })
  })

  it('says when the name is a listed client, and Use switches to it and its sites (AC2c)', async () => {
    await addClient()
    await fillSite()
    await fireEvent.changeText(form().getByLabelText('Client name'), '  fennick   FOODS ')

    expect(form().getByText('Fennick Foods is already a client.')).toBeTruthy()
    expect(create().props.accessibilityState.disabled).toBe(true)

    await fireEvent.press(form().getByRole('button', { name: 'Use Fennick Foods' }))
    expect(form().getByRole('button', { name: 'Client, Fennick Foods. Change' })).toBeTruthy()
    expect(form().queryByLabelText('Client name')).toBeNull()
    // Its own sites are listed again.
    expect(await form().findByRole('button', { name: /Leeds Cold Store/ })).toBeTruthy()
  })

  it('goes back to a listed client with Change, dropping the new-client fields (AC2a)', async () => {
    await addClient('Harbourline')
    await chooseClient('Harbour Malls')

    expect(form().queryByLabelText('Client name')).toBeNull()
    expect(form().getByRole('button', { name: 'Client, Harbour Malls. Change' })).toBeTruthy()
  })

  it("shows the gateway's refusal beside Client name and keeps the form filled in (AC2d)", async () => {
    created = { status: 400, body: { error: 'The assessment details are invalid.', fields: { 'client.name': 'Client is required.' } } }
    await addClient('Harbourline Properties')
    await fillSite()
    await fireEvent.press(create())

    expect(await form().findByText('Client is required.')).toBeTruthy()
    expect(form().getByLabelText('Client name').props.value).toBe('Harbourline Properties')
    expect(form().getByLabelText('Site name').props.value).toBe('Tuas Depot')
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

  it('names Coordinates that are not a point, in the web\'s words, and sends nothing (AC13)', async () => {
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')
    await fireEvent.press(await form().findByRole('button', { name: 'Add a new site' }))
    await fireEvent.changeText(form().getByLabelText('Site name'), 'Tuas Depot')
    await fireEvent.changeText(form().getByLabelText('Address'), '9 Tuas Road')
    await fireEvent.press(form().getByRole('button', { name: 'Distribution warehouse' }))
    for (const text of ['Tuas', '1.2966', '91, 103.85', '1.29, 181']) {
      await fireEvent.changeText(form().getByLabelText('Coordinates'), text)
      await fireEvent.press(create())
      expect(await form().findByText('Enter coordinates such as 1.2966, 103.8520')).toBeTruthy()
    }
    expect(posted).toEqual([])
    // Clearing the field makes it optional again.
    await fireEvent.changeText(form().getByLabelText('Coordinates'), '')
    expect(form().queryByText('Enter coordinates such as 1.2966, 103.8520')).toBeNull()
  })

  it("shows the gateway's coordinates problem beside the field (AC13)", async () => {
    created = { status: 400, body: { error: 'The assessment details are invalid.', fields: { 'sites.0.coordinates': 'Coordinates are not valid.' } } }
    gateway()
    await openForm()
    await chooseClient('Fennick Foods')
    await fireEvent.press(await form().findByRole('button', { name: 'Add a new site' }))
    await fireEvent.changeText(form().getByLabelText('Site name'), 'Tuas Depot')
    await fireEvent.changeText(form().getByLabelText('Address'), '9 Tuas Road')
    await fireEvent.press(form().getByRole('button', { name: 'Distribution warehouse' }))
    await fireEvent.changeText(form().getByLabelText('Coordinates'), '1.2966, 103.8520')
    await fireEvent.press(create())
    expect(await form().findByText('Coordinates are not valid.')).toBeTruthy()
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
