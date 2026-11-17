// MB-16 part C (AC11, AC12): what a walk has taken but the gateway hasn't confirmed. Sends run one at a
// time, and a part or note added during an upload is kept. The gateway calls are mocked.
import { addPending, pendingFor, putNote, sendPending } from '../src/features/sitewalk/pending'
import { saveNote } from '../src/features/sitewalk/api'

jest.mock('../src/features/sitewalk/api')
const save = saveNote as jest.MockedFunction<typeof saveNote>

// Lets a queued send reach its upload.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const note = (seq: number, text: string) => ({ kind: 'note' as const, seq, text })

beforeEach(() => {
  save.mockReset()
})

describe('sending what is waiting', () => {
  it('keeps a note added while another is uploading, and sends it next', async () => {
    let finish!: () => void
    save.mockImplementationOnce(() => new Promise((resolve) => (finish = () => resolve({} as never))))
    addPending('w1', note(1, 'first'))

    const first = sendPending('ref', 'w1')
    await tick()
    // Added during the upload: the old way wrote the list from before it, and lost this note.
    addPending('w1', note(2, 'second'))
    finish()
    const { left } = await first

    expect(left).toEqual([note(2, 'second')])
    expect(pendingFor('w1')).toEqual([note(2, 'second')])

    save.mockResolvedValue({} as never)
    expect((await sendPending('ref', 'w1')).left).toEqual([])
    expect(save.mock.calls.map((c) => c[3])).toEqual(['first', 'second'])
  })

  it('never sends the same item twice when two sends start together', async () => {
    let finish!: () => void
    save.mockImplementationOnce(() => new Promise((resolve) => (finish = () => resolve({} as never))))
    addPending('w2', note(1, 'only'))

    const a = sendPending('ref', 'w2')
    const b = sendPending('ref', 'w2')
    await tick()
    finish()
    await Promise.all([a, b])

    expect(save).toHaveBeenCalledTimes(1)
    expect(pendingFor('w2')).toEqual([])
  })

  it('an edit replaces the waiting note with the same number, and blank removes it', () => {
    addPending('w3', note(1, 'draft'))
    putNote('w3', 1, 'better')
    expect(pendingFor('w3')).toEqual([note(1, 'better')])
    putNote('w3', 1, '')
    expect(pendingFor('w3')).toEqual([note(1, '')])
  })
})
