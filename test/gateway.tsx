// Shared test helpers (MB-01, MB-02): a mocked gateway, sample data and the
// app's routes for renderRouter. Lives outside __tests__/, where Jest would run
// it as a test file.
import { fireEvent, screen } from 'expo-router/testing-library'
import Layout from '../src/app/_layout'
import Chat from '../src/app/(tabs)/chat'
import Home from '../src/app/(tabs)/index'
import TabsLayout from '../src/app/(tabs)/_layout'
import Profile from '../src/app/(tabs)/profile'
import Capture from '../src/app/assessment/[reference]/capture'
import Workspace from '../src/app/assessment/[reference]/index'
import LocationPicker from '../src/app/assessment/[reference]/locations'
import SignIn from '../src/app/sign-in'

// Tailwind source, compiled by Metro at build time; Jest can't read it and
// the tests don't check styles.
jest.mock('../global.css', () => ({}))

export type Reply =
  | { status: number; body?: unknown; html?: boolean; stream?: ReadableStream<Uint8Array> }
  | Error

// A reply body that arrives in pieces, as the chat's event stream does (MB-06).
// Each chunk is sent when the test calls `next()`, or all at once with `rest()`;
// `close()` ends it. Lets a test look at the screen mid-answer.
export function chunkedStream() {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) })
  return {
    stream,
    send: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  }
}

// One server-sent event, as the gateway writes them.
export const sse = (event: object) => `data: ${JSON.stringify(event)}\n\n`

// Mocks `fetch` from a table of "METHOD /path" → reply. A function reply lets a
// test change its answer between calls, or read the request; `html: true`
// replies with a page that isn't JSON; `stream` replies with a body to read in
// pieces. Unlisted routes fail the test loudly.
export function mockGateway(
  routes: Record<string, Reply | ((init?: RequestInit) => Reply)>,
) {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${new URL(url).pathname}`
    const route = routes[key]
    if (!route) throw new Error(`Unexpected request: ${key}`)
    const reply = typeof route === 'function' ? route(init) : route
    if (reply instanceof Error) throw reply
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      body: reply.stream ?? null,
      headers: new Headers({ 'content-type': reply.stream ? 'text/event-stream' : 'application/json' }),
      json: async () => {
        if (reply.html) throw new SyntaxError('Unexpected token <')
        return reply.body
      },
    } as Response
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

export const engineer = { id: 'u1', role: 'risk_engineer', name: 'Ava Tan' }
export const signedIn = { status: 200, body: { user: engineer, permissions: [], notifications: {} } }
export const signedOut = { status: 401, body: { error: 'Sign in required.' } }

// One assessment in the gateway's AssessmentDto shape (fields the app reads).
export function assessment(reference: string, status: string, overrides: object = {}) {
  return {
    id: reference,
    reference,
    client: 'Harbour Malls',
    siteVisitDate: '2026-04-11',
    status,
    site: { id: 's1', code: 'S-001', name: 'Marina Point', address: null },
    ...overrides,
  }
}

// A location in the gateway's LocationDto shape.
export function location(id: string, name: string, building: string | null = null, floor: string | null = null) {
  return { id, building, floor, name }
}

// An observation in the gateway's ObservationDto shape (fields the app reads).
export function observation(id: string, locationId: string, overrides: object = {}) {
  return {
    id,
    note: null,
    copeDimensions: null,
    severity: 'moderate',
    location: { id: locationId, building: null, floor: null, name: 'Any' },
    recordings: [],
    photos: [],
    pages: [],
    recordedAt: '2026-04-11T01:42:00.000Z',
    ...overrides,
  }
}

export const routes = {
  _layout: Layout,
  'sign-in': SignIn,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Home,
  '(tabs)/chat': Chat,
  '(tabs)/profile': Profile,
  'assessment/[reference]/index': Workspace,
  'assessment/[reference]/locations': LocationPicker,
  'assessment/[reference]/capture': Capture,
}

// Taps a bottom tab by its label.
export async function openTab(label: string) {
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(label) }))
}

// Points the app at a fake gateway; request() reads this on every call.
export function pointAtTestGateway() {
  beforeAll(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://gateway.test:4000'
  })
}
