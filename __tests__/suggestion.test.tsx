// MB-23: the AI's suggested category and severity on an observation (the web's CP-24, the checking
// half). Renders the real routes with the gateway mocked; the gateway's `suggestion` field decides what
// shows. The poll is shortened so the test is quick. Nothing here reaches a real server or a paid call.
import { render } from '@testing-library/react-native'
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { ObservationCard } from '@/features/observations/components/ObservationCard'
import type { Observation } from '@/features/observations/format'
import { assessment, location, mockGateway, observation, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

// Every 20 ms, three times, instead of every 5 s for 2 minutes (src/features/observations/transcriptPoll.ts).
jest.mock('@/features/observations/transcriptPoll', () => ({ POLL_MS: 20, POLL_LIMIT: 3 }))

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const STAIRCASE = { id: 'l1', building: 'Block B', floor: 'Level 2', name: 'Staircase' }
const NETWORK = new TypeError('Network request failed')

const suggested = (over: object = {}) => ({ status: 'done', error: null, category: null, severity: null, ...over })

// What the gateway holds for observation o1.
let held: Record<string, unknown>
const saved = (over: object = {}) =>
  observation('o1', 'l1', { note: 'Valve chained open', location: STAIRCASE, copeDimensions: ['Protection'], severity: 'high', ...over })

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Staircase', 'Block B', 'Level 2')] },
    [`GET /api/assessments/${REF}/observations`]: () => ({ status: 200, body: [held] }),
    ...overrides,
  })
}

async function openDetail() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
  await fireEvent.press(await screen.findByRole('button', { name: /^Staircase/ }))
  await fireEvent.press(await screen.findByTestId('observation-open'))
  return within(await screen.findByTestId('observation-detail'))
}

const calls = (fetchMock: jest.Mock, method: string, tail: string) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(tail) && (init?.method ?? 'GET') === method)

beforeEach(() => {
  jest.restoreAllMocks()
  held = saved()
})

describe('see the state', () => {
  it('marks a suggested field Not sure, with Confirm and Change, and leaves a chosen one bare (AC1)', async () => {
    held = saved({ suggestion: suggested({ category: { notSure: true } }), toCheck: true })
    gateway()
    const detail = await openDetail()

    expect(await detail.findByText('Not sure')).toBeTruthy()
    expect(detail.getByRole('button', { name: 'Confirm category' })).toBeTruthy()
    expect(detail.getByRole('button', { name: 'Change category' })).toBeTruthy()
    // The severity was the engineer's: no mark, no buttons.
    expect(detail.queryByRole('button', { name: 'Confirm severity' })).toBeNull()
    expect(detail.queryByRole('button', { name: 'Change severity' })).toBeNull()
  })

  it('says Suggesting while the AI reads an empty field (AC2)', async () => {
    held = saved({ copeDimensions: null, severity: null, suggestion: suggested({ status: 'reading' }), toCheck: true })
    gateway()
    const detail = await openDetail()

    expect(await detail.findByText('Suggesting a category')).toBeTruthy()
    expect(detail.getByText('Suggesting a severity')).toBeTruthy()
    expect(detail.queryByText('Not sure')).toBeNull()
  })

  it('says Suggestion failed with Try again, even with older values filled in, and asks for a choice where empty (AC3)', async () => {
    held = saved({ severity: null, suggestion: suggested({ status: 'failed', error: 'The model timed out' }), toCheck: true })
    gateway()
    const detail = await openDetail()

    expect(await detail.findByText('Suggestion failed')).toBeTruthy()
    expect(detail.getByRole('button', { name: 'Try again: suggestion' })).toBeTruthy()
    expect(detail.getByText('Choose a severity')).toBeTruthy()
    // The category still holds a value, so it is not asked for.
    expect(detail.queryByText('Choose a category')).toBeNull()
  })

  it('shows no marks on an observation with no suggestion (AC1)', async () => {
    gateway()
    const detail = await openDetail()

    await detail.findByText('Valve chained open')
    expect(detail.queryByText('Not sure')).toBeNull()
    expect(detail.queryByText('Suggestion failed')).toBeNull()
  })
})

describe('act on it', () => {
  it('Confirm sends the confirmation, clears the mark and keeps the value (AC6, AC17)', async () => {
    held = saved({ suggestion: suggested({ category: { notSure: true } }), toCheck: true })
    const fetchMock = gateway({
      'PATCH /api/observations/o1': () => {
        held = saved()
        return { status: 200, body: held }
      },
    })
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Confirm category' }))

    await waitFor(() => expect(detail.queryByText('Not sure')).toBeNull())
    expect(detail.getByText('Protection')).toBeTruthy()
    const [[, init]] = calls(fetchMock, 'PATCH', '/api/observations/o1')
    expect(JSON.parse(String(init?.body))).toEqual({ confirm: ['category'] })
    // The old "Get AI proposal" route is gone from the gateway; the phone never calls it.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/interpretation'))).toBe(false)
  })

  it('Change opens the edit screen, where the pickers are (AC7)', async () => {
    held = saved({ suggestion: suggested({ severity: { notSure: true } }), toCheck: true })
    gateway()
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Change severity' }))

    expect(await screen.findByTestId('observation-edit')).toBeTruthy()
  })

  it('Change, then choosing the value the AI suggested, makes it the engineer\'s and clears the mark (AC7)', async () => {
    held = saved({ suggestion: suggested({ severity: { notSure: true } }), toCheck: true })
    const fetchMock = gateway({
      'PATCH /api/observations/o1': () => {
        held = saved()
        return { status: 200, body: held }
      },
    })
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Change severity' }))
    const edit = within(await screen.findByTestId('observation-edit'))
    // The same value the AI suggested: the gateway counts a sent value as the engineer's, even if unchanged.
    await fireEvent.press(edit.getByRole('button', { name: 'High' }))
    await fireEvent.press(edit.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(within(screen.getByTestId('observation-detail')).queryByText('Not sure')).toBeNull())
    const [[, init]] = calls(fetchMock, 'PATCH', '/api/observations/o1')
    expect(JSON.parse(String(init?.body))).toEqual({ severity: 'high' })
  })

  it('Try again sends one request, even on a double tap, and says Suggesting (AC8)', async () => {
    held = saved({ severity: null, suggestion: suggested({ status: 'failed', error: 'x' }), toCheck: true })
    const fetchMock = gateway({
      'POST /api/observations/o1/suggestion/retry': () => {
        held = saved({ severity: null, suggestion: suggested({ status: 'reading' }), toCheck: true })
        return { status: 202, body: held }
      },
    })
    const detail = await openDetail()

    const button = await detail.findByRole('button', { name: 'Try again: suggestion' })
    await fireEvent.press(button)
    await fireEvent.press(button) // a second quick tap

    expect(await detail.findByText('Suggesting a severity')).toBeTruthy()
    expect(detail.queryByText('Suggestion failed')).toBeNull()
    expect(calls(fetchMock, 'POST', '/api/observations/o1/suggestion/retry')).toHaveLength(1)
  })

  it('says why when the gateway refuses, and keeps the mark (AC9)', async () => {
    held = saved({ suggestion: suggested({ category: { notSure: true } }), toCheck: true })
    gateway({ 'PATCH /api/observations/o1': { status: 403, body: { error: 'Only the assigned engineer can change this.' } } })
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Confirm category' }))

    expect(await detail.findByText('Only the assigned engineer can change this.')).toBeTruthy()
    expect(detail.getByText('Not sure')).toBeTruthy()
    expect(detail.getByRole('button', { name: 'Confirm category' })).toBeTruthy()
  })

  it('says so with no signal, and the mark stays (AC9)', async () => {
    held = saved({ suggestion: suggested({ category: { notSure: true } }), toCheck: true })
    gateway({ 'PATCH /api/observations/o1': NETWORK })
    const detail = await openDetail()

    await fireEvent.press(await detail.findByRole('button', { name: 'Confirm category' }))

    expect(await detail.findByText(/Can't reach the server/)).toBeTruthy()
    expect(detail.getByText('Not sure')).toBeTruthy()
  })

  it('greys Confirm, Change and Try again with their words when there is no signal, keeping the marks (AC10)', async () => {
    held = saved({ severity: null, suggestion: suggested({ status: 'failed', error: 'x', category: { notSure: true } }), toCheck: true })
    gateway()
    await openDetail()
    // The signal goes, and the screen is opened again: the last copy shows.
    globalThis.fetch = jest.fn(async () => {
      throw NETWORK
    }) as unknown as typeof fetch
    await screen.unmount()
    await renderRouter(routes)
    await fireEvent.press(await screen.findByText(REF))
    await screen.findByTestId('workspace')
    await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
    await fireEvent.press(await screen.findByRole('button', { name: /^Staircase/ }))
    await fireEvent.press(await screen.findByTestId('observation-open'))
    const detail = within(await screen.findByTestId('observation-detail'))

    expect(await detail.findByText('Not sure')).toBeTruthy()
    expect(detail.getByText('Suggestion failed')).toBeTruthy()
    expect(detail.getByRole('button', { name: 'Confirm category' }).props.accessibilityState.disabled).toBe(true)
    expect(detail.getByRole('button', { name: 'Change category' }).props.accessibilityState.disabled).toBe(true)
    expect(detail.getByRole('button', { name: 'Try again: suggestion' }).props.accessibilityState.disabled).toBe(true)
    expect(detail.getByText('Connect to confirm.')).toBeTruthy()
    expect(detail.getByText('Connect to try again.')).toBeTruthy()
  })
})

describe('fresh and honest', () => {
  it('reads the observation again while the AI is reading, and shows what it suggested (AC15)', async () => {
    held = saved({ copeDimensions: null, severity: null, suggestion: suggested({ status: 'reading' }), toCheck: true })
    gateway()
    const detail = await openDetail()
    expect(await detail.findByText('Suggesting a category')).toBeTruthy()

    // The gateway finishes in the background.
    held = saved({
      copeDimensions: ['Protection'],
      severity: 'high',
      suggestion: suggested({ category: { notSure: true }, severity: { notSure: true } }),
      toCheck: true,
    })

    expect(await detail.findByRole('button', { name: 'Confirm category' })).toBeTruthy()
    expect(detail.queryByText('Suggesting a category')).toBeNull()
  })

  it('gives up after a while and says so (AC15)', async () => {
    held = saved({ copeDimensions: null, severity: null, suggestion: suggested({ status: 'reading' }), toCheck: true })
    gateway()
    const detail = await openDetail()

    expect(await detail.findByText('Still working. Check back soon.')).toBeTruthy()
  })
})

describe('on the list', () => {
  const row = (id: string, note: string, over: object = {}) =>
    observation(id, 'l1', { note, location: STAIRCASE, copeDimensions: ['Protection'], severity: 'high', ...over })

  async function openList() {
    await renderRouter(routes)
    await fireEvent.press(await screen.findByText(REF))
    await screen.findByTestId('workspace')
    await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
    await fireEvent.press(await screen.findByRole('button', { name: /^Staircase/ }))
  }
  const card = async (text: string) => {
    const note = await screen.findByText(text)
    // The card is the row's nearest ancestor with the card's test ID.
    return within(screen.getAllByTestId('observation-card').find((c) => within(c).queryByText(text)) ?? note)
  }

  it('shows each state under the title, and nothing on a complete one (AC4)', async () => {
    const list = [
      row('o1', 'Row reading', { suggestion: suggested({ status: 'reading' }) }),
      row('o2', 'Row to check', { suggestion: suggested({ category: { notSure: true } }), toCheck: true }),
      row('o3', 'Row failed', { suggestion: suggested({ status: 'failed', error: 'x' }), toCheck: true }),
      row('o4', 'Row transcribing', { recordings: [{ id: 'r1', url: '/x', transcription: { status: 'transcribing', transcript: null, error: null } }] }),
      row('o5', 'Row transcript failed', { recordings: [{ id: 'r2', url: '/x', transcription: { status: 'failed', transcript: null, error: 'x' } }] }),
      row('o6', 'Row complete'),
    ]
    gateway({ [`GET /api/assessments/${REF}/observations`]: { status: 200, body: list } })
    await openList()

    expect((await card('Row reading')).getByText('Reading')).toBeTruthy()
    const toCheck = await card('Row to check')
    expect(toCheck.getByText('To check')).toBeTruthy()
    expect(toCheck.getByText('Check category')).toBeTruthy()
    const failed = await card('Row failed')
    expect(failed.getByText('Reading failed')).toBeTruthy()
    expect(failed.getByText('Suggestion failed')).toBeTruthy()
    expect((await card('Row transcribing')).getByText('Transcribing')).toBeTruthy()
    expect((await card('Row transcript failed')).getByText('Transcription failed')).toBeTruthy()
    expect((await card('Row complete')).queryByText(/Reading|Transcri|To check|Check |failed/)).toBeNull()
  })

  it('gives a row waiting to upload no marks (AC5)', async () => {
    // A waiting one has not reached the gateway, so it cannot have a suggestion; the card shows none even if given one.
    const o = row('q1', 'Waiting note', { suggestion: suggested({ status: 'reading' }), toCheck: true }) as unknown as Observation
    await render(<ObservationCard observation={o} first last upload={{}} />)

    expect(screen.getByText('Waiting to upload')).toBeTruthy()
    expect(screen.queryByText('Reading')).toBeNull()
    expect(screen.queryByText('To check')).toBeNull()
  })

  it('reads the list again while a row is reading, so it settles without pulling to refresh (AC16)', async () => {
    let list: object[] = [row('o1', 'Row reading', { suggestion: suggested({ status: 'reading' }), toCheck: true })]
    gateway({ [`GET /api/assessments/${REF}/observations`]: () => ({ status: 200, body: list }) })
    await openList()
    expect((await card('Row reading')).getByText('Reading')).toBeTruthy()

    list = [row('o1', 'Row reading')]

    await waitFor(() => expect(within(screen.getByTestId('observation-card')).queryByText('Reading')).toBeNull())
  })
})
