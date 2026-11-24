// MB-05: the pre-survey checklist. Renders the real routes with the gateway mocked.
// Each test opens a workspace from Home and switches to Checklist.
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { Alert, AppState, type AppStateStatus } from 'react-native'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import {
  assessment,
  location,
  mockGateway,
  pointAtTestGateway,
  routes,
  signedIn,
  type Reply,
} from '../test/gateway'

pointAtTestGateway()

const REF = 'RPT-2026-0411'

// One item as the gateway sends it (ChecklistDto in the web repo's checklist.service.ts).
const item = (id: string, area: string, text: string, extra: object = {}) => ({
  id,
  area,
  subsection: null,
  origin: 'template',
  hazard: null,
  text,
  fields: [],
  COPE_dimension: ['Protection'],
  citations: [],
  flags: [],
  check: null,
  ...extra,
})

const answered = (result: string, extra: object = {}) => ({ result, at: '2026-11-08T03:00:00.000Z', by: 'Alex Rowe', observation: null, ...extra })

// The body of GET /api/assessments/:reference/checklist.
function body(overrides: { checklist?: object | null; scope?: object; standards?: object[] } = {}) {
  const checklist =
    overrides.checklist === null
      ? null
      : {
          id: 'c1',
          facilityType: 'warehouse',
          jurisdiction: 'SG',
          standards: [],
          areas: [
            { id: '7', title: 'Construction' },
            { id: '8', title: 'Occupancy' },
          ],
          hazards: [{ id: 'h1', name: 'Lithium batteries', standards: [], inScope: [] }],
          sources: {},
          items: [
            item('i1', 'hazards', 'Battery charging area is separated', { hazard: 'Lithium batteries', origin: 'hazard' }),
            item('i2', '7', 'Roof covering is fire rated'),
            item('i3', '7', 'External walls are non-combustible', { check: answered('confirmed') }),
            item('i4', '7', 'Floor loading signs are posted'),
            item('i5', '8', 'Storage heights are marked'),
          ],
          provenance: { generated_at: '2026-11-07T02:00:00.000Z' },
          ...overrides.checklist,
        }
  return {
    scope: { facilityType: 'warehouse', jurisdiction: 'SG', ...overrides.scope },
    standards: overrides.standards ?? [],
    checklist,
  }
}

function gateway(checklistBody: object, overrides: Record<string, Reply | ((init?: RequestInit, url?: string) => Reply)> = {}) {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Staircase', 'Block B', 'Level 2')] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    [`GET /api/assessments/${REF}/checklist`]: () => ({ status: 200, body: checklistBody }),
    ...overrides,
  })
}

// Node's FormData turns React Native's { uri, name, type } files into text, so the tests
// record what is appended instead.
class RecordingFormData {
  parts: [string, unknown][] = []
  append(key: string, value: unknown) {
    this.parts.push([key, value])
  }
}
const realFormData = globalThis.FormData
beforeEach(() => {
  jest.restoreAllMocks()
  globalThis.FormData = RecordingFormData as unknown as typeof FormData
})
afterAll(() => {
  globalThis.FormData = realFormData
})

// Opens the workspace; `where` first chooses the location, which Confirm and Differs
// need (an observation is filed at one).
async function openWorkspace({ where = false } = {}) {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  if (where) {
    await fireEvent.press(await screen.findByRole('button', { name: /Choose location|Location/ }))
    await fireEvent.press(await screen.findByRole('button', { name: /Staircase/ }))
    await screen.findByTestId('workspace')
  }
}

// The workspace, then the Checklist side of its switch.
async function openChecklist(options: { where?: boolean } = {}) {
  await openWorkspace(options)
  await fireEvent.press(await screen.findByRole('tab', { name: 'Checklist' }))
  return within(await screen.findByTestId('checklist'))
}

describe('the switch in the workspace', () => {
  it('reads Observations | Checklist, with the checklist progress on it (AC1)', async () => {
    gateway(body())
    await openWorkspace()

    const tab = await screen.findByRole('tab', { name: 'Checklist' })

    // body(): five items, one of them checked.
    expect(await within(tab).findByText('1/5')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Observations' }).props.accessibilityState.selected).toBe(true)
  })

  it('has no progress on it before a checklist exists (AC1)', async () => {
    gateway(body({ checklist: null }))
    await openWorkspace()

    const tab = await screen.findByRole('tab', { name: 'Checklist' })

    expect(within(tab).queryByText(/\d+\/\d+/)).toBeNull()
  })

  it('keeps New observation and the location bar while the checklist is shown (AC1)', async () => {
    gateway(body())
    await openChecklist()

    expect(screen.getByRole('button', { name: 'New observation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose location' })).toBeTruthy()
  })

  it('goes back to the observations when Observations is chosen (AC1)', async () => {
    gateway(body())
    await openChecklist()

    await fireEvent.press(screen.getByRole('tab', { name: 'Observations' }))

    expect(await screen.findByTestId('workspace')).toBeTruthy()
    expect(screen.queryByTestId('checklist')).toBeNull()
  })
})

// The workspace pane is measured when it is laid out, which Jest never does, so a test
// says how wide it is.
const widen = async (width: number) =>
  fireEvent(await screen.findByTestId('workspace-screen'), 'layout', { nativeEvent: { layout: { width, height: 800, x: 0, y: 0 } } })

describe('side by side on a wide iPad', () => {
  it('shows the observations and the checklist together, with no switch, when the pane is wide (AC20)', async () => {
    gateway(body())
    await openWorkspace()

    await widen(900)

    expect(await screen.findByTestId('checklist')).toBeTruthy()
    expect(screen.getByTestId('workspace')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Checklist' })).toBeNull()
    expect(screen.getByRole('button', { name: 'New observation' })).toBeTruthy()
    expect(await within(screen.getByTestId('checklist')).findByText('Roof covering is fire rated')).toBeTruthy()
  })

  it('keeps the switch when the pane is narrow (AC20)', async () => {
    gateway(body())
    await openWorkspace()

    await widen(700)

    expect(await screen.findByRole('tab', { name: 'Checklist' })).toBeTruthy()
    expect(screen.queryByTestId('checklist')).toBeNull()
  })

  it('collapses the checklist to a slim bar with its progress, and opens it again (AC21)', async () => {
    gateway(body())
    await openWorkspace()
    await widen(900)
    await within(await screen.findByTestId('checklist')).findByText('Roof covering is fire rated')

    await fireEvent.press(screen.getByRole('button', { name: 'Collapse checklist' }))

    expect(screen.queryByTestId('checklist')).toBeNull()
    expect(within(screen.getByRole('button', { name: 'Expand checklist' })).getByText('1/5')).toBeTruthy()
    expect(screen.getByTestId('workspace')).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Expand checklist' }))

    expect(await screen.findByTestId('checklist')).toBeTruthy()
  })
})

describe('read the checklist', () => {
  it('opens from the workspace, with the priority risks first and then each report area (AC1, AC2)', async () => {
    gateway(body())

    const list = await openChecklist()

    expect(await list.findByText('Battery charging area is separated')).toBeTruthy()
    const text = list.getAllByTestId('checklist-heading').map((h) => h.props.children.join?.('') ?? h.props.children)
    expect(text).toEqual([expect.stringContaining('Priority risks'), expect.stringContaining('Construction'), expect.stringContaining('Occupancy')])
  })

  it('says how many items of an area are checked, and lists the unchecked ones first (AC2)', async () => {
    gateway(body())
    const list = await openChecklist()
    await list.findByText('Roof covering is fire rated')

    // Construction: 1 of 3 checked. The checked item sorts below the two unchecked ones.
    expect(list.getByText('Construction · 1 of 3 checked')).toBeTruthy()
    const order = list.getAllByTestId('checklist-item').map((row) => within(row).getAllByText(/./)[0].props.children)
    const construction = order.filter((t: string) => /Roof|walls|Floor/.test(t))
    expect(construction).toEqual(['Roof covering is fire rated', 'Floor loading signs are posted', 'External walls are non-combustible'])
  })

  it('shows what each item stands at, with an icon and a word (AC2)', async () => {
    gateway(body())
    const list = await openChecklist()

    expect(await list.findByText('Confirmed')).toBeTruthy()
  })

  it('says when no checklist has been generated yet (AC3)', async () => {
    gateway(body({ checklist: null }))
    const list = await openChecklist()

    expect(await list.findByText('No checklist yet.')).toBeTruthy()
  })

  it('says it is out of date when the site changed since it was generated (AC4)', async () => {
    gateway(body({ scope: { facilityType: 'cold store' } }))
    const list = await openChecklist()

    expect(await list.findByText(/out of date/i)).toBeTruthy()
  })

  it('has no out of date notice when the site is unchanged (AC4)', async () => {
    gateway(body())
    const list = await openChecklist()
    await list.findByText('Roof covering is fire rated')

    expect(list.queryByText(/out of date/i)).toBeNull()
  })
})

// An item with one citation, and the standard and passage it points to.
const cited = (quoteFound = true) =>
  body({
    standards: [],
    checklist: {
      standards: [{ id: 'd1', title: 'NFPA 13', standardNumber: '13', edition: '2022', sourceType: 'standard' }],
      sources: { 'C:1': { text: 'Sprinklers shall be installed throughout.', doc_id: 'd1', page_start: 42, page_end: 42 } },
      items: [
        item('i2', '7', 'Sprinkler coverage is complete', {
          origin: 'standard',
          citations: [{ ref: 'C:1', quote: 'Sprinklers shall be installed throughout.', quoteFound }],
        }),
        item('i3', '7', 'Roof covering is fire rated'),
        item('i4', '7', 'Gas isolation valve is labelled', { origin: 'hazard', flags: ['uncited'] }),
      ],
    },
  })

describe('citations', () => {
  it('opens an item to show its standard, page and quoted words (AC7)', async () => {
    gateway(cited())
    const list = await openChecklist()

    await fireEvent.press(await list.findByText('Sprinkler coverage is complete'))

    expect(await list.findByText('NFPA 13 (2022)')).toBeTruthy()
    expect(list.getByText('Page 42')).toBeTruthy()
    expect(list.getByText(/Sprinklers shall be installed throughout\./)).toBeTruthy()
    expect(list.queryByText('Unverified')).toBeNull()
  })

  it('marks a quote that is not in the passage as unverified (AC7)', async () => {
    gateway(cited(false))
    const list = await openChecklist()

    await fireEvent.press(await list.findByText('Sprinkler coverage is complete'))

    expect(await list.findByText('Unverified')).toBeTruthy()
  })

  it('says a template item comes from the report template, and an uncited one has no standard (AC7)', async () => {
    gateway(cited())
    const list = await openChecklist()

    await fireEvent.press(await list.findByText('Roof covering is fire rated'))
    expect(await list.findByText("From Marsh's report template.")).toBeTruthy()

    await fireEvent.press(list.getByText('Gas isolation valve is labelled'))
    expect(await list.findByText('No standard covers this item.')).toBeTruthy()
  })
})

// The same checklist with item i2 marked (or not), as the gateway answers a mark.
const marked = (mark: string | null) =>
  body({
    checklist: {
      items: [
        item('i2', '7', 'Roof covering is fire rated', { check: mark ? answered(mark) : null }),
        item('i4', '7', 'Floor loading signs are posted'),
      ],
    },
  })

const sentMarks = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.filter(([url, init]) => url.endsWith('/items/i2/mark') && init?.method === 'PUT').map(([, init]) => JSON.parse(String(init.body)))

describe('mark an item', () => {
  it('marks it Not seen, and choosing it again clears the mark (AC8)', async () => {
    let state: string | null = null
    const fetchMock = gateway(marked(null), {
      [`GET /api/assessments/${REF}/checklist`]: () => ({ status: 200, body: marked(state) }),
      [`PUT /api/assessments/${REF}/checklist/items/i2/mark`]: (init) => {
        state = JSON.parse(String(init!.body)).mark
        return { status: 200, body: marked(state) }
      },
    })
    const list = await openChecklist()
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))

    await fireEvent.press(list.getByRole('button', { name: 'Not seen' }))

    expect(within(await list.findByTestId('checklist-status')).getByText('Not seen')).toBeTruthy()
    await fireEvent.press(list.getByRole('button', { name: 'Not seen' }))
    await waitFor(() => expect(list.queryByTestId('checklist-status')).toBeNull())
    expect(sentMarks(fetchMock)).toEqual([{ mark: 'not_seen' }, { mark: null }])
  })

  it('marks it Not applicable (AC8)', async () => {
    const fetchMock = gateway(marked(null), {
      [`PUT /api/assessments/${REF}/checklist/items/i2/mark`]: { status: 200, body: marked('not_applicable') },
    })
    const list = await openChecklist()
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))

    await fireEvent.press(list.getByRole('button', { name: 'Not applicable' }))

    expect(within(await list.findByTestId('checklist-status')).getByText('Not applicable')).toBeTruthy()
    expect(sentMarks(fetchMock)).toEqual([{ mark: 'not_applicable' }])
  })

  it("shows the gateway's words when it refuses the mark, and the item stays as it was (AC14)", async () => {
    gateway(marked(null), {
      [`PUT /api/assessments/${REF}/checklist/items/i2/mark`]: { status: 403, body: { error: 'Only the assigned engineer can change this assessment.' } },
    })
    const list = await openChecklist()
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))

    await fireEvent.press(list.getByRole('button', { name: 'Not seen' }))

    expect(await list.findByText('Only the assigned engineer can change this assessment.')).toBeTruthy()
    expect(list.queryByTestId('checklist-status')).toBeNull()
  })

  it('offers View observation, not the marks, on an item an observation answers (AC12)', async () => {
    gateway(
      body({
        checklist: {
          items: [item('i2', '7', 'Roof covering is fire rated', { check: answered('confirmed', { observation: { id: 'o1', location: 'Block B · Staircase' } }) })],
        },
      }),
    )
    const list = await openChecklist()

    await fireEvent.press(await list.findByText('Roof covering is fire rated'))

    expect(await list.findByRole('button', { name: 'View observation' })).toBeTruthy()
    expect(list.queryByRole('button', { name: 'Not seen' })).toBeNull()
  })
})

// An item to answer: its COPE category is Protection, so the observation gets it.
const answerable = (check: object | null = null) =>
  body({ checklist: { items: [item('i2', '7', 'Roof covering is fire rated', { check }), item('i4', '7', 'Floor loading signs are posted')] } })

const detailsOf = (fetchMock: jest.Mock) => {
  const post = fetchMock.mock.calls.find(([url, init]) => url.endsWith(`/assessments/${REF}/observations`) && init?.method === 'POST')
  return post && JSON.parse((post[1]!.body as unknown as RecordingFormData).parts.find(([key]) => key === 'details')![1] as string)
}

describe('answer an item', () => {
  it('opens Confirm with what the checklist expects, the note started from it, and needs a severity (AC9)', async () => {
    let answeredNow = false
    const fetchMock = gateway(answerable(), {
      [`GET /api/assessments/${REF}/checklist`]: () => ({
        status: 200,
        body: answerable(answeredNow ? answered('confirmed', { observation: { id: 'o9', location: 'Block B · Staircase' } }) : null),
      }),
      [`POST /api/assessments/${REF}/capture-session`]: { status: 200, body: {} },
      [`POST /api/assessments/${REF}/observations`]: () => {
        answeredNow = true
        return { status: 201, body: {} }
      },
    })
    const list = await openChecklist({ where: true })
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))

    await fireEvent.press(list.getByRole('button', { name: 'Confirm' }))

    const sheet = within(await screen.findByTestId('answer-sheet'))
    expect(sheet.getByText('What the checklist expects')).toBeTruthy()
    expect(sheet.getAllByText('Roof covering is fire rated').length).toBeGreaterThan(0)
    expect(sheet.getByLabelText('What did you see?').props.value).toBe('Roof covering is fire rated')
    // The severity is always chosen, never assumed.
    expect(sheet.getByRole('button', { name: 'Save answer' }).props.accessibilityState.disabled).toBe(true)

    await fireEvent.press(sheet.getByRole('button', { name: 'High' }))
    await fireEvent.press(sheet.getByRole('button', { name: 'Save answer' }))

    await waitFor(() => expect(detailsOf(fetchMock)).toBeTruthy())
    expect(detailsOf(fetchMock)).toMatchObject({
      note: 'Roof covering is fire rated',
      copeDimensions: ['Protection'],
      severity: 'high',
      locationId: 'l1',
      checklistItem: { itemId: 'i2', result: 'confirmed' },
    })
    // The checklist is read again and shows the item answered.
    expect(await within(await screen.findByTestId('checklist')).findByText('Confirmed')).toBeTruthy()
  })

  it('opens Differs with the note empty, and it saves what was seen (AC10)', async () => {
    const fetchMock = gateway(answerable(), {
      [`POST /api/assessments/${REF}/capture-session`]: { status: 200, body: {} },
      [`POST /api/assessments/${REF}/observations`]: { status: 201, body: {} },
    })
    const list = await openChecklist({ where: true })
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))

    await fireEvent.press(list.getByRole('button', { name: 'Differs' }))

    const sheet = within(await screen.findByTestId('answer-sheet'))
    expect(sheet.getByLabelText('What did you see?').props.value).toBe('')
    await fireEvent.changeText(sheet.getByLabelText('What did you see?'), 'Two panels are missing')
    await fireEvent.press(sheet.getByRole('button', { name: 'Moderate' }))
    await fireEvent.press(sheet.getByRole('button', { name: 'Save answer' }))

    await waitFor(() => expect(detailsOf(fetchMock)).toBeTruthy())
    expect(detailsOf(fetchMock)).toMatchObject({ note: 'Two panels are missing', checklistItem: { itemId: 'i2', result: 'differs' } })
  })

  it('adds an optional photo to the observation (AC9)', async () => {
    const picker = ImagePicker as jest.Mocked<typeof ImagePicker>
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse)
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/p.jpg' }] } as never)
    const fetchMock = gateway(answerable(), {
      [`POST /api/assessments/${REF}/capture-session`]: { status: 200, body: {} },
      [`POST /api/assessments/${REF}/observations`]: { status: 201, body: {} },
    })
    const list = await openChecklist({ where: true })
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))
    await fireEvent.press(list.getByRole('button', { name: 'Confirm' }))
    const sheet = within(await screen.findByTestId('answer-sheet'))

    await fireEvent.press(sheet.getByRole('button', { name: 'Add photo from library' }))
    await fireEvent.press(await sheet.findByRole('button', { name: 'High' }))
    await fireEvent.press(sheet.getByRole('button', { name: 'Save answer' }))

    await waitFor(() => expect(detailsOf(fetchMock)).toBeTruthy())
    const post = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/observations') && init?.method === 'POST')!
    expect((post[1]!.body as unknown as RecordingFormData).parts.map(([key]) => key)).toEqual(['details', 'photo'])
  })

  it('asks me to choose where I am first, when no location is chosen (AC11)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    gateway(answerable())
    const list = await openChecklist()
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))

    await fireEvent.press(list.getByRole('button', { name: 'Confirm' }))

    expect(alert).toHaveBeenCalledWith('Where are you?', expect.any(String), expect.any(Array))
    expect(screen.queryByTestId('answer-sheet')).toBeNull()
  })

  it("shows the gateway's words when the save is refused, and keeps what I typed (AC14)", async () => {
    gateway(answerable(), {
      [`POST /api/assessments/${REF}/capture-session`]: { status: 403, body: { error: 'Only the assigned engineer can change this assessment.' } },
    })
    const list = await openChecklist({ where: true })
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))
    await fireEvent.press(list.getByRole('button', { name: 'Differs' }))
    const sheet = within(await screen.findByTestId('answer-sheet'))
    await fireEvent.changeText(sheet.getByLabelText('What did you see?'), 'Two panels are missing')
    await fireEvent.press(sheet.getByRole('button', { name: 'High' }))

    await fireEvent.press(sheet.getByRole('button', { name: 'Save answer' }))

    expect(await sheet.findByText('Only the assigned engineer can change this assessment.')).toBeTruthy()
    expect(sheet.getByLabelText('What did you see?').props.value).toBe('Two panels are missing')
  })
})

// Standards that apply to the site, for the generate box.
const NFPA = { id: 'd1', title: 'NFPA 13', issuingBody: 'NFPA', standardNumber: '13', edition: '2022', sourceType: 'standard' }
const FM = { id: 'd2', title: 'FM DS 8-9', issuingBody: 'FM', standardNumber: '8-9', edition: null, sourceType: 'standard' }

describe('generate', () => {
  it('lists the standards that apply, all selected, and generates from the ones left selected (AC5, AC6)', async () => {
    let generated = false
    const fetchMock = gateway(body({ checklist: null, standards: [NFPA, FM] }), {
      [`GET /api/assessments/${REF}/checklist`]: () => ({ status: 200, body: generated ? body({ standards: [NFPA, FM] }) : body({ checklist: null, standards: [NFPA, FM] }) }),
      [`POST /api/assessments/${REF}/checklist`]: () => {
        generated = true
        return { status: 201, body: body({ standards: [NFPA, FM] }) }
      },
    })
    const list = await openChecklist()
    await fireEvent.press(await list.findByRole('button', { name: 'Generate checklist' }))

    const sheet = within(await screen.findByTestId('generate-sheet'))
    expect(sheet.getByLabelText('NFPA 13 (2022)').props.value).toBe(true)
    expect(sheet.getByLabelText('FM DS 8-9').props.value).toBe(true)

    await fireEvent(sheet.getByLabelText('FM DS 8-9'), 'valueChange', false)
    await fireEvent.press(sheet.getByRole('button', { name: 'Generate' }))

    expect(await within(await screen.findByTestId('checklist')).findByText('Roof covering is fire rated')).toBeTruthy()
    const post = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/checklist') && init?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toEqual({ standardIds: ['d1'] })
    expect(screen.queryByTestId('generate-sheet')).toBeNull()
  })

  it("shows the gateway's words when generating is refused, and the box stays open (AC6)", async () => {
    gateway(body({ checklist: null, standards: [NFPA] }), {
      [`POST /api/assessments/${REF}/checklist`]: { status: 503, body: { error: 'The checklist service is not available. Try again later.' } },
    })
    const list = await openChecklist()
    await fireEvent.press(await list.findByRole('button', { name: 'Generate checklist' }))
    const sheet = within(await screen.findByTestId('generate-sheet'))

    await fireEvent.press(sheet.getByRole('button', { name: 'Generate' }))

    expect(await sheet.findByText('The checklist service is not available. Try again later.')).toBeTruthy()
  })

  it('offers to generate it again when one exists (AC4, AC6)', async () => {
    gateway(body({ scope: { facilityType: 'cold store' }, standards: [NFPA] }))
    const list = await openChecklist()

    expect(await list.findByRole('button', { name: 'Generate again' })).toBeTruthy()
  })
})

const NETWORK = new TypeError('Network request failed')
const files = (FileSystem as unknown as { __files: Map<string, string> }).__files
const queueOnPhone = () => JSON.parse(files.get('file:///document/users/u1/queue.json') ?? '[]') as { kind: string; error?: string; draft?: { checklistItem?: object }; mark?: string | null; itemId?: string }[]

// The app coming to the front is one of the ways the queue uploads.
function comesToFront() {
  let appState: (state: AppStateStatus) => void = () => {}
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appState = handler as typeof appState
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>
  })
  return (state: AppStateStatus) => appState(state)
}

describe('with no signal', () => {
  it('queues a mark, and shows the item as waiting to upload (AC16)', async () => {
    gateway(marked(null), { [`PUT /api/assessments/${REF}/checklist/items/i2/mark`]: NETWORK })
    const list = await openChecklist()
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))

    await fireEvent.press(list.getByRole('button', { name: 'Not seen' }))

    expect(within(await list.findByTestId('checklist-status')).getByText('Not seen · Waiting to upload')).toBeTruthy()
    expect(queueOnPhone()).toMatchObject([{ kind: 'mark', itemId: 'i2', mark: 'not_seen' }])
  })

  it('uploads the waiting mark when the signal returns, and the gateway then answers for the item (AC16)', async () => {
    const front = comesToFront()
    let online = false
    let state: string | null = null
    const fetchMock = gateway(marked(null), {
      [`GET /api/assessments/${REF}/checklist`]: () => ({ status: 200, body: marked(state) }),
      [`PUT /api/assessments/${REF}/checklist/items/i2/mark`]: (init) => {
        if (!online) return NETWORK
        state = JSON.parse(String(init!.body)).mark
        return { status: 200, body: marked(state) }
      },
    })
    const list = await openChecklist()
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))
    await fireEvent.press(list.getByRole('button', { name: 'Not seen' }))
    await list.findByText('Not seen · Waiting to upload')

    online = true
    await act(async () => front('active'))

    expect(await within(await list.findByTestId('checklist-status')).findByText('Not seen')).toBeTruthy()
    expect(sentMarks(fetchMock).length).toBeGreaterThanOrEqual(2)
    expect(queueOnPhone()).toEqual([])
  })

  it('queues Confirm as an observation linked to the item, shown as waiting (AC17)', async () => {
    gateway(answerable(), { [`POST /api/assessments/${REF}/capture-session`]: NETWORK })
    const list = await openChecklist({ where: true })
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))
    await fireEvent.press(list.getByRole('button', { name: 'Confirm' }))
    const sheet = within(await screen.findByTestId('answer-sheet'))
    await fireEvent.press(sheet.getByRole('button', { name: 'High' }))

    await fireEvent.press(sheet.getByRole('button', { name: 'Save answer' }))

    expect(within(await within(await screen.findByTestId('checklist')).findByTestId('checklist-status')).getByText('Confirmed · Waiting to upload')).toBeTruthy()
    expect(queueOnPhone()).toMatchObject([{ kind: 'observation', draft: { checklistItem: { itemId: 'i2', result: 'confirmed' } } }])
  })

  it("says why a waiting mark was refused, and Discard removes it (AC18)", async () => {
    const front = comesToFront()
    let online = false
    gateway(marked(null), {
      [`PUT /api/assessments/${REF}/checklist/items/i2/mark`]: () =>
        online ? { status: 409, body: { error: 'An observation checks this item. Delete that observation in Observations to mark the item instead.' } } : NETWORK,
    })
    const list = await openChecklist()
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))
    await fireEvent.press(list.getByRole('button', { name: 'Not seen' }))
    await list.findByText('Not seen · Waiting to upload')

    online = true
    await act(async () => front('active'))

    expect(await list.findByText(/Couldn't upload: An observation checks this item/)).toBeTruthy()
    // The badge no longer says it is waiting: it never will.
    expect(within(list.getByTestId('checklist-status')).getByText("Couldn't upload")).toBeTruthy()
    await fireEvent.press(list.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(queueOnPhone()).toEqual([]))
    expect(list.queryByText(/Couldn't upload/)).toBeNull()
  })

  it('opens the last copy, and greys out Generate with a reason (AC15)', async () => {
    gateway(body({ standards: [NFPA] }))
    const first = await openChecklist()
    await first.findByText('Roof covering is fire rated')
    // The signal goes, and the app is closed and opened again.
    globalThis.fetch = jest.fn(async () => {
      throw NETWORK
    }) as unknown as typeof fetch
    await screen.unmount()

    const list = await openChecklist()

    expect(await list.findByText('Roof covering is fire rated')).toBeTruthy()
    expect(await list.findByText("You're offline. Showing what was saved on this device.")).toBeTruthy()
    expect(list.getByText('Connect to generate.')).toBeTruthy()
    expect(list.getByRole('button', { name: 'Generate again' }).props.accessibilityState.disabled).toBe(true)
  })

  it('offers to save a refused answer without its checklist link, keeping its note and photo (AC18)', async () => {
    const front = comesToFront()
    let online = false
    const fetchMock = gateway(answerable(), {
      [`POST /api/assessments/${REF}/capture-session`]: () => (online ? { status: 200, body: {} } : NETWORK),
      [`POST /api/assessments/${REF}/observations`]: (init) => {
        const details = JSON.parse(((init!.body as unknown as RecordingFormData).parts.find(([key]) => key === 'details')![1]) as string)
        return details.checklistItem
          ? { status: 409, body: { error: 'That checklist item is not on the latest checklist. Remove the link to the checklist item to save the observation on its own.' } }
          : { status: 201, body: {} }
      },
    })
    const list = await openChecklist({ where: true })
    await fireEvent.press(await list.findByText('Roof covering is fire rated'))
    await fireEvent.press(list.getByRole('button', { name: 'Confirm' }))
    const sheet = within(await screen.findByTestId('answer-sheet'))
    await fireEvent.press(sheet.getByRole('button', { name: 'High' }))
    await fireEvent.press(sheet.getByRole('button', { name: 'Save answer' }))
    await within(await screen.findByTestId('checklist')).findByText('Confirmed · Waiting to upload')
    online = true
    await act(async () => front('active'))
    await list.findByText(/Couldn't upload: That checklist item is not on the latest checklist/)

    await fireEvent.press(list.getByRole('button', { name: 'Save without the checklist link' }))

    await waitFor(() => expect(queueOnPhone()).toEqual([]))
    const saved = fetchMock.mock.calls.filter(([url, init]) => url.endsWith('/observations') && init?.method === 'POST')
    const last = JSON.parse(((saved[saved.length - 1][1]!.body as unknown as RecordingFormData).parts.find(([key]) => key === 'details')![1]) as string)
    expect(last.checklistItem).toBeUndefined()
    expect(last.note).toBe('Roof covering is fire rated')
  })
})

describe('shown right', () => {
  it('lists an item whose area is not in the checklist under Other, rather than dropping it (AC2)', async () => {
    gateway(body({ checklist: { items: [item('i2', '7', 'Roof covering is fire rated'), item('i9', '99', 'An item in an area nobody listed')] } }))
    const list = await openChecklist()

    expect(await list.findByText('An item in an area nobody listed')).toBeTruthy()
    expect(list.getByText('Other · 0 of 1 checked')).toBeTruthy()
  })

  it('lets me try again when the checklist could not be read the first time', async () => {
    let calls = 0
    gateway(body(), {
      [`GET /api/assessments/${REF}/checklist`]: () => (++calls === 1 ? { status: 500, body: { error: 'Something went wrong.' } } : { status: 200, body: body() }),
    })
    const list = await openChecklist()
    expect(await list.findByText('Something went wrong.')).toBeTruthy()

    await fireEvent.press(list.getByRole('button', { name: 'Try again' }))

    expect(await list.findByText('Roof covering is fire rated')).toBeTruthy()
  })

  it('keeps a generated checklist for offline reading, not the one from before (AC15)', async () => {
    let generated = false
    gateway(body({ checklist: null, standards: [NFPA] }), {
      [`GET /api/assessments/${REF}/checklist`]: () => ({ status: 200, body: body({ checklist: null, standards: [NFPA] }) }),
      [`POST /api/assessments/${REF}/checklist`]: () => {
        generated = true
        return { status: 201, body: body({ standards: [NFPA] }) }
      },
    })
    const first = await openChecklist()
    await fireEvent.press(await first.findByRole('button', { name: 'Generate checklist' }))
    await fireEvent.press(await within(await screen.findByTestId('generate-sheet')).findByRole('button', { name: 'Generate' }))
    await first.findByText('Roof covering is fire rated')
    expect(generated).toBe(true)
    // The signal goes before another load, and the app is closed and opened again.
    globalThis.fetch = jest.fn(async () => {
      throw NETWORK
    }) as unknown as typeof fetch
    await screen.unmount()

    const list = await openChecklist()

    expect(await list.findByText('Roof covering is fire rated')).toBeTruthy()
    expect(list.queryByText('No checklist yet.')).toBeNull()
  })
})
