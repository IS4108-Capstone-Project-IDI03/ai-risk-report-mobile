// MB-15: My preferences ("memory") for the chatbot, opened from the chats drawer. The gateway is a
// small stateful fake of /api/chat/memory; no test reaches a model.
import * as FileSystem from 'expo-file-system'
import { Alert } from 'react-native'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { mockGateway, openTab, pointAtTestGateway, routes, signedIn, type Reply } from '../test/gateway'

pointAtTestGateway()

const files = (FileSystem as unknown as { __files: Map<string, string> }).__files

let memory: { enabled: boolean; facts: { id: string; text: string; createdAt: string }[]; maxFacts: number; maxChars: number }
const calls: string[] = []
const fact = (id: string, text: string) => ({ id, text, createdAt: '2026-10-20T03:00:00.000Z' })

function gateway(overrides: Record<string, Reply | ((init?: RequestInit) => Reply)> = {}) {
  let next = 10
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [] },
    'GET /api/knowledge-documents/ingested': { status: 200, body: [] },
    'GET /api/chat/conversations': { status: 200, body: { threads: [] } },
    'GET /api/chat/memory': () => ({ status: 200, body: memory }),
    'PATCH /api/chat/memory': (init) => {
      calls.push(`PATCH memory ${init?.body}`)
      memory = { ...memory, enabled: JSON.parse(String(init?.body)).enabled }
      return { status: 200, body: memory }
    },
    'POST /api/chat/memory/facts': (init) => {
      const { text } = JSON.parse(String(init?.body))
      calls.push(`POST fact ${text}`)
      const added = fact(`f${next++}`, text)
      memory = { ...memory, facts: [...memory.facts, added] }
      return { status: 201, body: added }
    },
    'PATCH /api/chat/memory/facts/f1': (init) => {
      const { text } = JSON.parse(String(init?.body))
      calls.push(`PATCH fact f1 ${text}`)
      memory = { ...memory, facts: memory.facts.map((f) => (f.id === 'f1' ? { ...f, text } : f)) }
      return { status: 200, body: memory.facts.find((f) => f.id === 'f1') }
    },
    'DELETE /api/chat/memory/facts/f1': () => {
      calls.push('DELETE fact f1')
      memory = { ...memory, facts: memory.facts.filter((f) => f.id !== 'f1') }
      return { status: 204, body: null }
    },
    ...overrides,
  })
}

// Chatbot tab, the chats drawer, then My preferences.
async function openPreferences() {
  await renderRouter(routes)
  await openTab('Chatbot')
  await fireEvent.press(await screen.findByRole('button', { name: 'Open chats' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'My preferences' }))
  return within(await screen.findByTestId('preferences'))
}

beforeEach(() => {
  files.clear()
  jest.restoreAllMocks()
  calls.length = 0
  memory = { enabled: true, facts: [fact('f1', 'I mostly survey Singapore offices'), fact('f2', 'I prefer short answers')], maxFacts: 20, maxChars: 200 }
})

describe('My preferences', () => {
  it('shows the switch, the notes, the add box and the facts with their dates (AC1, AC2)', async () => {
    gateway()
    const prefs = await openPreferences()

    expect(prefs.getByRole('switch', { name: 'Use my preferences in chats' }).props.value).toBe(true)
    expect(prefs.getByText('Your list is kept when this is off.')).toBeTruthy()
    expect(prefs.getByText(/Do not type client names or site details/)).toBeTruthy()
    expect(prefs.getByLabelText('Add a fact')).toBeTruthy()
    expect(prefs.getByText('0 of 200 characters')).toBeTruthy()
    expect(prefs.getByText('2 of 20 facts')).toBeTruthy()
    expect(prefs.getByText('I mostly survey Singapore offices')).toBeTruthy()
    expect(prefs.getAllByText('Added 20 Oct 2026')).toHaveLength(2)
  })

  it('says there are no facts yet, with an example (AC2)', async () => {
    memory = { ...memory, facts: [] }
    gateway()
    const prefs = await openPreferences()

    expect(prefs.getByText('No facts yet')).toBeTruthy()
    expect(prefs.getByText('For example: I mostly survey Singapore offices.')).toBeTruthy()
  })

  it('adds a fact to the end, counts its characters, and clears the box (AC3)', async () => {
    gateway()
    const prefs = await openPreferences()

    await fireEvent.changeText(prefs.getByLabelText('Add a fact'), 'I work on cold stores')
    expect(prefs.getByText('21 of 200 characters')).toBeTruthy()
    await fireEvent.press(prefs.getByRole('button', { name: 'Add fact' }))

    expect(await prefs.findByText('I work on cold stores')).toBeTruthy()
    expect(calls).toContain('POST fact I work on cold stores')
    expect(prefs.getByLabelText('Add a fact').props.value).toBe('')
    expect(prefs.getByText('3 of 20 facts')).toBeTruthy()
  })

  it("shows the gateway's words under the box when an add is refused (AC3)", async () => {
    gateway({ 'POST /api/chat/memory/facts': { status: 400, body: { error: 'A fact needs 1 to 200 characters.' } } })
    const prefs = await openPreferences()

    await fireEvent.changeText(prefs.getByLabelText('Add a fact'), 'x')
    await fireEvent.press(prefs.getByRole('button', { name: 'Add fact' }))

    expect(await prefs.findByText('A fact needs 1 to 200 characters.')).toBeTruthy()
    // What was typed stays, so it can be fixed.
    expect(prefs.getByLabelText('Add a fact').props.value).toBe('x')
  })

  it('replaces the box at 20 facts (AC4)', async () => {
    memory = { ...memory, facts: Array.from({ length: 20 }, (_, i) => fact(`g${i}`, `Fact ${i}`)) }
    gateway()
    const prefs = await openPreferences()

    expect(prefs.getByText('You have 20 facts. Delete one to add another.')).toBeTruthy()
    expect(prefs.queryByLabelText('Add a fact')).toBeNull()
  })

  it('turns a fact into an edit box when tapped, and Save changes it (AC5)', async () => {
    gateway()
    const prefs = await openPreferences()

    await fireEvent.press(prefs.getByRole('button', { name: 'Edit fact: I mostly survey Singapore offices' }))
    await fireEvent.changeText(prefs.getByLabelText('Edit fact'), 'I mostly survey Malaysian offices')
    await fireEvent.press(prefs.getByRole('button', { name: 'Save fact' }))

    expect(await prefs.findByText('I mostly survey Malaysian offices')).toBeTruthy()
    expect(calls).toContain('PATCH fact f1 I mostly survey Malaysian offices')
    expect(prefs.queryByLabelText('Edit fact')).toBeNull()
  })

  it('leaves a fact as it was on Cancel (AC5)', async () => {
    gateway()
    const prefs = await openPreferences()
    await fireEvent.press(prefs.getByRole('button', { name: 'Edit fact: I mostly survey Singapore offices' }))
    await fireEvent.changeText(prefs.getByLabelText('Edit fact'), 'something else')

    await fireEvent.press(prefs.getByRole('button', { name: 'Cancel edit' }))

    expect(prefs.getByText('I mostly survey Singapore offices')).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it('deletes a fact only after I confirm (AC6)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    gateway()
    const prefs = await openPreferences()
    await fireEvent.press(prefs.getByRole('button', { name: 'Edit fact: I mostly survey Singapore offices' }))

    await fireEvent.press(prefs.getByRole('button', { name: 'Delete fact' }))
    expect(calls).toHaveLength(0)
    await act(async () => {
      ;(alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Delete')!.onPress!()
    })

    await waitFor(() => expect(prefs.queryByText('I mostly survey Singapore offices')).toBeNull())
    expect(calls).toContain('DELETE fact f1')
    expect(prefs.getByText('1 of 20 facts')).toBeTruthy()
  })

  it('turns memory off and on, keeping the facts, and hides the add box while off (AC7)', async () => {
    gateway()
    const prefs = await openPreferences()

    await fireEvent(prefs.getByRole('switch', { name: 'Use my preferences in chats' }), 'valueChange', false)

    await waitFor(() => expect(calls).toContain('PATCH memory {"enabled":false}'))
    expect(prefs.queryByLabelText('Add a fact')).toBeNull()
    expect(prefs.getByText('I mostly survey Singapore offices')).toBeTruthy()
    await fireEvent(prefs.getByRole('switch', { name: 'Use my preferences in chats' }), 'valueChange', true)
    expect(await prefs.findByLabelText('Add a fact')).toBeTruthy()
  })

  it('says why it could not load, and tries again (AC8)', async () => {
    let up = false
    gateway({ 'GET /api/chat/memory': () => (up ? { status: 200, body: memory } : { status: 500, body: { error: 'Something went wrong on our side.' } }) })
    const prefs = await openPreferences()

    expect(await prefs.findByText(/Something went wrong/)).toBeTruthy()
    up = true
    await fireEvent.press(prefs.getByRole('button', { name: 'Try again' }))

    // The error view and the list are different elements, so ask the screen again.
    expect(await within(await screen.findByTestId('preferences')).findByText('I mostly survey Singapore offices')).toBeTruthy()
  })

  it('shows the last copy read-only with no signal (AC9)', async () => {
    gateway()
    await openPreferences()
    await screen.unmount()

    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch
    await renderRouter(routes)
    await openTab('Chatbot')
    await fireEvent.press(await screen.findByRole('button', { name: 'Open chats' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'My preferences' }))
    const prefs = within(await screen.findByTestId('preferences'))

    expect(await prefs.findByText('I mostly survey Singapore offices')).toBeTruthy()
    expect(prefs.getByText('Connect to change your preferences.')).toBeTruthy()
    expect(prefs.queryByLabelText('Add a fact')).toBeNull()
  })
})
