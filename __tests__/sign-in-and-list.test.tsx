// MB-01: sign in and see my assessments. Renders the real routes through Expo
// Router with the gateway's responses mocked, so no test reaches a server.
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import Layout from '../src/app/_layout'
import Chat from '../src/app/(tabs)/chat'
import Home from '../src/app/(tabs)/index'
import TabsLayout from '../src/app/(tabs)/_layout'
import Profile from '../src/app/(tabs)/profile'
import SignIn from '../src/app/sign-in'

// Tailwind source, compiled by Metro at build time; Jest can't read it and
// the tests don't check styles.
jest.mock('../global.css', () => ({}))

type Reply = { status: number; body?: unknown; html?: boolean } | Error

// Mocks `fetch` from a table of "METHOD /path" → reply. A function reply lets a
// test change its answer between calls; `html: true` replies with a page that
// isn't JSON. Unlisted routes fail the test loudly.
function mockGateway(routes: Record<string, Reply | (() => Reply)>) {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${new URL(url).pathname}`
    const route = routes[key]
    if (!route) throw new Error(`Unexpected request: ${key}`)
    const reply = typeof route === 'function' ? route() : route
    if (reply instanceof Error) throw reply
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => {
        if (reply.html) throw new SyntaxError('Unexpected token <')
        return reply.body
      },
    } as Response
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

const engineer = { id: 'u1', role: 'risk_engineer', name: 'Ava Tan' }
const signedIn = { status: 200, body: { user: engineer, permissions: [], notifications: {} } }
const signedOut = { status: 401, body: { error: 'Sign in required.' } }

// One assessment in the gateway's AssessmentDto shape (fields this story reads).
function assessment(reference: string, status: string, overrides: object = {}) {
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

const routes = {
  _layout: Layout,
  'sign-in': SignIn,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Home,
  '(tabs)/chat': Chat,
  '(tabs)/profile': Profile,
}

// Taps a bottom tab by its label.
async function openTab(label: string) {
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(label) }))
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_URL = 'http://gateway.test:4000'
})

async function signInWith(email: string, password: string) {
  await fireEvent.changeText(await screen.findByLabelText('Work email'), email)
  await fireEvent.changeText(screen.getByLabelText('Password'), password)
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
}

describe('sign in', () => {
  it('shows my assessments after a successful sign-in (AC1)', async () => {
    const fetchMock = mockGateway({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': signedIn,
      'GET /api/assessments': { status: 200, body: [assessment('RPT-2026-0411', 'capturing')] },
    })
    await renderRouter(routes)
    await signInWith('ava@marsh.test', 'secret')

    expect(await screen.findByText('RPT-2026-0411')).toBeTruthy()
    const login = fetchMock.mock.calls.find(([url]) => url.endsWith('/api/auth/login'))!
    expect(JSON.parse(String(login[1]!.body))).toEqual({ email: 'ava@marsh.test', password: 'secret' })
  })

  it("shows the gateway's message for wrong credentials and stays on sign-in (AC2)", async () => {
    mockGateway({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': { status: 401, body: { error: 'Email or password is incorrect.' } },
    })
    await renderRouter(routes)
    await signInWith('ava@marsh.test', 'wrong')

    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
  })

  it("shows the gateway's lockout message after too many tries (AC3)", async () => {
    mockGateway({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': { status: 429, body: { error: 'Too many attempts. Try again in 15 minutes.' } },
    })
    await renderRouter(routes)
    await signInWith('ava@marsh.test', 'wrong')

    expect(await screen.findByText('Too many attempts. Try again in 15 minutes.')).toBeTruthy()
  })

  it("says so when the gateway can't be reached (AC4)", async () => {
    mockGateway({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': new TypeError('Network request failed'),
    })
    await renderRouter(routes)
    await signInWith('ava@marsh.test', 'secret')

    expect(
      await screen.findByText("Can't reach the server. Check your connection, then try again."),
    ).toBeTruthy()
  })

  it('treats a Wi-Fi login page as no connection (AC4)', async () => {
    mockGateway({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': { status: 200, html: true },
    })
    await renderRouter(routes)
    await signInWith('ava@marsh.test', 'secret')

    expect(
      await screen.findByText("Can't reach the server. Check your connection, then try again."),
    ).toBeTruthy()
  })

  it('says what failed when the launch check gets a server error', async () => {
    mockGateway({
      'GET /api/auth/me': { status: 500, body: { error: 'Database unavailable.' } },
    })
    await renderRouter(routes)

    expect(await screen.findByText('Database unavailable.')).toBeTruthy()
    expect(screen.getByLabelText('Work email')).toBeTruthy()
  })

  it('skips sign-in when the session is still valid (AC5)', async () => {
    mockGateway({
      'GET /api/auth/me': signedIn,
      'GET /api/assessments': { status: 200, body: [assessment('RPT-2026-0411', 'capturing')] },
    })
    await renderRouter(routes)

    expect(await screen.findByText('RPT-2026-0411')).toBeTruthy()
    expect(screen.queryByLabelText('Work email')).toBeNull()
  })

  it('returns to sign-in with a message when the session has expired (AC6)', async () => {
    mockGateway({
      'GET /api/auth/me': signedIn,
      'GET /api/assessments': { status: 401, body: { error: 'Session expired or invalid.' } },
    })
    await renderRouter(routes)

    expect(
      await screen.findByText(
        'Your session ended after 15 minutes without activity. Sign in again.',
      ),
    ).toBeTruthy()
    expect(screen.getByLabelText('Work email')).toBeTruthy()
  })

  it('signs out from the Profile tab (AC7)', async () => {
    const fetchMock = mockGateway({
      'GET /api/auth/me': signedIn,
      'GET /api/assessments': { status: 200, body: [] },
      'POST /api/auth/logout': { status: 204 },
    })
    await renderRouter(routes)
    await openTab('Profile')
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByLabelText('Work email')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/api/auth/logout'))).toBe(true)
  })
})

describe('tabs', () => {
  it('opens on Home and offers Chatbot and Profile tabs', async () => {
    mockGateway({
      'GET /api/auth/me': signedIn,
      'GET /api/assessments': { status: 200, body: [assessment('RPT-2026-0411', 'capturing')] },
    })
    await renderRouter(routes)

    expect(await screen.findByText('RPT-2026-0411')).toBeTruthy()
    for (const tab of ['Home', 'Chatbot', 'Profile']) {
      expect(screen.getByRole('button', { name: new RegExp(tab) })).toBeTruthy()
    }
  })

  it("shows the engineer's name and role on Profile", async () => {
    mockGateway({
      'GET /api/auth/me': signedIn,
      'GET /api/assessments': { status: 200, body: [] },
    })
    await renderRouter(routes)
    await openTab('Profile')

    expect(await screen.findByText('Ava Tan')).toBeTruthy()
    expect(screen.getByText('Risk engineer')).toBeTruthy()
  })

  it('says the chatbot is coming, without calling it', async () => {
    const fetchMock = mockGateway({
      'GET /api/auth/me': signedIn,
      'GET /api/assessments': { status: 200, body: [] },
    })
    await renderRouter(routes)
    await openTab('Chatbot')

    expect(await screen.findByText('Ask the knowledge base')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/api/chat'))).toBe(false)
  })
})

describe('assessments', () => {
  it('shows client, site, reference, visit date and status on each row (AC8)', async () => {
    mockGateway({
      'GET /api/auth/me': signedIn,
      'GET /api/assessments': { status: 200, body: [assessment('RPT-2026-0411', 'ready_to_generate')] },
    })
    await renderRouter(routes)

    expect(await screen.findByText('Harbour Malls')).toBeTruthy()
    expect(screen.getByText('Marina Point')).toBeTruthy()
    expect(screen.getByText('RPT-2026-0411')).toBeTruthy()
    expect(screen.getByText('11 Apr 2026')).toBeTruthy()
    expect(screen.getByText('Ready to generate')).toBeTruthy()
  })

  it('lists every status but archived (AC9)', async () => {
    const statuses = ['not_started', 'capturing', 'ready_to_generate', 'draft', 'under_review', 'finalised']
    mockGateway({
      'GET /api/auth/me': signedIn,
      'GET /api/assessments': {
        status: 200,
        body: [
          ...statuses.map((s, i) => assessment(`RPT-2026-000${i}`, s)),
          assessment('RPT-2026-0099', 'archived'),
        ],
      },
    })
    await renderRouter(routes)

    expect(await screen.findByText('RPT-2026-0000')).toBeTruthy()
    for (const label of ['Not started', 'Capturing', 'Ready to generate', 'Draft', 'Under review', 'Finalised']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.queryByText('RPT-2026-0099')).toBeNull()
  })

  it('explains an empty list (AC10)', async () => {
    mockGateway({
      'GET /api/auth/me': signedIn,
      'GET /api/assessments': { status: 200, body: [] },
    })
    await renderRouter(routes)

    expect(
      await screen.findByText(
        'No assessments assigned. Assessments appear here once one is created for you on the web app.',
      ),
    ).toBeTruthy()
  })

  it('reloads when pulled down (AC11)', async () => {
    let calls = 0
    mockGateway({
      'GET /api/auth/me': signedIn,
      'GET /api/assessments': () => {
        calls += 1
        const reference = calls === 1 ? 'RPT-2026-0411' : 'RPT-2026-0412'
        return { status: 200, body: [assessment(reference, 'capturing')] }
      },
    })
    await renderRouter(routes)
    await screen.findByText('RPT-2026-0411')

    const list = screen.getByTestId('assessment-list')
    await act(async () => {
      await list.props.refreshControl.props.onRefresh()
    })

    expect(await screen.findByText('RPT-2026-0412')).toBeTruthy()
  })
})
