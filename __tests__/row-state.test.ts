// MB-23 AC4, AC5: the one rule for an observation's state, copied from the web's
// observationRowState.ts (first match wins). Pure: no screen, no network.
import { fieldStateOf, rowStateOf } from '@/features/observations/rowState'
import type { Observation } from '@/features/observations/format'

// An observation with only what the rule reads.
const base = (over: Partial<Observation> = {}) =>
  ({ copeDimensions: ['Construction'], severity: 'high', recordings: [], pages: [], ...over }) as Observation
const media = (status: 'transcribing' | 'transcribed' | 'failed') => ({
  id: 'r1',
  url: '/x',
  transcription: { status, transcript: null, error: null },
})
const suggestion = (over: object = {}) => ({ status: 'done', error: null, category: null, severity: null, ...over })

describe('rowStateOf', () => {
  it('is Complete when nothing is open (AC4)', () => {
    expect(rowStateOf(base())).toEqual({ status: 'Complete', tint: null, reason: null })
  })

  it('says Transcribing while a voice note or page is being read (AC4)', () => {
    expect(rowStateOf(base({ recordings: [media('transcribing')] })).status).toBe('Transcribing')
    expect(rowStateOf(base({ pages: [media('transcribing')] })).status).toBe('Transcribing')
  })

  it('says Reading while the AI suggests, or describes a photo (AC4)', () => {
    const reading = { copeDimensions: null, suggestion: suggestion({ status: 'reading' }) } as Partial<Observation>
    expect(rowStateOf(base(reading))).toEqual({ status: 'Reading', tint: 'reading', reason: null })
    const photo = { interpretation: { photos: { status: 'interpreting' } } } as unknown as Partial<Observation>
    expect(rowStateOf(base(photo)).status).toBe('Reading')
  })

  it('says Transcription failed for a failed note or page (AC4)', () => {
    expect(rowStateOf(base({ recordings: [media('failed')] }))).toEqual({
      status: 'Transcription failed',
      tint: null,
      reason: null,
    })
  })

  it('says Reading failed, in red, when the suggestion failed (AC4)', () => {
    const failed = { suggestion: suggestion({ status: 'failed', error: 'x' }) } as Partial<Observation>
    expect(rowStateOf(base(failed))).toEqual({ status: 'Reading failed', tint: 'failed', reason: 'Suggestion failed' })
  })

  it('says To check, with its reason, for a suggestion that is not sure or an empty field (AC4)', () => {
    const cat = { suggestion: suggestion({ category: { notSure: true } }), toCheck: true } as Partial<Observation>
    expect(rowStateOf(base(cat))).toEqual({ status: 'To check', tint: 'unsure', reason: 'Check category' })
    const sev = { suggestion: suggestion({ severity: { notSure: true } }), toCheck: true } as Partial<Observation>
    expect(rowStateOf(base(sev)).reason).toBe('Check severity')
    const both = {
      suggestion: suggestion({ category: { notSure: true }, severity: { notSure: true } }),
      toCheck: true,
    } as Partial<Observation>
    expect(rowStateOf(base(both)).reason).toBe('Check category and severity')
    // Nothing was filled in, so there is no value to check: it asks for a choice.
    const empty = { copeDimensions: null, severity: null, toCheck: true } as Partial<Observation>
    expect(rowStateOf(base(empty)).reason).toBe('Choose category and severity')
  })

  it('takes the first match: transcribing beats reading, and reading beats failed (AC4)', () => {
    const o = base({
      recordings: [media('transcribing'), media('failed')],
      suggestion: suggestion({ status: 'reading' }),
    } as Partial<Observation>)
    expect(rowStateOf(o).status).toBe('Transcribing')
    const r = base({ recordings: [media('failed')], suggestion: suggestion({ status: 'reading' }) } as Partial<Observation>)
    expect(rowStateOf(r).status).toBe('Reading')
  })
})

describe('fieldStateOf', () => {
  it('marks a field the AI is still suggesting, an empty one, or a suggestion that is not sure (AC1, AC2, AC3)', () => {
    const reading = base({ copeDimensions: null, suggestion: suggestion({ status: 'reading' }) } as Partial<Observation>)
    expect(fieldStateOf(reading, 'category')).toEqual({ suggesting: true, failed: false, notSure: false })

    const unsure = base({ suggestion: suggestion({ severity: { notSure: true } }) } as Partial<Observation>)
    expect(fieldStateOf(unsure, 'severity')).toEqual({ suggesting: false, failed: false, notSure: true })
    // A value the engineer chose has no mark.
    expect(fieldStateOf(unsure, 'category')).toEqual({ suggesting: false, failed: false, notSure: false })

    const failed = base({ severity: null, suggestion: suggestion({ status: 'failed' }) } as Partial<Observation>)
    expect(fieldStateOf(failed, 'severity')).toEqual({ suggesting: false, failed: true, notSure: false })
  })

  it('does not call a suggestion not sure while the AI is reading it again (AC1)', () => {
    const o = base({ suggestion: suggestion({ status: 'reading', category: { notSure: true } }) } as Partial<Observation>)
    expect(fieldStateOf(o, 'category')).toEqual({ suggesting: true, failed: false, notSure: false })
  })
})
