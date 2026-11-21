// MB-20 (web AS-06): MarshBot's chat, opened from the Overview bar. Real routes, gateway mocked. It reads
// GET .../assistant (which records an open and can start paid AI on the real gateway) and sends POST .../assistant/replies.
// Cards drawn: tasks, rows, checklist, bars; the rest show their title. Criteria A1-A5, B6-B10, C11-C16, D17-D20 of the spec.
import { act, fireEvent, renderRouter, screen, testRouter, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, observation, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

pointAtTestGateway()

// Whole-app tests: opening the sheet goes through the chat and back, which needs more than Jest's 5 s on a busy machine.
jest.setTimeout(20000)

// Every 20 ms, three times, instead of every 5 s for 2 minutes (src/features/assistant/poll.ts).
jest.mock('@/features/assistant/poll', () => ({ POLL_MS: 20, POLL_LIMIT: 3 }))

const REF = 'RPT-2026-0411'
const THREAD = `GET /api/assessments/${REF}/assistant`
const REPLY = `POST /api/assessments/${REF}/assistant/replies`
const SUMMARY = `GET /api/assessments/${REF}/assistant/summary`

const SUMMARY_BODY = { reference: REF, stage: 'capture', stageLabel: 'Capture', stageIndex: 2, glance: [], next: { text: 'Next.', link: null, label: null }, items: [], areas: [], updatedAt: '2026-11-20T03:00:00.000Z' }

const tasks = {
  type: 'tasks',
  id: 'c-tasks',
  title: 'To Do',
  done: 0,
  total: 2,
  rows: [
    { id: 'r1', icon: 'footprints', tone: 'violet', title: 'Morning walk', detail: '9 proposed observations', bad: false, end: { type: 'button', label: 'Review', icon: null, link: { tab: 'observations', params: { walk: 'w1' } }, action: null } },
    { id: 'r2', icon: 'mic', tone: 'red', title: 'Loading Bay 2', detail: "Couldn't transcribe", bad: true, end: { type: 'button', label: 'Try Again', icon: 'refresh-cw', link: { tab: 'observations', params: { obs: 'o7' } }, action: 'retry-transcription' } },
  ],
}
const rows = {
  type: 'rows',
  id: 'c-rows',
  title: 'Still open',
  note: 'Two things to look at.',
  rows: [{ id: 'r3', icon: 'file-text', tone: 'amber', title: 'Report due', detail: 'In 3 days', bad: false, end: { type: 'open', link: { tab: 'review' }, label: 'Open Review' } }],
  ticks: [{ title: 'Site contacts', detail: '3 added', bar: null }],
  cta: { label: 'Open checklist', link: { tab: 'checklist' } },
}
const bars = {
  type: 'bars',
  id: 'c-bars',
  answered: 21,
  total: 48,
  areas: [{ area: 'Occupancy and Hazards', icon: 'factory', covered: 5, total: 7, link: { tab: 'checklist', params: { area: 'Occupancy and Hazards' } } }],
}
const checklist = {
  type: 'checklist',
  id: 'c-check',
  answered: 4,
  total: 12,
  gaps: [{ area: 'Fire Protection', icon: 'flame', tone: 'amber', covered: 4, total: 12, items: ['Fire pump arrangement'], more: 5, link: { tab: 'checklist' } }],
  fine: [],
}
const outline = { type: 'outline', id: 'c-out', title: 'Report outline', lead: 'Twelve sections.', items: [], next: null, key: [], cta: null }

const turn = (id: string, who: 'bot' | 'engineer', text: string, cards: object[] = [], tone = 'normal') => ({
  id,
  who,
  at: '2026-11-20T03:45:00.000Z',
  topic: 'capture',
  mood: 'idle',
  says: [{ text, tone }],
  cards,
  program: null,
})
const reply = (id: string, label: string, extra: object = {}) => ({ id, label, primary: false, picksDate: false, link: null, ...extra })

// The gateway's conversation (server/src/services/assistant/types.ts, AssistantThread), with what a test changes.
const thread = (extra: object = {}) => ({
  reference: REF,
  viewer: 'engineer',
  engineerName: 'Ava Tan',
  stage: 'capture',
  status: { text: '2 things to fix', tone: 'red', icon: 'circle-alert' },
  glance: [
    { icon: 'camera', label: 'Observations', value: '18', tone: 'normal' },
    { icon: 'list-checks', label: 'Checklist', value: '4 of 12', tone: 'amber' },
    { icon: 'calendar', label: 'Report Due', value: '16 Dec', tone: 'normal' },
  ],
  agenda: [],
  earlier: [],
  session: {
    id: 's1',
    startedAt: '2026-11-20T03:45:00.000Z',
    stage: 'capture',
    turns: [turn('t1', 'bot', 'Good morning, Ava!', [tasks], 'lead'), turn('t2', 'engineer', 'What else?'), turn('t3', 'bot', 'Here is what is still open.', [rows, bars, checklist, outline])],
  },
  replies: [reply('skip', 'Skip for now'), reply('what-else', 'What else?', { primary: true }), reply('another-visit', 'Another visit', { picksDate: true })],
  thinking: false,
  updatedAt: '2026-11-20T03:50:00.000Z',
  ...extra,
})

let online = true
let current: Reply | (() => Reply) = { status: 200, body: thread() }
let posted: Reply | ((init?: RequestInit) => Reply) = { status: 200, body: thread() }

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Staircase', 'Block B', 'Level 2')] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [observation('o7', 'l1', { note: 'Valve' })] },
    [`GET /api/assessments/${REF}/checklist`]: { status: 200, body: { scope: { facilityType: 'warehouse', jurisdiction: 'SG' }, standards: [], checklist: null } },
    [`GET /api/assessments/${REF}/site-walks`]: { status: 200, body: [] },
    [SUMMARY]: { status: 403, body: { error: 'Not yours.' } },
    [THREAD]: () => (!online ? new TypeError('Network request failed') : typeof current === 'function' ? current() : current),
    [REPLY]: (init) => (typeof posted === 'function' ? posted(init) : posted),
    ...overrides,
  })
}
async function openChat() {
  await renderRouter(routes, { initialUrl: `/assessment/${REF}/assistant` })
  await screen.findByTestId('assistant')
}
const bodies = (fetchMock: jest.Mock, key: string) =>
  fetchMock.mock.calls.filter(([u, i]) => `${i?.method ?? 'GET'} ${new URL(u).pathname}` === key).map(([, i]) => JSON.parse(i.body))
const calls = (fetchMock: jest.Mock, key: string) =>
  fetchMock.mock.calls.filter(([u, i]) => `${i?.method ?? 'GET'} ${new URL(u).pathname}` === key).length

beforeEach(() => {
  jest.restoreAllMocks()
  online = true
  current = { status: 200, body: thread() }
  posted = { status: 200, body: thread({ session: { id: 's1', startedAt: '', stage: 'capture', turns: [turn('t9', 'bot', 'All sorted.')] }, replies: [] }) }
})

describe('opening the chat (A)', () => {
  it('A1: the Overview bar opens the chat, not the sheet', async () => {
    current = { status: 200, body: thread() }
    gateway({ [SUMMARY]: { status: 200, body: SUMMARY_BODY } })
    await renderRouter(routes)
    await fireEvent.press(await screen.findByText(REF))
    await fireEvent.press(await screen.findByRole('button', { name: /^Overview/ }))

    await screen.findByTestId('assistant')
    expect(screen).toHavePathname(`/assessment/${REF}/assistant`)
    expect(screen.queryByTestId('overview-sheet')).toBeNull()
  })

  it('A2: shows the status line, the stage with its segments and the three facts', async () => {
    gateway()
    await openChat()

    expect(await screen.findByText('2 things to fix')).toBeTruthy()
    expect(screen.getByText('Capture · stage 3 of 8')).toBeTruthy()
    expect(screen.getByText('Observations')).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
    expect(screen.getByText('16 Dec')).toBeTruthy()
  })

  // Added 21 Nov (Miya): the status block takes a quarter of a phone's height, so the stage bar and the three facts fold away.
  it('A2b: Hide folds the stage bar and the three facts away, and keeps the status, the stage and Summary; Show brings them back', async () => {
    gateway()
    await openChat()
    await screen.findByText('2 things to fix')
    expect(screen.getByLabelText('Observations, 18')).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Hide stage details' }))
    expect(screen.queryByLabelText('Observations, 18')).toBeNull()
    expect(screen.getByText('Capture · stage 3 of 8')).toBeTruthy()
    expect(screen.getByText('2 things to fix')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Summary' })).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Show stage details' }))
    expect(screen.getByLabelText('Observations, 18')).toBeTruthy()
  })

  it("A3: draws each turn as its says then its cards, MarshBot's on the left and the engineer's on the right", async () => {
    gateway()
    await openChat()

    expect(await screen.findByText('Good morning, Ava!')).toBeTruthy()
    expect(screen.getByText('Here is what is still open.')).toBeTruthy()
    // The engineer's own turn: its text is a bubble of its own, with no MarshBot name above it.
    const mine = screen.getByTestId('turn-t2')
    expect(within(mine).getByText('What else?')).toBeTruthy()
    expect(within(mine).queryByText('MarshBot')).toBeNull()
    expect(within(screen.getByTestId('turn-t1')).getByText('MarshBot')).toBeTruthy()
  })

  it('A4: shows the typing dots and reads again until MarshBot stops', async () => {
    let reads = 0
    current = () => ({ status: 200, body: thread({ thinking: ++reads < 3 }) })
    const fetchMock = gateway()
    await openChat()

    expect(await screen.findByTestId('thinking')).toBeTruthy()
    await waitFor(() => expect(screen.queryByTestId('thinking')).toBeNull())
    expect(calls(fetchMock, THREAD)).toBe(3)
  })

  it('A4: gives up after the limit and says to check back', async () => {
    // A new object on every read, as the gateway sends (React ignores a state set to the very same object).
    current = () => ({ status: 200, body: thread({ thinking: true }) })
    const fetchMock = gateway()
    await openChat()

    expect(await screen.findByText('Still working. Check back soon.')).toBeTruthy()
    // The first read, then one more for each poll up to the limit: no more after that.
    const reads = calls(fetchMock, THREAD)
    expect(reads).toBe(1 + 3)
    // Nothing more is read once it has given up.
    await waitFor(() => expect(calls(fetchMock, THREAD)).toBe(reads))
  })

  it('A5: Summary goes back to the workspace and opens the Overview sheet', async () => {
    gateway({ [SUMMARY]: { status: 200, body: SUMMARY_BODY } })
    await openChat()
    await fireEvent.press(await screen.findByRole('button', { name: 'Summary' }))

    expect(await screen.findByTestId('overview-sheet')).toBeTruthy()
    expect(screen).toHavePathname(`/assessment/${REF}`)
  })
})

describe('the cards (B)', () => {
  it('B6: a To do card lists its rows with their buttons; a button with an action opens the observation instead of retrying', async () => {
    const fetchMock = gateway()
    await openChat()
    const card = within(await screen.findByTestId('card-c-tasks'))

    expect(card.getByText('To Do')).toBeTruthy()
    expect(card.getByText('0 of 2 done')).toBeTruthy()
    expect(card.getByText('9 proposed observations')).toBeTruthy()
    expect(card.getByText("Couldn't transcribe")).toBeTruthy()
    await fireEvent.press(card.getByRole('button', { name: 'Try Again' }))

    await waitFor(() => expect(screen).toHavePathname(`/assessment/${REF}/observation/o7`))
    // The phone's own Try again (MB-12) is on that screen: one paid call per tap, chosen there.
    expect(calls(fetchMock, `POST /api/observations/o7/transcription/retry`)).toBe(0)
  })

  it('B6: Review opens the site walks', async () => {
    gateway()
    await openChat()
    await fireEvent.press(within(await screen.findByTestId('card-c-tasks')).getByRole('button', { name: 'Review' }))

    await waitFor(() => expect(screen).toHavePathname(`/assessment/${REF}/site-walks`))
  })

  it('B7: a rows card shows its note, rows, ticks and a call to action that opens the checklist', async () => {
    gateway()
    await openChat()
    const card = within(await screen.findByTestId('card-c-rows'))

    expect(card.getByText('Still open')).toBeTruthy()
    expect(card.getByText('Two things to look at.')).toBeTruthy()
    expect(card.getByText('Site contacts')).toBeTruthy()
    expect(card.getByText('3 added')).toBeTruthy()
    await fireEvent.press(card.getByRole('button', { name: 'Open checklist' }))

    await waitFor(() => expect(screen).toHavePathname(`/assessment/${REF}`))
    expect(await screen.findByRole('tab', { name: 'Checklist', selected: true })).toBeTruthy()
  })

  it('B8: bars and checklist cards show each area with how much is covered, and "+N more"', async () => {
    gateway()
    await openChat()

    const bar = within(await screen.findByTestId('card-c-bars'))
    expect(bar.getByText('21 of 48')).toBeTruthy()
    expect(bar.getByText('Occupancy and Hazards')).toBeTruthy()
    expect(bar.getByText('5 of 7')).toBeTruthy()
    const check = within(screen.getByTestId('card-c-check'))
    expect(check.getByText('Fire Protection')).toBeTruthy()
    expect(check.getByText('• Fire pump arrangement')).toBeTruthy()
    expect(check.getByText('+5 more')).toBeTruthy()
  })

  it('B9: an outline card shows its title and sends the detail to the web', async () => {
    gateway()
    await openChat()
    const card = within(await screen.findByTestId('card-c-out'))

    expect(card.getByText('Report outline')).toBeTruthy()
    expect(card.getByText('See the detail on the web.')).toBeTruthy()
  })

  it('B10: a link to Review is greyed and says to continue on the web', async () => {
    gateway()
    await openChat()
    const card = within(await screen.findByTestId('card-c-rows'))

    const open = card.getByRole('button', { name: /Open Review/ })
    expect(open.props.accessibilityState?.disabled).toBe(true)
    expect(card.getByText('Continue on the web.')).toBeTruthy()
  })

  // The gateway's "To Tidy Up" row: a long title, a detail and an `open` ending whose label is the web's hover tooltip.
  it('B11: a row that only opens something has a short Open button, not its long label, and the whole row opens it', async () => {
    const tidy = {
      type: 'rows',
      id: 'c-tidy',
      title: 'To Tidy Up',
      note: null,
      rows: [{ id: 'uncategorised', icon: 'tag', tone: 'amber', title: 'Uncategorised Observations', detail: '2 observations with no category yet', bad: false, end: { type: 'open', link: { tab: 'observations' }, label: 'Open in Observations' } }],
      ticks: [],
      cta: null,
    }
    current = { status: 200, body: thread({ session: { id: 's1', startedAt: '', stage: 'capture', turns: [turn('t1', 'bot', 'There is 1 small thing to tidy up.', [tidy])] } }) }
    gateway()
    await openChat()
    const card = within(await screen.findByTestId('card-c-tidy'))

    // The long label is the button's spoken name, not text that squeezes the title.
    expect(card.queryByText('Open in Observations')).toBeNull()
    expect(card.getByText('Open')).toBeTruthy()
    expect(card.getByRole('button', { name: 'Open in Observations' })).toBeTruthy()
    // Pressing the title (anywhere on the row) opens it, as on the web.
    await fireEvent.press(card.getByText('Uncategorised Observations'))

    await waitFor(() => expect(screen).toHavePathname(`/assessment/${REF}`))
    expect(await screen.findByRole('tab', { name: 'Observations', selected: true })).toBeTruthy()
  })
})

describe('replying (C)', () => {
  it('C11: shows the replies under the newest turn, the primary one first in weight', async () => {
    gateway()
    await openChat()

    expect(await screen.findByRole('button', { name: 'Skip for now' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'What else?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Another visit' })).toBeTruthy()
    expect(screen.getByTestId('reply-what-else').props.accessibilityLabel).toBe('What else?')
  })

  it('C12: sends the reply with the last turn it saw and shows the conversation that comes back', async () => {
    const fetchMock = gateway()
    await openChat()
    await fireEvent.press(await screen.findByRole('button', { name: 'Skip for now' }))

    expect(await screen.findByText('All sorted.')).toBeTruthy()
    expect(bodies(fetchMock, REPLY)).toEqual([{ replyId: 'skip', lastTurnId: 't3' }])
    expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull()
  })

  it('C13: Another visit asks for the day with the native date picker, then Confirm sends it', async () => {
    const fetchMock = gateway()
    await openChat()
    await fireEvent.press(await screen.findByRole('button', { name: 'Another visit' }))

    // Nothing is sent until the day is confirmed.
    expect(calls(fetchMock, REPLY)).toBe(0)
    expect(screen.getByRole('button', { name: 'Confirm' }).props.accessibilityState?.disabled).toBe(true)
    await fireEvent.press(screen.getByRole('button', { name: 'Day of your next visit' }))
    await fireEvent(await screen.findByTestId('date-picker'), 'valueChange', {}, new Date(2026, 10, 25, 12))
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(bodies(fetchMock, REPLY)).toEqual([{ replyId: 'another-visit', date: '2026-11-25', lastTurnId: 't3' }]))
  })

  it('C13: Cancel sends nothing and brings the replies back', async () => {
    const fetchMock = gateway()
    await openChat()
    await fireEvent.press(await screen.findByRole('button', { name: 'Another visit' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))

    expect(calls(fetchMock, REPLY)).toBe(0)
    expect(await screen.findByRole('button', { name: 'Skip for now' })).toBeTruthy()
  })

  it('C14: a reply no longer asked reads the conversation again, quietly', async () => {
    posted = { status: 409, body: { error: 'That question has been answered.', code: 'reply-not-asked' } }
    let reads = 0
    current = () => ({ status: 200, body: reads++ ? thread({ session: { id: 's1', startedAt: '', stage: 'capture', turns: [turn('t9', 'bot', 'Moved on already.')] }, replies: [] }) : thread() })
    const fetchMock = gateway()
    await openChat()
    await fireEvent.press(await screen.findByRole('button', { name: 'Skip for now' }))

    expect(await screen.findByText('Moved on already.')).toBeTruthy()
    expect(screen.queryByText('That question has been answered.')).toBeNull()
    expect(calls(fetchMock, THREAD)).toBe(2)
  })

  it("C14: any other refusal shows the gateway's words above the buttons, which stay", async () => {
    posted = { status: 400, body: { error: 'The reply could not be read.' } }
    gateway()
    await openChat()
    await fireEvent.press(await screen.findByRole('button', { name: 'Skip for now' }))

    expect(await screen.findByText('The reply could not be read.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeTruthy()
  })

  // Changed 21 Nov (Miya's screenshot): the gateway's POST /replies refuses "add-observations" (not in its replySchema), and
  // the web opens a reply's link without sending it (client MarshBotOverview.tsx: `if (r.link) return openLink(r.link)`).
  it('C15: a reply with a link only opens it and sends nothing', async () => {
    current = { status: 200, body: thread({ replies: [reply('add-observations', 'Add observations', { link: { tab: 'observations' } })] }) }
    const fetchMock = gateway()
    await openChat()
    await fireEvent.press(await screen.findByRole('button', { name: 'Add observations' }))

    await waitFor(() => expect(screen).toHavePathname(`/assessment/${REF}`))
    expect(await screen.findByRole('tab', { name: 'Observations', selected: true })).toBeTruthy()
    expect(bodies(fetchMock, REPLY)).toHaveLength(0)
  })

  // As the web's ReplyButton and Actions: a choice has its icon at the left, a choice that only opens a tab has an arrow at
  // the right, and the first hint the gateway sends is one line under the buttons (it says what a stage move does).
  it('C17: a reply shows its icon, a link reply shows an arrow, and an unknown icon draws none', async () => {
    current = {
      status: 200,
      body: thread({ replies: [reply('another-visit', 'Another visit', { picksDate: true, icon: 'calendar' }), reply('add-observations', 'Add observations', { link: { tab: 'observations' }, icon: 'plus' }), reply('skip', 'Skip for now', { icon: 'not-a-real-icon' })] }),
    }
    gateway()
    await openChat()
    await screen.findByRole('button', { name: 'Another visit' })

    expect(screen.getByTestId('reply-icon-another-visit')).toBeTruthy()
    expect(screen.queryByTestId('reply-arrow-another-visit')).toBeNull()
    expect(screen.getByTestId('reply-icon-add-observations')).toBeTruthy()
    expect(screen.getByTestId('reply-arrow-add-observations')).toBeTruthy()
    expect(screen.queryByTestId('reply-icon-skip')).toBeNull()
  })

  it('C18: the first hint sits under the buttons, and nothing shows when there is none', async () => {
    const hint = "Clicking “That's everything” will move the assessment's status forward to Ready for generation."
    current = { status: 200, body: thread({ replies: [reply('another-visit', 'Another visit', { picksDate: true }), reply('nothing-more', "That's everything", { primary: true, hint })] }) }
    gateway()
    await openChat()

    expect(await screen.findByText(hint)).toBeTruthy()
    expect(screen.getAllByText(hint)).toHaveLength(1)
  })

  it('C18b: with no hint no hint line is drawn', async () => {
    gateway()
    await openChat()
    await screen.findByRole('button', { name: 'Skip for now' })

    expect(screen.queryByTestId('reply-hint')).toBeNull()
  })

  it('C16: with no signal the saved copy shows, the replies are greyed and say to connect', async () => {
    const fetchMock = gateway({ [SUMMARY]: { status: 200, body: SUMMARY_BODY } })
    await renderRouter(routes)
    await fireEvent.press(await screen.findByText(REF))
    await fireEvent.press(await screen.findByRole('button', { name: /^Overview/ }))
    await screen.findByText('Good morning, Ava!')

    // Back to Home, the signal drops, and the chat opens again from the saved copy.
    await testRouter.back()
    await testRouter.back()
    online = false
    await fireEvent.press(await screen.findByText(REF))
    await fireEvent.press(await screen.findByRole('button', { name: /^Overview/ }))

    expect(await screen.findByText('Good morning, Ava!')).toBeTruthy()
    expect(await screen.findByText('Connect to reply.')).toBeTruthy()
    const skip = screen.getByRole('button', { name: 'Skip for now' })
    expect(skip.props.accessibilityState?.disabled).toBe(true)
    await fireEvent.press(skip)
    expect(calls(fetchMock, REPLY)).toBe(0)
  })
})

describe('honest states (D)', () => {
  it("D17: someone else's assessment says so", async () => {
    current = { status: 403, body: { error: 'This is not your assessment.' } }
    gateway()
    await openChat()

    expect(await screen.findByText('This is not your assessment.')).toBeTruthy()
  })

  it("D17: an admin's view has no reply buttons", async () => {
    current = { status: 200, body: thread({ viewer: 'admin' }) }
    gateway()
    await openChat()

    expect(await screen.findByText('Good morning, Ava!')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull()
  })

  it('D18: an archived assessment says so', async () => {
    current = { status: 409, body: { error: 'RPT is archived.' } }
    gateway()
    await openChat()

    expect(await screen.findByText('This assessment is archived.')).toBeTruthy()
  })

  it('D19: with no signal and no copy it says so', async () => {
    online = false
    gateway()
    await openChat()

    expect(await screen.findByText(/Can't reach MarshBot/)).toBeTruthy()
  })

  it('D20: sends one read on opening and never the activity beacon', async () => {
    const fetchMock = gateway()
    await openChat()
    await screen.findByText('Good morning, Ava!')

    expect(calls(fetchMock, THREAD)).toBe(1)
    expect(calls(fetchMock, `POST /api/assessments/${REF}/assistant/activity`)).toBe(0)
  })
})
