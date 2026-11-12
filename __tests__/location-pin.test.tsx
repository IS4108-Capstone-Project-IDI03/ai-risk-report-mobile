// MB-02 AC13-AC18: Pin where I am, on the Add location form. The phone's GPS (expo-location)
// is mocked in test/setup.ts; the gateway is mocked as everywhere. No test reads a real
// position.
import * as FileSystem from 'expo-file-system'
import * as Location from 'expo-location'
import { Linking } from 'react-native'
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const files = (FileSystem as unknown as { __files: Map<string, string> }).__files
const permission = Location.requestForegroundPermissionsAsync as jest.Mock
const position = Location.getCurrentPositionAsync as jest.Mock

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  const sent: Record<string, unknown>[] = []
  const fetchMock = mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    [`POST /api/assessments/${REF}/locations`]: (init) => {
      sent.push(JSON.parse(String(init?.body)))
      return { status: 201, body: location('l9', 'Staircase', 'Block A', 'Level 2') }
    },
    ...overrides,
  })
  return { fetchMock, sent }
}

// Opens the Add location form for the one assessment.
async function openForm() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await within(screen.getByTestId('workspace-screen')).findByRole('button', { name: 'Choose location' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Add location' }))
  await fireEvent.changeText(screen.getByLabelText('Location'), 'Staircase')
}
const pin = async () => fireEvent.press(screen.getByRole('button', { name: 'Pin where I am' }))
const save = async () => fireEvent.press(screen.getByRole('button', { name: 'Save location' }))

beforeEach(() => {
  files.clear()
  jest.restoreAllMocks()
  permission.mockClear()
  position.mockClear()
  permission.mockResolvedValue({ granted: true, canAskAgain: true })
  position.mockResolvedValue({ coords: { latitude: 1.2966124, longitude: 103.8520338, accuracy: 8.4 } })
})

describe('Pin where I am', () => {
  it('shows nothing read until I tap, then the position and how close it is (AC13)', async () => {
    gateway()
    await openForm()
    expect(position).not.toHaveBeenCalled()

    await pin()

    expect(await screen.findByText('1.296612, 103.852034')).toBeTruthy()
    expect(screen.getByText('About 8 m')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear pin' })).toBeTruthy()
  })

  it('sends the coordinates, to six decimal places, when I save (AC14)', async () => {
    const g = gateway()
    await openForm()
    await pin()
    await screen.findByText('1.296612, 103.852034')

    await save()

    await waitFor(() => expect(g.sent).toHaveLength(1))
    expect(g.sent[0]).toEqual({ name: 'Staircase', coordinates: { lat: 1.296612, lng: 103.852034 } })
  })

  it('sends none after Clear, or when I never pinned (AC14)', async () => {
    const g = gateway()
    await openForm()
    await pin()
    await fireEvent.press(await screen.findByRole('button', { name: 'Clear pin' }))
    expect(screen.queryByText('1.296612, 103.852034')).toBeNull()

    await save()

    await waitFor(() => expect(g.sent).toHaveLength(1))
    expect(g.sent[0]).toEqual({ name: 'Staircase' })
  })

  it('says location access is off, offers Settings, and still saves (AC15)', async () => {
    permission.mockResolvedValue({ granted: false, canAskAgain: false })
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    const g = gateway()
    await openForm()

    await pin()

    expect(await screen.findByText('Location access is off. Turn it on in Settings, or save without a pin.')).toBeTruthy()
    expect(position).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }))
    expect(open).toHaveBeenCalled()
    await save()
    await waitFor(() => expect(g.sent).toHaveLength(1))
    expect(g.sent[0]).toEqual({ name: 'Staircase' })
  })

  it("says when there's no fix, and the button stays to try again (AC15)", async () => {
    position.mockRejectedValue(new Error('Location request failed'))
    gateway()
    await openForm()

    await pin()

    expect(await screen.findByText("Couldn't find your position. Try near a window, then try again.")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pin where I am' })).toBeTruthy()
  })

  it('asks the phone once for two quick taps (AC16)', async () => {
    gateway()
    await openForm()

    // The same button, pressed twice before the position arrives.
    const button = screen.getByRole('button', { name: 'Pin where I am' })
    await fireEvent.press(button)
    await fireEvent.press(button)

    await screen.findByText('1.296612, 103.852034')
    expect(position).toHaveBeenCalledTimes(1)
  })

  it('keeps the pin on a location queued with no signal (AC17)', async () => {
    gateway({ [`POST /api/assessments/${REF}/locations`]: new TypeError('Network request failed') })
    await openForm()
    await pin()
    await screen.findByText('1.296612, 103.852034')

    await save()

    await waitFor(() => {
      const queue = [...files.entries()].find(([k]) => k.endsWith('queue.json'))
      expect(queue?.[1]).toContain('"coordinates":{"lat":1.296612,"lng":103.852034}')
    })
  })

  it("shows the gateway's words under the pin when it refuses them (AC18)", async () => {
    gateway({
      [`POST /api/assessments/${REF}/locations`]: {
        status: 400,
        body: { error: 'The location details are invalid.', fields: { coordinates: 'Latitude must be between -90 and 90.' } },
      },
    })
    await openForm()
    await pin()
    await screen.findByText('1.296612, 103.852034')

    await save()

    expect(await screen.findByText('Latitude must be between -90 and 90.')).toBeTruthy()
  })
})
