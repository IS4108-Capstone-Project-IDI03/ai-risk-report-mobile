// An observation's state as the engineer sees it (MB-23, the web's CP-24): the status line on a list
// row, and the state of each of the category and severity fields on its screen. Pure: no React, no
// network. Copied from the web's observationRowState.ts and ObservationDetails.tsx, so the words match.
// Called by components/ObservationCard, components/SuggestionLines and the polling in the screens.
import type { Observation } from './format'

export type RowStatus = 'Transcribing' | 'Reading' | 'Transcription failed' | 'Reading failed' | 'To check' | 'Complete'
export type RowTint = 'unsure' | 'failed' | 'reading' | null

// The parts of an observation the rule reads, so a test needs no whole observation.
type Input = Pick<Observation, 'copeDimensions' | 'severity' | 'recordings' | 'pages'> &
  Partial<Pick<Observation, 'suggestion' | 'toCheck' | 'interpretation'>>

// Returns the status words, the tint (amber unsure, red failed, blue reading) and the reason line.
export function rowStateOf(o: Input): { status: RowStatus; tint: RowTint; reason: string | null } {
  const media = [...o.recordings, ...o.pages].map((m) => m.transcription?.status)
  const reading = o.suggestion?.status === 'reading' || o.interpretation?.photos?.status === 'interpreting'
  // First match wins.
  if (media.includes('transcribing')) return { status: 'Transcribing', tint: null, reason: null }
  if (reading) return { status: 'Reading', tint: 'reading', reason: null }
  if (media.includes('failed')) return { status: 'Transcription failed', tint: null, reason: null }
  if (o.suggestion?.status === 'failed') return { status: 'Reading failed', tint: 'failed', reason: 'Suggestion failed' }
  if (o.toCheck) {
    const category = !o.copeDimensions?.length || !!o.suggestion?.category?.notSure
    const severity = !o.severity || !!o.suggestion?.severity?.notSure
    const what = category && severity ? 'category and severity' : category ? 'category' : 'severity'
    // Nothing was filled in, so there is no value to check: it asks for a choice instead.
    const filled = !!o.suggestion?.category?.notSure || !!o.suggestion?.severity?.notSure
    return { status: 'To check', tint: 'unsure', reason: (filled ? 'Check ' : 'Choose ') + what }
  }
  return { status: 'Complete', tint: null, reason: null }
}

export type Field = 'category' | 'severity'

// One field's state on the observation's screen. An empty field, or one still holding a suggestion,
// is "suggesting" while the AI reads. An empty field after a failure is red. A suggested value is
// "not sure" until confirmed, but not while the AI is reading it again.
export function fieldStateOf(o: Input, field: Field) {
  const s = o.suggestion
  const empty = field === 'category' ? !o.copeDimensions?.length : !o.severity
  const mine = field === 'category' ? s?.category : s?.severity
  return {
    suggesting: s?.status === 'reading' && (empty || !!mine),
    failed: s?.status === 'failed' && empty,
    notSure: !empty && !!mine?.notSure && s?.status !== 'reading',
  }
}

// Still being worked on: the screens read the observation again until it settles (AC15, AC16).
export const isWorking = (o: Input) => ['Transcribing', 'Reading'].includes(rowStateOf(o).status)
