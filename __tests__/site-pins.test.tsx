// MB-02 AC19-AC24: the Site pins screen: the site and its blocks with their pins, Directions,
// and Pin here / Move here by the phone's GPS (no map in the app). The gateway is mocked; the
// GPS and the maps app are too.
import * as Location from 'expo-location'
import { Alert, Linking } from 'react-native'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const position = Location.getCurrentPositionAsync as jest.Mock
const permission = Location.requestForegroundPermissionsAsync as jest.Mock

// What the gateway holds for the site: its own pin, and Block A pinned earlier.
let site: { id: string; code: string; name: string; address: null; coordinates: object | null; pins: { name: string; lat: number; lng: number }[] }
const held = () => assessment(REF, 'capturing', { site })

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  const changes: unknown[] = []
  const fetchMock = mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': () => ({ status: 200, body: [held()] }),
    // Block B has locations but no pin yet; "block a" is Block A in another case.
    [`GET /api/assessments/${REF}/locations`]: {
      status: 200,
      body: [location('l1', 'Lobby', 'block a'), location('l2', 'Pump room', 'Block B'), location('l3', 'Gate')],
    },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    'PUT /api/sites/s1/map': (init) => {
      const change = JSON.parse(String(init?.body))
      changes.push(change)
      if ('coordinates' in change) site = { ...site, coordinates: change.coordinates }
      else {
        const rest = site.pins.filter((p) => p.name !== change.block)
        site = { ...site, pins: change.point ? [...rest, { name: change.block, ...change.point }] : rest }
      }
      return { status: 204, body: null }
    },
    ...overrides,
  })
  return { fetchMock, changes }
}

async function openSitePins() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await screen.findByRole('button', { name: 'Site pins' }))
  return within(await screen.findByTestId('site-pins'))
}

// Opens a row's edit panel and takes the phone's position for it.
async function usePosition(pins: ReturnType<typeof within>, name: string, verb: 'Set' | 'Edit') {
  await fireEvent.press(pins.getByRole('button', { name: `${verb} ${name} pin` }))
  await fireEvent.press(pins.getByRole('button', { name: 'Use my position' }))
  // The position only fills the field; Set saves it.
  await waitFor(() => expect(pins.getByLabelText('Coordinates').props.value).not.toBe(''))
  await fireEvent.press(pins.getByRole('button', { name: 'Set typed coordinates' }))
}

const row = (view: ReturnType<typeof within>, name: string) => within(view.getByTestId(`pin-row-${name}`))

beforeEach(() => {
  jest.restoreAllMocks()
  permission.mockClear()
  position.mockClear()
  permission.mockResolvedValue({ granted: true, canAskAgain: true })
  position.mockResolvedValue({ coords: { latitude: 1.3001, longitude: 103.8601, accuracy: 6 } })
  site = {
    id: 's1',
    code: 'S-002',
    name: 'Tilbury Distribution Centre',
    address: null,
    coordinates: { lat: 1.2966, lng: 103.852 },
    pins: [{ name: 'Block A', lat: 1.297, lng: 103.8525 }],
  }
})

describe('Site pins', () => {
  it('lists the site and each block, pinned or not, once each (AC19, AC20)', async () => {
    gateway()
    const pins = await openSitePins()

    expect(row(pins, 'Site').getByText('1.2966, 103.852')).toBeTruthy()
    expect(row(pins, 'Block A').getByText('1.297, 103.8525')).toBeTruthy()
    expect(row(pins, 'Block B').getByText('Not pinned')).toBeTruthy()
    // "block a" (a location's building) is Block A: no second row. "Gate" has no building, so it is a
    // place elsewhere on site with a row of its own (AC40).
    expect(row(pins, 'Gate').getByText('Not pinned')).toBeTruthy()
    expect(pins.getAllByTestId(/^pin-row-/)).toHaveLength(4)
  })

  it('opens directions to a pin in the maps app (AC21)', async () => {
    gateway()
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue()
    const pins = await openSitePins()

    await fireEvent.press(row(pins, 'Block A').getByRole('button', { name: 'Directions to Block A' }))

    expect(open).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=1.297,103.8525')
    // Nothing to go to for a block with no pin.
    expect(row(pins, 'Block B').queryByRole('button', { name: /Directions/ })).toBeNull()
  })

  it('pins a block here with the phone’s position, then shows it (AC22)', async () => {
    const g = gateway()
    const pins = await openSitePins()

    await usePosition(pins, 'Block B', 'Set')

    await waitFor(() => expect(g.changes).toEqual([{ block: 'Block B', point: { lat: 1.3001, lng: 103.8601 } }]))
    expect(await row(pins, 'Block B').findByText('1.3001, 103.8601')).toBeTruthy()
  })

  it('moves a pin, and moves the site’s own pin with `coordinates` (AC22)', async () => {
    const g = gateway()
    const pins = await openSitePins()

    await usePosition(pins, 'Block A', 'Edit')
    await waitFor(() => expect(row(pins, 'Block A').getByText('1.3001, 103.8601')).toBeTruthy())
    await usePosition(pins, 'Site', 'Edit')

    await waitFor(() => expect(g.changes).toHaveLength(2))
    expect(g.changes[0]).toEqual({ block: 'Block A', point: { lat: 1.3001, lng: 103.8601 } })
    expect(g.changes[1]).toEqual({ coordinates: { lat: 1.3001, lng: 103.8601 } })
  })

  it('removes a pin only after I confirm (AC23)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const g = gateway()
    const pins = await openSitePins()

    await fireEvent.press(pins.getByRole('button', { name: 'Edit Block A pin' }))
    await fireEvent.press(pins.getByRole('button', { name: 'Remove pin' }))
    expect(g.changes).toHaveLength(0)
    await act(async () => {
      ;(alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Remove')!.onPress!()
    })

    await waitFor(() => expect(g.changes).toEqual([{ block: 'Block A', point: null }]))
    // Its locations' building is spelt "block a", so with no pin that is the row's name.
    expect(await within(await pins.findByTestId('pin-row-block a')).findByText('Not pinned')).toBeTruthy()
  })

  it('says location is off and changes nothing when permission is refused (AC22)', async () => {
    permission.mockResolvedValue({ granted: false, canAskAgain: false })
    const g = gateway()
    const pins = await openSitePins()

    await fireEvent.press(pins.getByRole('button', { name: 'Set Block B pin' }))
    await fireEvent.press(pins.getByRole('button', { name: 'Use my position' }))

    expect(await pins.findByText(/Location access is off/)).toBeTruthy()
    expect(pins.getByLabelText('Coordinates').props.value).toBe('')
    expect(g.changes).toHaveLength(0)
  })

  it("says why when the gateway refuses, and the row stays as it was (AC24)", async () => {
    gateway({ 'PUT /api/sites/s1/map': { status: 403, body: { error: 'Only the assigned engineer can change this site.' } } })
    const pins = await openSitePins()

    await usePosition(pins, 'Block B', 'Set')

    expect(await pins.findByText('Only the assigned engineer can change this site.')).toBeTruthy()
    expect(row(pins, 'Block B').getByText('Not pinned')).toBeTruthy()
  })

  it('says so with no signal (AC24)', async () => {
    gateway({ 'PUT /api/sites/s1/map': new TypeError('Network request failed') })
    const pins = await openSitePins()

    await usePosition(pins, 'Block B', 'Set')

    expect(await pins.findByText(/Can't reach the server/)).toBeTruthy()
  })
})

describe('the map', () => {
  it('has a marker for each pinned row, labelled as the rows are, and none for an unpinned one (AC25)', async () => {
    gateway()
    const pins = await openSitePins()

    expect(pins.getByTestId('map-pin-site')).toBeTruthy()
    expect(within(pins.getByTestId('map-pin-site')).getByText('S')).toBeTruthy()
    expect(within(pins.getByTestId('map-pin-block:Block A')).getByText('1')).toBeTruthy()
    // Block B is not pinned.
    expect(pins.queryByTestId('map-pin-block:Block B')).toBeNull()
  })

  it('highlights a row when its marker is tapped, and when its name is (AC26)', async () => {
    gateway()
    const pins = await openSitePins()
    const selected = (name: string) => pins.getByTestId(`pin-row-${name}`).props.accessibilityState?.selected

    await fireEvent.press(pins.getByTestId('map-pin-block:Block A'))
    expect(selected('Block A')).toBe(true)
    expect(selected('Site')).toBe(false)

    await fireEvent.press(pins.getByRole('button', { name: 'Show Site on the map' }))
    expect(selected('Site')).toBe(true)
    expect(selected('Block A')).toBe(false)
  })

  it('saves where a marker is dropped, as one change (AC27)', async () => {
    const g = gateway()
    const pins = await openSitePins()

    await fireEvent(pins.getByTestId('map-pin-block:Block A'), 'dragEnd', {
      nativeEvent: { coordinate: { latitude: 1.3100004, longitude: 103.8700004 } },
    })

    await waitFor(() => expect(g.changes).toEqual([{ block: 'Block A', point: { lat: 1.31, lng: 103.87 } }]))
    expect(await within(pins.getByTestId('pin-row-Block A')).findByText('1.31, 103.87')).toBeTruthy()
  })

  it('folds the map away and brings it back (AC30)', async () => {
    gateway()
    const pins = await openSitePins()

    await fireEvent.press(pins.getByRole('button', { name: 'Hide map' }))
    expect(pins.queryByTestId('site-map')).toBeNull()
    expect(pins.getByTestId('pin-row-Site')).toBeTruthy()

    await fireEvent.press(pins.getByRole('button', { name: 'Show map' }))
    expect(pins.getByTestId('site-map')).toBeTruthy()
  })

  it('shows the map even when nothing is pinned, so a spot can be chosen (AC25)', async () => {
    site = { ...site, coordinates: null, pins: [] }
    gateway()
    const pins = await openSitePins()

    expect(pins.getByTestId('site-map')).toBeTruthy()
    expect(pins.queryByTestId('map-pin-site')).toBeNull()
  })

  it('fills the coordinates where I tap the map, shows a draft marker, and saves only on Set (AC31)', async () => {
    const g = gateway()
    const pins = await openSitePins()
    const tap = { nativeEvent: { coordinate: { latitude: 1.3200001, longitude: 103.8800001 } } }

    // No panel open: nothing happens.
    await fireEvent(pins.getByTestId('site-map'), 'press', tap)
    expect(pins.queryByTestId('map-pin-draft')).toBeNull()

    await fireEvent.press(pins.getByRole('button', { name: 'Set Block B pin' }))
    await fireEvent(pins.getByTestId('site-map'), 'press', tap)

    expect(pins.getByLabelText('Coordinates').props.value).toBe('1.32, 103.88')
    expect(pins.getByTestId('map-pin-draft')).toBeTruthy()
    expect(g.changes).toHaveLength(0)

    await fireEvent.press(pins.getByRole('button', { name: 'Set typed coordinates' }))
    await waitFor(() => expect(g.changes).toEqual([{ block: 'Block B', point: { lat: 1.32, lng: 103.88 } }]))
    expect(pins.queryByTestId('edit-pin')).toBeNull()
  })

  it('sets typed coordinates, and refuses ones that are not (AC22, AC32)', async () => {
    const g = gateway()
    const pins = await openSitePins()
    await fireEvent.press(pins.getByRole('button', { name: 'Set Block B pin' }))

    await fireEvent.changeText(pins.getByLabelText('Coordinates'), 'about here')
    await fireEvent.press(pins.getByRole('button', { name: 'Set typed coordinates' }))
    expect(pins.getByText('Type latitude and longitude, like 1.2966, 103.8520.')).toBeTruthy()
    await fireEvent.changeText(pins.getByLabelText('Coordinates'), '95, 103.8')
    await fireEvent.press(pins.getByRole('button', { name: 'Set typed coordinates' }))
    expect(g.changes).toHaveLength(0)

    await fireEvent.changeText(pins.getByLabelText('Coordinates'), '1.3, 103.85')
    await fireEvent.press(pins.getByRole('button', { name: 'Set typed coordinates' }))
    await waitFor(() => expect(g.changes).toEqual([{ block: 'Block B', point: { lat: 1.3, lng: 103.85 } }]))
  })

  it('closes the edit panel with Cancel (AC22)', async () => {
    gateway()
    const pins = await openSitePins()
    await fireEvent.press(pins.getByRole('button', { name: 'Edit Block A pin' }))

    await fireEvent.press(pins.getByRole('button', { name: 'Cancel editing' }))

    expect(pins.queryByRole('button', { name: 'Use my position' })).toBeNull()
  })
})

// MB-02 AC40-AC42 (added 20 Nov): places elsewhere on site are on the Site pins screen and its map.
describe('places elsewhere on site', () => {
  // The gateway's locations, kept so a PATCH can change one's pin as the real one does.
  function withPlaces(list: object[]) {
    const patches: { id: string; body: { name: string; coordinates: { lat: number; lng: number } | null } }[] = []
    let current = list as { id: string; name: string; coordinates?: object }[]
    const patch = (id: string) => (init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      patches.push({ id, body })
      current = current.map((l) => (l.id === id ? { ...l, ...(body.coordinates ? { coordinates: body.coordinates } : { coordinates: undefined }) } : l))
      return { status: 200, body: current.find((l) => l.id === id) }
    }
    const g = gateway({
      [`GET /api/assessments/${REF}/locations`]: () => ({ status: 200, body: current }),
      [`PATCH /api/assessments/${REF}/locations/p1`]: patch('p1'),
      [`PATCH /api/assessments/${REF}/locations/p2`]: patch('p2'),
    })
    return { ...g, patches }
  }
  const PLACES = [
    location('l1', 'Lobby', 'Block A', 'Level 1'),
    location('l2', 'Lobby', 'Block A', 'Level 2'),
    { ...location('p1', 'Carpark A'), coordinates: { lat: 1.3, lng: 103.86 } },
    location('p2', 'Loading yard'),
  ]

  it('adds a row for each place elsewhere on site, and none for other levels of a building (AC40)', async () => {
    withPlaces(PLACES)
    const pins = await openSitePins()

    expect(row(pins, 'Carpark A').getByText('1.3, 103.86')).toBeTruthy()
    expect(row(pins, 'Carpark A').getByText('Elsewhere on site')).toBeTruthy()
    expect(row(pins, 'Loading yard').getByText('Not pinned')).toBeTruthy()
    // The site, Block A (both of its levels share it), and the two places: four rows, not five.
    expect(pins.getAllByTestId(/^pin-row-/)).toHaveLength(4)
  })

  it('draws a marker for a pinned place, and none for an unpinned one (AC40)', async () => {
    withPlaces(PLACES)
    const pins = await openSitePins()

    expect(pins.getByTestId('map-pin-place:p1')).toBeTruthy()
    // Numbered after the blocks: Block A is 1, Carpark A is 2.
    expect(within(pins.getByTestId('map-pin-place:p1')).getByText('2')).toBeTruthy()
    expect(pins.queryByTestId('map-pin-place:p2')).toBeNull()
  })

  it('pins a place on the location itself, then shows it (AC41)', async () => {
    const g = withPlaces(PLACES)
    const pins = await openSitePins()

    await fireEvent.press(pins.getByRole('button', { name: 'Set Loading yard pin' }))
    await fireEvent.changeText(pins.getByLabelText('Coordinates'), '1.31, 103.87')
    await fireEvent.press(pins.getByRole('button', { name: 'Set typed coordinates' }))

    await waitFor(() => expect(row(pins, 'Loading yard').getByText('1.31, 103.87')).toBeTruthy())
    expect(g.patches).toEqual([{ id: 'p2', body: { name: 'Loading yard', coordinates: { lat: 1.31, lng: 103.87 } } }])
    // Not the site's map route: a place is not a block.
    expect(g.changes).toEqual([])
  })

  it('removes a place pin by clearing the location\'s coordinates (AC42)', async () => {
    const g = withPlaces(PLACES)
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => void buttons?.find((b) => b.text === 'Remove')?.onPress?.())
    const pins = await openSitePins()

    await fireEvent.press(pins.getByRole('button', { name: 'Edit Carpark A pin' }))
    await fireEvent.press(pins.getByRole('button', { name: 'Remove pin' }))

    await waitFor(() => expect(row(pins, 'Carpark A').getByText('Not pinned')).toBeTruthy())
    expect(g.patches).toEqual([{ id: 'p1', body: { name: 'Carpark A', coordinates: null } }])
  })
})
