// MB-16 part A (AC1-AC4): the Site walks screen: a walk's status in words, refreshing while it works,
// Try again, rename and discard. The gateway is mocked; every AI step is the gateway's, never a test's.
import { Alert } from 'react-native'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

import { addPending, pendingFor } from '../src/features/sitewalk/pending'

pointAtTestGateway()
// Every 20 ms, instead of every 5 s (src/features/sitewalk/poll.ts).
jest.mock('@/features/sitewalk/poll', () => ({ WALK_POLL_MS: 20 }))

const REF = 'RPT-2026-0411'
const base = { recordings: [], photos: [], notes: [], media: [], typedText: null, proposal: null, error: null }
const walk = (id: string, status: string, extra: object = {}) => ({ id, status, name: null, createdAt: '2026-11-12T03:00:00.000Z', ...base, ...extra })

let walks: object[]
const calls: string[] = []

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Lobby')] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    [`GET /api/assessments/${REF}/site-walks`]: () => ({ status: 200, body: walks }),
    ...overrides,
  })
}

async function openWalks() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await screen.findByRole('button', { name: 'Site walk' }))
  return within(await screen.findByTestId('site-walks'))
}

beforeEach(() => {
  jest.restoreAllMocks()
  calls.length = 0
  walks = [
    walk('w3', 'ready', { name: 'Block A walk' }),
    walk('w2', 'transcribing', { name: 'Yard' }),
    walk('w1', 'failed', { error: 'The speech service could not be reached.' }),
  ]
})

describe('the Site walks screen', () => {
  it('lists the walks, with each status in words (AC1, AC2)', async () => {
    gateway()
    const list = await openWalks()

    expect(await list.findByText('Block A walk')).toBeTruthy()
    expect(within(list.getByTestId('walk-w3')).getByText('Ready to review')).toBeTruthy()
    expect(within(list.getByTestId('walk-w2')).getByText('Transcribing')).toBeTruthy()
    // A walk with no name is just "Site walk".
    expect(within(list.getByTestId('walk-w1')).getByText('Site walk')).toBeTruthy()
    expect(within(list.getByTestId('walk-w1')).getByText("Couldn't process")).toBeTruthy()
    expect(list.getByText('The speech service could not be reached.')).toBeTruthy()
  })

  // Changed 15 Nov (AC2, AC18, Miya): a walk already created stays on the list under "Added to the assessment",
  // read-only, as in the web. (First written the other way, hiding it, from a misreading of the gateway's comment.)
  it('keeps a created walk under "Added to the assessment", with only View (AC2, AC18, AC40)', async () => {
    walks = [
      walk('w9', 'created', { name: 'Done walk', proposal: { locations: [{ ref: 'loc-1' }], observations: [{ ref: 'obs-1' }, { ref: 'obs-2' }] } }),
      walk('w3', 'ready', { name: 'Block A walk' }),
    ]
    gateway()
    const list = await openWalks()

    expect(await list.findByText('Block A walk')).toBeTruthy()
    expect(within(list.getByTestId('walk-w3')).getByRole('button', { name: 'Review: Block A walk' })).toBeTruthy()
    const added = within(list.getByTestId('walks-added'))
    expect(added.getByText('Added to the assessment')).toBeTruthy()
    const row = within(added.getByTestId('walk-w9'))
    expect(row.getByText('Done walk')).toBeTruthy()
    expect(row.getByText('Added')).toBeTruthy()
    expect(row.getByText('1 location · 2 observations')).toBeTruthy()
    // Nothing to rename or discard (the gateway refuses to change a created walk); it can only be viewed (AC40).
    expect(row.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['View: Done walk'])
  })

  it('says there are no walks yet (AC2)', async () => {
    walks = []
    gateway()
    const list = await openWalks()

    expect(await list.findByText('No site walks yet.')).toBeTruthy()
  })

  it('reads the list again while a walk is working, and stops when none is (AC3)', async () => {
    walks = [walk('w2', 'transcribing', { name: 'Yard' })]
    let reads = 0
    gateway({
      [`GET /api/assessments/${REF}/site-walks`]: () => {
        reads += 1
        if (reads >= 3) walks = [walk('w2', 'ready', { name: 'Yard' })]
        return { status: 200, body: walks }
      },
    })
    const list = await openWalks()

    expect(await list.findByText('Ready to review')).toBeTruthy()
    const settled = reads
    // The runner's timers are fake: let a few intervals pass.
    await act(async () => {
      jest.advanceTimersByTime(200)
    })
    expect(reads).toBe(settled)
  })

  it('tries a failed walk again (AC4)', async () => {
    gateway({
      [`POST /api/assessments/${REF}/site-walks/w1/retry`]: () => {
        calls.push('retry w1')
        walks = walks.map((w) => ((w as { id: string }).id === 'w1' ? walk('w1', 'proposing') : w))
        return { status: 200, body: walk('w1', 'proposing') }
      },
    })
    const list = await openWalks()

    await fireEvent.press(await list.findByRole('button', { name: 'Try again: Site walk' }))

    expect(await within(list.getByTestId('walk-w1')).findByText('Proposing observations')).toBeTruthy()
    expect(calls).toEqual(['retry w1'])
    expect(list.queryByRole('button', { name: 'Try again: Site walk' })).toBeNull()
  })

  it('renames a walk (AC4)', async () => {
    gateway({
      [`PUT /api/assessments/${REF}/site-walks/w3/name`]: (init) => {
        const { name } = JSON.parse(String(init?.body))
        calls.push(`name ${name}`)
        walks = walks.map((w) => ((w as { id: string }).id === 'w3' ? walk('w3', 'ready', { name }) : w))
        return { status: 200, body: walks[0] }
      },
    })
    const list = await openWalks()

    await fireEvent.press(await list.findByRole('button', { name: 'Rename Block A walk' }))
    await fireEvent.changeText(list.getByLabelText('Walk name'), 'Block A, morning')
    await fireEvent.press(list.getByRole('button', { name: 'Save name' }))

    expect(await list.findByText('Block A, morning')).toBeTruthy()
    expect(calls).toEqual(['name Block A, morning'])
  })

  it('discards a walk only after I confirm (AC4)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    gateway({
      [`DELETE /api/assessments/${REF}/site-walks/w1`]: () => {
        calls.push('discard w1')
        walks = walks.filter((w) => (w as { id: string }).id !== 'w1')
        return { status: 204, body: null }
      },
    })
    addPending('w1', { kind: 'note', seq: 1, text: 'waiting' })
    const list = await openWalks()

    await fireEvent.press(await list.findByRole('button', { name: 'Discard Site walk' }))
    expect(calls).toHaveLength(0)
    await act(async () => {
      ;(alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Discard')!.onPress!()
    })

    await waitFor(() => expect(list.queryByTestId('walk-w1')).toBeNull())
    expect(calls).toEqual(['discard w1'])
    // What the phone was still holding for that walk goes with it.
    expect(pendingFor('w1')).toEqual([])
  })

  it('asks "Discard this walk?" and says what is thrown away (AC39)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    gateway()
    const list = await openWalks()

    await fireEvent.press(await list.findByRole('button', { name: 'Discard Site walk' }))

    expect(alert.mock.calls[0][0]).toBe('Discard this walk?')
    expect(alert.mock.calls[0][1]).toMatch(/recordings, photos and notes are deleted/)
    expect((alert.mock.calls[0][2] as { text: string }[]).map((b) => b.text)).toEqual(['Keep', 'Discard'])
  })

  it('starts a walk and opens its recorder (AC5)', async () => {
    walks = []
    gateway({
      [`POST /api/assessments/${REF}/site-walks`]: () => {
        calls.push('start')
        walks = [walk('w9', 'recording')]
        return { status: 201, body: walks[0] }
      },
      [`GET /api/assessments/${REF}/site-walks/w9`]: () => ({ status: 200, body: walks[0] }),
    })
    const list = await openWalks()
    await list.findByText('No site walks yet.')

    await fireEvent.press(list.getByRole('button', { name: 'Start a walk' }))

    expect(await screen.findByTestId('walk-recording')).toBeTruthy()
    expect(calls).toEqual(['start'])
  })

  it('opens the recorder of a walk still being recorded (AC5)', async () => {
    walks = [walk('w9', 'recording', { name: 'Yard' })]
    gateway({ [`GET /api/assessments/${REF}/site-walks/w9`]: () => ({ status: 200, body: walks[0] }) })
    const list = await openWalks()

    await fireEvent.press(await list.findByRole('button', { name: 'Continue recording: Yard' }))

    expect(await screen.findByTestId('walk-recording')).toBeTruthy()
  })

  it("shows the gateway's words when a change is refused (AC4)", async () => {
    gateway({ [`POST /api/assessments/${REF}/site-walks/w1/retry`]: { status: 409, body: { error: 'This walk is not in a state to retry.' } } })
    const list = await openWalks()

    await fireEvent.press(await list.findByRole('button', { name: 'Try again: Site walk' }))

    expect(await list.findByText('This walk is not in a state to retry.')).toBeTruthy()
  })
})

describe('what a row says about its walk (AC38)', () => {
  const ob = (ref: string, extra: object = {}) => ({ ref, note: 'n', copeDimension: 'Protection', severity: 'high', locationRef: 'loc-1', recordingSeq: 1, start: 0, end: 1, photoIds: [], check: { severity: false, category: false, location: false }, ...extra })
  const loc = (ref: string) => ({ ref, existingId: null, kind: 'building', building: 'Block A', floor: null, name: ref })
  const photos = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, url: `/api/p${i + 1}`, recordingSeq: 1, offsetSec: i }))

  it('shows up to four photos, how many more, and what the proposal holds, with what is left to fix', async () => {
    walks = [
      walk('w3', 'ready', { name: 'Block A walk', photos: photos(6), proposal: { locations: [loc('loc-1'), loc('loc-2')], observations: [ob('obs-1'), ob('obs-2', { severity: null })] } }),
      walk('w4', 'ready', { name: 'Yard', proposal: { locations: [loc('loc-1')], observations: [ob('obs-1')] } }),
      walk('w5', 'ready', { name: 'Empty', proposal: { locations: [], observations: [] } }),
    ]
    gateway()
    const list = await openWalks()

    const row = within(await list.findByTestId('walk-w3'))
    expect(row.getAllByTestId(/^walk-photo-/)).toHaveLength(4)
    expect(row.getByText('+2')).toBeTruthy()
    expect(row.getByText('2 locations · 2 observations')).toBeTruthy()
    expect(row.getByText('1 to fix')).toBeTruthy()
    expect(within(list.getByTestId('walk-w4')).getByText('Ready to add')).toBeTruthy()
    expect(within(list.getByTestId('walk-w5')).getByText('No observations')).toBeTruthy()
  })
})
