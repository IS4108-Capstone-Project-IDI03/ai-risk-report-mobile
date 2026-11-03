// MB-06: ask the knowledge base. Drives the Chatbot tab against a mocked
// gateway whose answers stream in pieces, so tests can look mid-answer. No
// test reaches a model or a paid service.
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library'
import {
  chunkedStream,
  mockGateway,
  openTab,
  pointAtTestGateway,
  routes,
  signedIn,
  sse,
  type Reply,
} from '../test/gateway'

pointAtTestGateway()

// An answer as the RAG service writes it (answer_components.txt): two statements
// in a paragraph, the second citing a new quote then the first one again, and a
// follow-up. The Meta line comes separately, as the server appends it last.
const PROGRAM =
  'root = Answer([p1, f1], meta)\n' +
  'p1 = Paragraph([s1, s2])\n' +
  's1 = Statement("NFPA 13 requires a density of 0.20 gpm/ft² for Ordinary Hazard Group 2.", [c1])\n' +
  'c1 = Cite("P1", "0.20 gpm/ft²")\n' +
  's2 = Statement("The design area is 1,500 ft².", [c2, c1])\n' +
  'c2 = Cite("P2", "1,500 ft²")\n' +
  'f1 = FollowUp("What about Ordinary Hazard Group 1?")\n'
// P2's edition is withdrawn and its quote wasn't found.
const META =
  'meta = Meta([{label: "P1", passageId: "pa1", documentId: "d1", pageStart: 81, pageEnd: 81, withdrawn: false}, ' +
  '{label: "P2", passageId: "pa2", documentId: "d1", pageStart: 82, pageEnd: 83, withdrawn: true}], ' +
  '[{label: "P2", quote: "1,500 ft²"}])\n'

const search = (query: string, passages: number, declined = false) => [
  sse({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search_knowledge_base' }),
  sse({ type: 'TOOL_CALL_ARGS', toolCallId: 't1', delta: JSON.stringify({ query, filters: {} }) }),
  sse({ type: 'TOOL_CALL_END', toolCallId: 't1' }),
  sse({ type: 'TOOL_CALL_RESULT', toolCallId: 't1', content: JSON.stringify({ filters: {}, passages, declined }) }),
]
const text = (delta: string) => [
  sse({ type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' }),
  sse({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta }),
]
const end = sse({ type: 'TEXT_MESSAGE_END', messageId: 'm1' })

// Each POST /api/chat gets the next stream; `sent` keeps each request body.
function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  const streams: ReturnType<typeof chunkedStream>[] = []
  const sent: { messages: { role: string; content: string }[] }[] = []
  const fetchMock = mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [] },
    'GET /api/knowledge-documents/ingested': {
      status: 200,
      body: [
        {
          id: 'd1',
          title: 'Installation of Sprinkler Systems',
          issuingBody: 'NFPA',
          standardNumber: '13',
          edition: '2022',
          sourceType: 'nfpa_standard',
          withdrawn: null,
        },
      ],
    },
    'POST /api/chat': (init) => {
      sent.push(JSON.parse(String(init?.body)))
      const s = chunkedStream()
      streams.push(s)
      return { status: 200, stream: s.stream }
    },
    'GET /api/chat/passages/pa1': {
      status: 200,
      body: {
        id: 'pa1',
        documentId: 'd1',
        text: 'Ordinary Hazard Group 2: 0.20 gpm/ft² over the hydraulically most demanding 1,500 ft².',
        headings: ['Chapter 19'],
        pageStart: 81,
        pageEnd: 81,
        boxes: [],
      },
    },
    'GET /api/chat/passages/pa2': {
      status: 200,
      body: { id: 'pa2', documentId: 'd1', text: 'Design areas.', headings: [], pageStart: 82, pageEnd: 83, boxes: [] },
    },
    ...overrides,
  })
  // Sends chunks on the latest stream, letting the screen catch up. Waits on
  // promise ticks, not a timer: the test runner's timers are fake.
  const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  }
  const send = async (...chunks: string[]) =>
    act(async () => {
      chunks.forEach((c) => streams[streams.length - 1].send(c))
      await settle()
    })
  const finish = async () =>
    act(async () => {
      streams[streams.length - 1].close()
      await settle()
    })
  return { fetchMock, sent, send, finish }
}

async function openChat() {
  await renderRouter(routes)
  await openTab('Chatbot')
}

async function ask(question: string) {
  await fireEvent.changeText(await screen.findByLabelText('Question'), question)
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }))
}

// Answers fully: search, the program, the Meta line, then the stream closes.
async function answerFully(g: ReturnType<typeof gateway>, program = PROGRAM + META) {
  await g.send(...search('sprinkler density OH2', 5), ...text(program), end)
  await g.finish()
}

const markers = () => screen.getAllByRole('link').map((m) => m.props.accessibilityLabel as string)

it('offers starter questions, and tapping one asks it (AC1)', async () => {
  const g = gateway()
  await openChat()
  await fireEvent.press(await screen.findByRole('button', { name: 'NFPA 25 inspection intervals' }))

  expect(g.sent[0].messages).toEqual([
    { role: 'user', content: 'How often does NFPA 25 require sprinkler systems to be inspected and tested?' },
  ])
  expect(screen.getByText('How often does NFPA 25 require sprinkler systems to be inspected and tested?')).toBeTruthy()
})

it('shows my question, the search, then the answer as it is written (AC2)', async () => {
  const g = gateway()
  await openChat()
  await ask('What density for OH2?')

  expect(screen.getByText('What density for OH2?')).toBeTruthy()
  // As on the web: the dot loader until the search step begins, then the pulsing line.
  expect(screen.getByLabelText('Loading')).toBeTruthy()
  expect(screen.queryByText('Searching the knowledge base…')).toBeNull()
  await g.send(search('sprinkler density OH2', 5)[0])
  expect(screen.queryByLabelText('Loading')).toBeNull()
  expect(screen.getByText('Searching the knowledge base…')).toBeTruthy()
  await g.send(...search('sprinkler density OH2', 5).slice(1))
  // The web's summary, opening to what was searched and found.
  await fireEvent.press(screen.getByRole('button', { name: 'Searched the whole knowledge base' }))
  expect(screen.getByText('• Searched for “sprinkler density OH2”')).toBeTruthy()
  expect(screen.getByText('• Found 5 relevant passages')).toBeTruthy()
  // Half the program: the first statement is part-written.
  await g.send(...text(PROGRAM.slice(0, 120)))
  expect(screen.getAllByText(/NFPA 13 requires a density/).length).toBeGreaterThan(0)
  await g.send(sse({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: PROGRAM.slice(120) + META }), end)
  await g.finish()
  expect(screen.getAllByText(/The design area is 1,500 ft²/).length).toBeGreaterThan(0)
})

it('numbers citations in first-cited order, keeping a repeated quote’s number (AC3)', async () => {
  const g = gateway()
  await openChat()
  await ask('What density for OH2?')
  await answerFully(g)

  expect(markers().map((m) => m.split(':')[0])).toEqual(['Citation 1', 'Citation 2', 'Citation 1'])
})

it('says which sources it drew on and marks unverified citations (AC4)', async () => {
  const g = gateway()
  await openChat()
  await ask('What density for OH2?')
  await g.send(...search('sprinkler density OH2', 5), ...text(PROGRAM))
  // Before the Meta line, citations are still being checked.
  expect(markers().every((m) => m.endsWith('checking'))).toBe(true)
  await g.send(sse({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: META }), end)
  await g.finish()

  expect(screen.getByText('From 1 source')).toBeTruthy()
  expect(markers()[1]).toMatch(/unverified/)
  expect(markers()[0]).not.toMatch(/unverified|checking/)
})

it('opens a citation’s source: document, pages, quote, passage and warnings (AC5)', async () => {
  const g = gateway()
  await openChat()
  await ask('What density for OH2?')
  await answerFully(g)

  await fireEvent.press(screen.getAllByRole('link')[0])
  const sheet = within(await screen.findByTestId('citation-sheet'))
  expect(sheet.getByText('NFPA 13 (2022)')).toBeTruthy()
  expect(sheet.getByText('Page 81')).toBeTruthy()
  expect(sheet.getByText('“0.20 gpm/ft²”')).toBeTruthy()
  expect(await sheet.findByText(/hydraulically most demanding/)).toBeTruthy()
  expect(sheet.queryByText(/withdrawn/)).toBeNull()

  await fireEvent.press(sheet.getByRole('button', { name: 'Close' }))
  await fireEvent.press(screen.getAllByRole('link')[1])
  const second = within(await screen.findByTestId('citation-sheet'))
  expect(second.getByText('Pages 82–83')).toBeTruthy()
  expect(second.getByText('This edition has been withdrawn.')).toBeTruthy()
  expect(second.getByText('These words weren’t found in the passage. Check the source before relying on them.')).toBeTruthy()
})

it('says when nothing relevant was found (AC6)', async () => {
  const g = gateway()
  await openChat()
  await ask('What does BS 9999 say about atria?')
  await g.send(
    ...search('BS 9999 atria', 0, true),
    ...text('root = Answer([s1], meta)\ns1 = Statement("The knowledge base has nothing on atria yet.", [])\nmeta = Meta([], [], true)\n'),
    end,
  )
  await g.finish()

  await fireEvent.press(screen.getByRole('button', { name: 'Searched the whole knowledge base' }))
  expect(screen.getByText('• No passage was relevant enough to answer from')).toBeTruthy()
  expect(screen.getAllByText('The knowledge base has nothing on atria yet.').length).toBeGreaterThan(0)
})

it('asks a follow-up when tapped, sending the conversation so far (AC7, AC8)', async () => {
  const g = gateway()
  await openChat()
  await ask('What density for OH2?')
  await answerFully(g)
  await fireEvent.press(screen.getByRole('button', { name: 'Ask: What about Ordinary Hazard Group 1?' }))

  expect(g.sent[1].messages).toEqual([
    { role: 'user', content: 'What density for OH2?' },
    { role: 'assistant', content: PROGRAM + META },
    { role: 'user', content: 'What about Ordinary Hazard Group 1?' },
  ])
  // Earlier exchanges stay, in order.
  const questions = screen.getAllByTestId('my-message').map((m) => within(m).getByText(/./).props.children)
  expect(questions).toEqual(['What density for OH2?', 'What about Ordinary Hazard Group 1?'])
})

it('stops an answer, keeping what was written (AC9)', async () => {
  const g = gateway()
  await openChat()
  await ask('What density for OH2?')
  await g.send(...search('sprinkler density OH2', 5), ...text(PROGRAM.slice(0, 120)))
  await fireEvent.press(screen.getByRole('button', { name: 'Stop' }))

  expect(await screen.findByText('Stopped')).toBeTruthy()
  expect(screen.getAllByText(/NFPA 13 requires a density/).length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy()
})

it('says when the gateway can’t be reached, with Try again (AC10)', async () => {
  let calls = 0
  const g = gateway({
    'POST /api/chat': () => {
      calls += 1
      if (calls === 1) return new TypeError('Network request failed')
      const s = chunkedStream()
      queueMicrotask(() => {
        s.send(search('sprinkler density OH2', 5).join('') + text(PROGRAM + META).join('') + end)
        s.close()
      })
      return { status: 200, stream: s.stream }
    },
  })
  await openChat()
  await ask('What density for OH2?')

  expect(await screen.findByText("Can't reach the server. Check your connection, then try again.")).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect((await screen.findAllByText(/The design area is 1,500 ft²/)).length).toBeGreaterThan(0)
  expect(g.fetchMock).toHaveBeenCalled()
})

it('shows a comparison table that scrolls sideways (AC11)', async () => {
  const g = gateway()
  await openChat()
  await ask('Compare NFPA 13 and FM densities')
  await g.send(
    ...search('density comparison', 4),
    ...text(
      'root = Answer([t1])\n' +
        't1 = CitedTable(["Hazard", "NFPA 13", "FM"], [[a1, a2, a3]])\n' +
        'a1 = Cell("OH2", [])\na2 = Cell("0.20 gpm/ft²", [c1])\na3 = Cell("0.25 gpm/ft²", [])\n' +
        'c1 = Cite("P1", "0.20 gpm/ft²")\n',
    ),
    end,
  )
  await g.finish()

  const table = within(screen.getByTestId('answer-table'))
  for (const cell of ['Hazard', 'NFPA 13', 'FM', 'OH2', '0.25 gpm/ft²']) expect(table.getByText(cell)).toBeTruthy()
  expect(screen.getByTestId('answer-table').props.horizontal).toBe(true)
})

it('treats a Wi-Fi login page as no connection', async () => {
  gateway({ 'POST /api/chat': { status: 200, html: true } })
  await openChat()
  await ask('What density for OH2?')

  expect(await screen.findByText("Can't reach the server. Check your connection, then try again.")).toBeTruthy()
})

it('marks citations unverified, not checking, once an answer is stopped', async () => {
  const g = gateway()
  await openChat()
  await ask('What density for OH2?')
  await g.send(...search('sprinkler density OH2', 5), ...text(PROGRAM))
  await fireEvent.press(screen.getByRole('button', { name: 'Stop' }))
  await screen.findByText('Stopped')

  expect(markers().every((m) => m.endsWith('unverified'))).toBe(true)
})

it('shows **names** in bold, never with their asterisks, and spells out §', async () => {
  const g = gateway()
  await openChat()
  await ask('What density for OH2?')
  await g.send(
    ...search('sprinkler density OH2', 5),
    ...text('root = Answer([s1])\ns1 = Statement("**NFPA 13** sets it in § 19.3.", [])\n'),
    end,
  )
  await g.finish()

  expect(screen.getByText('NFPA 13').props.className).toContain('font-semibold')
  expect(screen.queryAllByText(/\*\*/)).toHaveLength(0)
  expect(screen.getAllByText(/Section 19\.3/).length).toBeGreaterThan(0)
})

it('starts a new chat, bringing back the starter questions', async () => {
  const g = gateway()
  await openChat()
  await ask('What density for OH2?')
  await answerFully(g)
  await fireEvent.press(screen.getByRole('button', { name: 'New chat' }))

  expect(await screen.findByRole('button', { name: 'NFPA 25 inspection intervals' })).toBeTruthy()
  expect(screen.queryByText('What density for OH2?')).toBeNull()
})
