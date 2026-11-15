// MB-16 part D and E (AC13-AC19): reviewing a ready walk's proposal: grouped by location, edit
// the note, severity, category and location, delete and restore, autosave, and Create all. The
// gateway is mocked; the AI work behind the proposal is the gateway's, never a test's.
import * as Crypto from 'expo-crypto'
import * as ImagePicker from 'expo-image-picker'
import { Alert } from 'react-native'
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library'
import { assessment, location, mockGateway, pointAtTestGateway, routes, signedIn } from '../test/gateway'

pointAtTestGateway()

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>
// Node's FormData turns React Native's { uri, name, type } files into text: record the parts.
class RecordingFormData {
  parts: [string, unknown][] = []
  append(key: string, value: unknown) {
    this.parts.push([key, value])
  }
}
const realFormData = globalThis.FormData
afterAll(() => {
  globalThis.FormData = realFormData
})

const REF = 'RPT-2026-0411'
const WALKS = `/api/assessments/${REF}/site-walks`

const obs = (ref: string, extra: object = {}) => ({
  ref, note: 'Pallets block the sprinkler', copeDimension: 'Protection', severity: 'high', locationRef: 'loc-1',
  recordingSeq: 1, start: 12, end: 30, photoIds: [], check: { severity: false, category: false, location: false }, ...extra,
})
const place = (ref: string, name: string, existingId: string | null = null) => ({ ref, existingId, kind: 'building', building: 'Block A', floor: 'Ground', name })

let proposal: { locations: object[]; observations: object[]; removed?: object[] }
// What the walk holds besides the proposal: its recording parts, photos and files added by hand.
let held: { recordings: object[]; photos: object[]; media: object[] }
const saved: object[] = []
const renamed: string[] = []
let created = 0
// Makes the next proposal save fail, once.
let failSave = false

function walk() {
  return { id: 'w1', status: 'ready', name: 'Block A walk', createdAt: '2026-11-12T03:00:00.000Z', recordings: held.recordings, photos: held.photos, media: held.media, notes: [], error: null, proposal }
}

function gateway() {
  return mockGateway({
    'GET /api/auth/me': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    [`GET /api/assessments/${REF}/locations`]: { status: 200, body: [location('l1', 'Lobby'), location('l9', 'Yard')] },
    [`GET /api/assessments/${REF}/observations`]: { status: 200, body: [] },
    [`GET ${WALKS}`]: () => ({ status: 200, body: [walk()] }),
    [`GET ${WALKS}/w1`]: () => ({ status: 200, body: walk() }),
    [`PUT ${WALKS}/w1/name`]: (init) => {
      renamed.push(JSON.parse(String(init?.body)).name)
      return { status: 200, body: { ...walk(), name: JSON.parse(String(init?.body)).name } }
    },
    [`PUT ${WALKS}/w1/proposal`]: (init) => {
      if (failSave) {
        failSave = false
        return { status: 500, body: { error: 'The server is busy.' } }
      }
      saved.push(JSON.parse(String(init?.body)))
      return { status: 200, body: walk() }
    },
    [`POST ${WALKS}/w1/create`]: () => {
      created += 1
      return { status: 200, body: { locationIds: ['l1'], observationIds: ['o1'] } }
    },
  })
}

async function openReview() {
  await renderRouter(routes)
  await fireEvent.press(await screen.findByText(REF))
  await screen.findByTestId('workspace')
  await fireEvent.press(await screen.findByRole('button', { name: 'Site walk' }))
  await fireEvent.press(await screen.findByRole('button', { name: 'Review: Block A walk' }))
  return within(await screen.findByTestId('walk-review'))
}

// Lets the 800 ms autosave run.
const autosave = () => act(async () => void jest.advanceTimersByTime(900))

beforeEach(() => {
  jest.restoreAllMocks()
  saved.length = 0
  renamed.length = 0
  created = 0
  held = { recordings: [], photos: [], media: [] }
  failSave = false
  proposal = {
    locations: [place('loc-1', 'Loading bay')],
    observations: [obs('obs-1'), obs('obs-2', { note: 'Door wedged open', severity: null, locationRef: null })],
  }
})

describe('the review of a ready walk', () => {
  it('lists the observations by location, with what each still needs (AC13)', async () => {
    gateway()
    const review = await openReview()

    expect(await review.findByText('No location yet')).toBeTruthy()
    expect(review.getByText('Block A · Ground · Loading bay')).toBeTruthy()
    expect(within(review.getByTestId('proposed-obs-2')).getByText('Needs location, severity')).toBeTruthy()
    expect(review.getByText('1 to fix before you can add them.')).toBeTruthy()
  })

  it('autosaves an edit to the note, severity, category and location (AC14, AC15)', async () => {
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByTestId('proposed-obs-2'))
    const editor = within(await screen.findByTestId('observation-editor'))
    await fireEvent.changeText(editor.getByLabelText('Note'), 'Fire door wedged open')
    await fireEvent.press(editor.getByRole('button', { name: 'Critical' }))
    await fireEvent.press(editor.getByRole('button', { name: 'Construction' }))
    await fireEvent.press(editor.getByRole('button', { name: 'Block A · Ground · Loading bay' }))
    await autosave()

    // One save, with everything changed so far.
    await waitFor(() => expect(saved).toHaveLength(1))
    const fixed = (saved[0] as { observations: { ref: string }[] }).observations.find((o) => o.ref === 'obs-2')
    expect(fixed).toMatchObject({ note: 'Fire door wedged open', severity: 'critical', copeDimension: 'Construction', locationRef: 'loc-1' })
  })

  it('moves an observation to one of the assessment\'s own places (AC15)', async () => {
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByTestId('proposed-obs-2'))
    await fireEvent.press(within(await screen.findByTestId('observation-editor')).getByRole('button', { name: 'Elsewhere on site · Yard' }))
    await autosave()

    await waitFor(() => expect(saved).toHaveLength(1))
    const body = saved[0] as { locations: { ref: string; existingId: string | null }[]; observations: { ref: string; locationRef: string }[] }
    // The place joins the proposal, linked to the existing one, so Create all won't add it twice.
    expect(body.locations.find((l) => l.existingId === 'l9')).toBeTruthy()
    expect(body.observations.find((o) => o.ref === 'obs-2')!.locationRef).toBe(body.locations.find((l) => l.existingId === 'l9')!.ref)
  })

  it('deletes an observation and restores it (AC16)', async () => {
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByTestId('proposed-obs-1'))
    await fireEvent.press(within(await screen.findByTestId('observation-editor')).getByRole('button', { name: 'Delete observation' }))
    await fireEvent.press(await review.findByRole('button', { name: 'Deleted (1)' }))
    expect(review.queryByTestId('proposed-obs-1')).toBeNull()

    await fireEvent.press(await review.findByRole('button', { name: 'Restore: Pallets block the sprinkler' }))
    await fireEvent.press(review.getByRole('button', { name: 'Back to the walk' }))
    expect(await review.findByTestId('proposed-obs-1')).toBeTruthy()
    await autosave()
    await waitFor(() => expect(saved).toHaveLength(1))
  })

  it('refuses Create all while something is missing, and says what (AC17)', async () => {
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByRole('button', { name: 'Create all' }))

    expect(await review.findByText('Choose a location for one observation first.')).toBeTruthy()
    expect(created).toBe(0)
  })

  // Changed 15 Nov (AC18, Miya): Create all now asks first. The first alert is the question; the second says what was added.
  it('asks first, then creates everything once it is complete, then leaves the walk (AC18)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    proposal = { locations: [place('loc-1', 'Loading bay')], observations: [obs('obs-1')] }
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByRole('button', { name: 'Create all' }))

    expect(alert.mock.calls[0][0]).toBe('Create all?')
    expect(alert.mock.calls[0][1]).toBe('This adds 1 observation and 1 location to the assessment.')
    expect(created).toBe(0)
    await act(async () => {
      ;(alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Create all')!.onPress!()
    })

    await waitFor(() => expect(created).toBe(1))
    expect(alert).toHaveBeenCalledWith('Added to the assessment', 'Created 1 observation and 1 location.')
    // Back on the Site walks screen.
    expect(await screen.findByTestId('site-walks')).toBeTruthy()
  })

  it('changes nothing when I cancel the question (AC18)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    proposal = { locations: [place('loc-1', 'Loading bay')], observations: [obs('obs-1')] }
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByRole('button', { name: 'Create all' }))
    expect((alert.mock.calls[0][2] as { text: string }[]).map((b) => b.text)).toEqual(['Cancel', 'Create all'])
    await act(async () => {
      ;(alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Cancel')!.onPress?.()
    })

    expect(created).toBe(0)
    expect(alert).toHaveBeenCalledTimes(1)
    expect(review.getByRole('button', { name: 'Create all' })).toBeTruthy()
  })
})

// ---- Part F: locations (AC20, AC21) ----

type Saved = { locations: { ref: string; existingId: string | null; kind: string; building: string | null; floor: string | null; name: string }[]; observations: { ref: string; locationRef: string | null }[] }

async function openPlaces(review: ReturnType<typeof within>) {
  await fireEvent.press(await review.findByRole('button', { name: /^Location: / }))
  return within(await screen.findByTestId('place-sheet'))
}

describe('the places of a proposal', () => {
  it('adds a typed place and picks it (AC20)', async () => {
    gateway()
    const review = await openReview()
    const sheet = await openPlaces(review)

    await fireEvent.press(sheet.getByRole('button', { name: 'Add location' }))
    const form = within(await screen.findByTestId('location-sheet'))
    await fireEvent.changeText(form.getByLabelText('Building'), 'Block B')
    await fireEvent.changeText(form.getByLabelText('Location'), 'Stairwell')
    await fireEvent.press(form.getByRole('button', { name: 'Save location' }))
    await autosave()

    await waitFor(() => expect(saved).toHaveLength(1))
    expect((saved[0] as Saved).locations.find((l) => l.name === 'Stairwell')).toMatchObject({ ref: 'loc-2', existingId: null, kind: 'building', building: 'Block B' })
    expect(await review.findByRole('button', { name: 'Location: Block B · Stairwell' })).toBeTruthy()
    expect(review.getByText('No observations here.')).toBeTruthy()
  })

  it('refuses the same place twice, and says so (AC20)', async () => {
    gateway()
    const review = await openReview()
    const sheet = await openPlaces(review)

    await fireEvent.press(sheet.getByRole('button', { name: 'Add location' }))
    const form = within(await screen.findByTestId('location-sheet'))
    await fireEvent.changeText(form.getByLabelText('Building'), 'block a')
    await fireEvent.changeText(form.getByLabelText('Level'), 'Ground')
    await fireEvent.changeText(form.getByLabelText('Location'), 'loading bay')
    await fireEvent.press(form.getByRole('button', { name: 'Save location' }))

    expect(await form.findByText('This location is already in the proposal.')).toBeTruthy()
    await autosave()
    expect(saved).toHaveLength(0)
  })

  it('offers Rename, Same as and Delete only on a new place (AC21)', async () => {
    proposal.locations = [place('loc-1', 'Loading bay'), place('loc-2', 'Plant room', 'l1')]
    gateway()
    const review = await openReview()
    const sheet = await openPlaces(review)

    expect(sheet.getByRole('button', { name: 'Rename Loading bay' })).toBeTruthy()
    expect(sheet.getByRole('button', { name: 'Same as… Loading bay' })).toBeTruthy()
    expect(sheet.getByRole('button', { name: 'Delete Loading bay' })).toBeTruthy()
    expect(sheet.queryByRole('button', { name: 'Rename Plant room' })).toBeNull()
    expect(sheet.queryByRole('button', { name: 'Delete Plant room' })).toBeNull()
  })

  it('renames a new place (AC21)', async () => {
    gateway()
    const review = await openReview()
    const sheet = await openPlaces(review)

    await fireEvent.press(sheet.getByRole('button', { name: 'Rename Loading bay' }))
    const form = within(await screen.findByTestId('location-sheet'))
    await fireEvent.changeText(form.getByLabelText('Location'), 'Dock')
    await fireEvent.press(form.getByRole('button', { name: 'Save location' }))
    await autosave()

    await waitFor(() => expect(saved).toHaveLength(1))
    expect((saved[0] as Saved).locations[0]).toMatchObject({ ref: 'loc-1', name: 'Dock', building: 'Block A' })
  })

  it('asks before deleting a place, then its observations wait under "No location yet" (AC21)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    gateway()
    const review = await openReview()
    const sheet = await openPlaces(review)

    await fireEvent.press(sheet.getByRole('button', { name: 'Delete Loading bay' }))
    expect(alert).toHaveBeenCalledWith('Delete this location?', expect.stringContaining('Its observation moves to “No location yet”'), expect.any(Array))
    // Nothing yet: it only asks.
    await autosave()
    expect(saved).toHaveLength(0)

    const buttons = alert.mock.calls[0][2]!
    await act(async () => buttons.find((b) => b.text === 'Delete location')!.onPress!())
    await autosave()

    await waitFor(() => expect(saved).toHaveLength(1))
    expect((saved[0] as Saved).locations).toHaveLength(0)
    expect((saved[0] as Saved).observations.every((o) => o.locationRef === null)).toBe(true)
  })

  it('"Same as…" turns a new place into one of the assessment\'s (AC21)', async () => {
    gateway()
    const review = await openReview()
    const sheet = await openPlaces(review)

    await fireEvent.press(sheet.getByRole('button', { name: 'Same as… Loading bay' }))
    const same = within(await screen.findByTestId('same-sheet'))
    await fireEvent.press(same.getByRole('button', { name: 'Elsewhere on site · Yard' }))
    await autosave()

    await waitFor(() => expect(saved).toHaveLength(1))
    expect((saved[0] as Saved).locations[0]).toMatchObject({ ref: 'loc-1', existingId: 'l9', name: 'Yard', kind: 'elsewhere' })
  })
})

// ---- Part G: finding your way (AC22-AC26) ----

describe('finding your way round a proposal', () => {
  it('shows one place at a time, from the chooser, with counts (AC22)', async () => {
    gateway()
    const review = await openReview()
    const sheet = await openPlaces(review)

    expect(sheet.getByRole('button', { name: 'All locations, 2' })).toBeTruthy()
    expect(sheet.getByRole('button', { name: 'No location yet, 1' })).toBeTruthy()
    await fireEvent.press(sheet.getByRole('button', { name: 'Block A · Ground · Loading bay, 1' }))

    expect(await review.findByRole('button', { name: 'Location: Block A · Ground · Loading bay' })).toBeTruthy()
    expect(review.getByTestId('proposed-obs-1')).toBeTruthy()
    expect(review.queryByTestId('proposed-obs-2')).toBeNull()
  })

  it('narrows the list by status, and clears the filters (AC23)', async () => {
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByRole('button', { name: 'Filter by status' }))
    await fireEvent.press(within(await screen.findByTestId('filter-sheet')).getByRole('button', { name: 'Needs details' }))

    expect(review.queryByTestId('proposed-obs-1')).toBeNull()
    expect(review.getByTestId('proposed-obs-2')).toBeTruthy()
    expect(review.getByText('Showing 1 of 2')).toBeTruthy()

    await fireEvent.press(review.getByRole('button', { name: 'Clear filters' }))
    expect(review.getByTestId('proposed-obs-1')).toBeTruthy()
  })

  it('"N to fix" opens the first observation that needs something (AC24)', async () => {
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByText('1 to fix before you can add them.'))

    const editor = within(await screen.findByTestId('observation-editor'))
    expect(editor.getByLabelText('Note').props.value).toBe('Door wedged open')
  })

  it('renames the walk (AC25)', async () => {
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByRole('button', { name: 'Rename walk' }))
    await fireEvent.changeText(review.getByLabelText('Walk name'), 'Block A, first pass')
    await fireEvent.press(review.getByRole('button', { name: 'Save name' }))

    await waitFor(() => expect(renamed).toEqual(['Block A, first pass']))
    expect(await review.findByText('Block A, first pass')).toBeTruthy()
  })

  it('Undo puts a deleted observation back where it was (AC26)', async () => {
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByTestId('proposed-obs-1'))
    await fireEvent.press(within(await screen.findByTestId('observation-editor')).getByRole('button', { name: 'Delete observation' }))
    await fireEvent.press(await review.findByRole('button', { name: 'Undo' }))

    expect(await review.findByTestId('proposed-obs-1')).toBeTruthy()
    expect(review.queryByRole('button', { name: 'Undo' })).toBeNull()
  })
})

// ---- Part H: adding an observation by hand (AC27) ----

const MEDIA_ID = '11111111-1111-4111-8111-111111111111'

describe('adding an observation by hand', () => {
  const uploads: RecordingFormData[] = []
  let uploadReply: { status: number; body: object }

  beforeEach(() => {
    uploads.length = 0
    uploadReply = { status: 200, body: { ...walk(), media: [{ id: MEDIA_ID, kind: 'photo', url: '/m', transcription: null, transcript: null }] } }
    globalThis.FormData = RecordingFormData as unknown as typeof FormData
    jest.spyOn(Crypto, 'randomUUID').mockReturnValue(MEDIA_ID)
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse)
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///lib/a.jpg' }] } as never)
  })

  function withMedia() {
    const fetchMock = gateway()
    const routes = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT' && new URL(url).pathname === `${WALKS}/w1/media/${MEDIA_ID}`) {
        uploads.push(init.body as unknown as RecordingFormData)
        return { ok: uploadReply.status < 300, status: uploadReply.status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => uploadReply.body } as Response
      }
      return routes(url, init)
    })
  }

  async function openForm(review: ReturnType<typeof within>) {
    await fireEvent.press(await review.findByRole('button', { name: 'Add observation' }))
    return within(await screen.findByTestId('add-observation-sheet'))
  }

  it('uploads each file, then adds the observation with their ids (AC27)', async () => {
    withMedia()
    const review = await openReview()
    const form = await openForm(review)

    await fireEvent.changeText(form.getByLabelText('Note'), 'Cable tray overloaded')
    await fireEvent.press(form.getByRole('button', { name: 'High' }))
    await fireEvent.press(form.getByRole('button', { name: 'Protection' }))
    await fireEvent.press(form.getByRole('button', { name: 'Block A · Ground · Loading bay' }))
    await fireEvent.press(form.getByRole('button', { name: 'Add photo from library' }))
    await fireEvent.press(await form.findByRole('button', { name: 'Save observation' }))

    // The file went to the walk under its own id, as the gateway's `photo` part.
    await waitFor(() => expect(uploads).toHaveLength(1))
    expect(uploads[0].parts[0][0]).toBe('photo')
    await autosave()
    await waitFor(() => expect(saved).toHaveLength(1))
    const added = (saved[0] as { observations: { ref: string; note: string; severity: string; copeDimension: string; locationRef: string; mediaIds?: string[]; recordingSeq: number | null }[] }).observations.find((o) => o.note === 'Cable tray overloaded')
    expect(added).toMatchObject({ ref: 'obs-3', severity: 'high', copeDimension: 'Protection', locationRef: 'loc-1', mediaIds: [MEDIA_ID], recordingSeq: null })
    expect(await review.findByTestId('proposed-obs-3')).toBeTruthy()
    expect(screen.queryByTestId('add-observation-sheet')).toBeNull()
  })

  it('says what is missing instead of saving (AC27)', async () => {
    withMedia()
    const review = await openReview()
    const form = await openForm(review)

    await fireEvent.press(form.getByRole('button', { name: 'Save observation' }))
    expect(await form.findByText('Add a note, photo, voice note or scan.')).toBeTruthy()

    await fireEvent.changeText(form.getByLabelText('Note'), 'Something')
    await fireEvent.press(form.getByRole('button', { name: 'Save observation' }))
    expect(await form.findByText('Choose a severity to save.')).toBeTruthy()

    await fireEvent.press(form.getByRole('button', { name: 'Low' }))
    await fireEvent.press(form.getByRole('button', { name: 'Save observation' }))
    expect(await form.findByText('Choose a location for this observation.')).toBeTruthy()
    await autosave()
    expect(saved).toHaveLength(0)
  })

  it('keeps the form and says why when a file cannot be uploaded (AC27)', async () => {
    uploadReply = { status: 500, body: { error: 'File storage is down.' } }
    withMedia()
    const review = await openReview()
    const form = await openForm(review)

    await fireEvent.changeText(form.getByLabelText('Note'), 'Cable tray overloaded')
    await fireEvent.press(form.getByRole('button', { name: 'High' }))
    await fireEvent.press(form.getByRole('button', { name: 'Block A · Ground · Loading bay' }))
    await fireEvent.press(form.getByRole('button', { name: 'Add photo from library' }))
    await fireEvent.press(await form.findByRole('button', { name: 'Save observation' }))

    expect(await form.findByText('File storage is down.')).toBeTruthy()
    await autosave()
    // Nothing was added to the proposal, and the form still has what was typed.
    expect(saved).toHaveLength(0)
    expect(form.getByLabelText('Note').props.value).toBe('Cable tray overloaded')
  })
})

// ---- Part I: media, stepping, deleted, all photos and pages (AC28-AC31) ----

const clip = { seq: 1, durationSec: 60, transcription: 'transcribed', transcript: 'the whole part', audioUrl: '/api/audio/1' }
const mediaItem = (id: string, kind: string, extra: object = {}) => ({ id, kind, url: `/api/media/${id}`, transcription: null, transcript: null, ...extra })

describe('what an observation holds', () => {
  beforeEach(() => {
    held = {
      recordings: [clip],
      photos: [{ id: 'p1', url: '/api/photo/p1', recordingSeq: 1, offsetSec: 3 }],
      media: [
        mediaItem('m1', 'photo'),
        mediaItem('m2', 'page'),
        mediaItem('m3', 'voice', { transcription: 'transcribed', transcript: 'Fire door wedged open' }),
        mediaItem('m4', 'voice', { transcription: 'queued' }),
        mediaItem('m5', 'voice', { transcription: 'failed' }),
      ],
    }
    proposal.observations = [obs('obs-1', { photoIds: ['p1'], mediaIds: ['m1', 'm2', 'm3', 'm4', 'm5'] }), obs('obs-2', { note: 'Door wedged open' })]
  })

  it('shows its photos, pages, voice notes and the walk recording it came from (AC17, AC28)', async () => {
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByTestId('proposed-obs-1'))
    const editor = within(await screen.findByTestId('observation-editor'))

    expect(editor.getByTestId('proposed-photo-p1')).toBeTruthy()
    expect(editor.getByTestId('proposed-photo-m1')).toBeTruthy()
    expect(editor.getByTestId('proposed-page-m2')).toBeTruthy()
    expect(editor.getByText('Fire door wedged open')).toBeTruthy()
    expect(editor.getByText('Transcribing…')).toBeTruthy()
    expect(editor.getByText('Not transcribed yet. It is transcribed again when you create all.')).toBeTruthy()
    expect(editor.getByRole('button', { name: 'Play site walk recording' })).toBeTruthy()
  })

  it('steps to the next and previous observation, saying where it is (AC31)', async () => {
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByTestId('proposed-obs-1'))
    const editor = within(await screen.findByTestId('observation-editor'))
    expect(editor.getByText('1 of 2')).toBeTruthy()
    expect(editor.getByRole('button', { name: 'Previous observation' }).props.accessibilityState.disabled).toBe(true)

    await fireEvent.press(editor.getByRole('button', { name: 'Next observation' }))
    expect(await editor.findByText('2 of 2')).toBeTruthy()
    expect(editor.getByLabelText('Note').props.value).toBe('Door wedged open')
    expect(editor.getByRole('button', { name: 'Next observation' }).props.accessibilityState.disabled).toBe(true)
  })
})

describe('the deleted, all photos and all pages screens', () => {
  beforeEach(() => {
    held = { recordings: [clip], photos: [{ id: 'p1', url: '/api/photo/p1', recordingSeq: 1, offsetSec: 3 }], media: [mediaItem('m2', 'page')] }
    proposal.observations = [obs('obs-1', { photoIds: ['p1'], mediaIds: ['m2'] }), obs('obs-2', { note: 'Door wedged open', severity: null, locationRef: null })]
  })

  it('lists the deleted, readable, with Restore (AC29)', async () => {
    proposal.removed = [obs('obs-9', { note: 'Old finding', photoIds: ['p1'] })]
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByRole('button', { name: 'Deleted (1)' }))

    const deleted = within(await review.findByTestId('deleted-screen'))
    expect(deleted.getByText('Old finding')).toBeTruthy()
    expect(deleted.getByText('Block A · Ground · Loading bay')).toBeTruthy()
    expect(deleted.getByTestId('proposed-photo-p1')).toBeTruthy()
    await fireEvent.press(deleted.getByRole('button', { name: 'Restore: Old finding' }))
    expect(deleted.queryByText('Old finding')).toBeNull()
  })

  it('lists every photo with its place and note, and goes to its observation (AC30)', async () => {
    gateway()
    const review = await openReview()
    await fireEvent.press(await review.findByRole('button', { name: /^Location: / }))
    await fireEvent.press(within(await screen.findByTestId('place-sheet')).getByRole('button', { name: 'All photos' }))

    const photos = within(await review.findByTestId('photos-screen'))
    expect(photos.getByTestId('proposed-photo-p1')).toBeTruthy()
    expect(photos.getByText('Block A · Ground · Loading bay')).toBeTruthy()
    expect(photos.getByText('Pallets block the sprinkler')).toBeTruthy()

    await fireEvent.press(photos.getByRole('button', { name: 'Go to observation: Pallets block the sprinkler' }))
    expect(within(await screen.findByTestId('observation-editor')).getByLabelText('Note').props.value).toBe('Pallets block the sprinkler')
  })

  it('lists the handwritten pages (AC30)', async () => {
    gateway()
    const review = await openReview()
    await fireEvent.press(await review.findByRole('button', { name: /^Location: / }))
    await fireEvent.press(within(await screen.findByTestId('place-sheet')).getByRole('button', { name: 'All handwritten pages' }))
    expect(within(await review.findByTestId('pages-screen')).getByTestId('proposed-page-m2')).toBeTruthy()
  })

  it('says so when there are no pages (AC30)', async () => {
    held.media = []
    gateway()
    const review = await openReview()
    await fireEvent.press(await review.findByRole('button', { name: /^Location: / }))
    await fireEvent.press(within(await screen.findByTestId('place-sheet')).getByRole('button', { name: 'All handwritten pages' }))
    expect(await review.findByText('No handwritten pages yet')).toBeTruthy()
  })
})

describe('a failed autosave', () => {
  it('offers Retry saving, which sends the edits and clears the failure (AC14)', async () => {
    failSave = true
    gateway()
    const review = await openReview()

    await fireEvent.press(await review.findByTestId('proposed-obs-1'))
    await fireEvent.changeText(within(await screen.findByTestId('observation-editor')).getByLabelText('Note'), 'Changed')
    await autosave()

    expect(await review.findByText("Couldn't save. Your changes are still here.")).toBeTruthy()
    expect(saved).toHaveLength(0)
    await fireEvent.press(review.getByRole('button', { name: 'Retry saving' }))

    await waitFor(() => expect(saved).toHaveLength(1))
    expect((saved[0] as { observations: { ref: string; note: string }[] }).observations.find((o) => o.ref === 'obs-1')!.note).toBe('Changed')
    expect(await review.findByText('All changes saved')).toBeTruthy()
  })
})
