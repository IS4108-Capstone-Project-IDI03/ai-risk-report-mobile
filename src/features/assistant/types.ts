// The part of MarshBot's conversation the phone reads (MB-20, web AS-06). Kept small on purpose: the gateway
// sends more (agenda, earlier sessions, the AI-worded `program`) and the phone ignores it. Must match the web
// repo's server/src/services/assistant/types.ts. Used by api.ts, useThread.ts and the components.
import type { ItemLink } from '@/features/overview/api'

export type Tone = 'neutral' | 'violet' | 'amber' | 'red' | 'green'

// The stages in order; the position is what the eight segments show (web stage.ts, STAGES).
export const STAGES = ['setup', 'prepare', 'capture', 'ready_for_generation', 'generate', 'review', 'ready_to_export', 'exported']

export type RowEnd =
  | { type: 'button'; label: string; icon: string | null; link: ItemLink | null; action: 'retry-transcription' | 'retry-page' | null }
  | { type: 'open'; link: ItemLink; label: string }
  | { type: 'status'; status: 'done' | 'busy'; label: string }
  | { type: 'tick' }

export type CardRow = { id: string; icon: string; tone: Tone; title: string; detail: string | null; bad: boolean; end: RowEnd }
export type TickCell = { title: string; detail: string | null; bar: { covered: number; total: number } | null }
export type Area = { area: string; icon: string; covered: number; total: number; link: ItemLink }

export type Card =
  | { type: 'tasks'; id: string; title: string; done: number; total: number; rows: CardRow[] }
  | { type: 'rows'; id: string; title: string; note: string | null; rows: CardRow[]; ticks: TickCell[]; cta: { label: string; link: ItemLink } | null }
  | { type: 'checklist'; id: string; answered: number; total: number; gaps: (Area & { items: string[]; more: number })[]; fine: TickCell[] }
  | { type: 'bars'; id: string; answered: number; total: number; areas: Area[] }
  // The cards the first version does not draw: their title and note, then "See the detail on the web."
  | { type: 'outline' | 'lanes' | 'stage-time'; id: string; title: string; note?: string | null; lead?: string }

export type Say = { text: string; tone: 'normal' | 'good' | 'lead' | 'tick' | 'alert' | 'step' }
export type Turn = { id: string; who: 'bot' | 'engineer'; at: string; says: Say[]; cards: Card[] }

export type Reply = { id: string; label: string; primary: boolean; picksDate: boolean; link: ItemLink | null; icon?: string | null; hint?: string }

export type Thread = {
  reference: string
  viewer: 'engineer' | 'admin'
  stage: string
  status: { text: string; tone: 'red' | 'amber' | 'green' | 'blue'; icon: string }
  glance: { icon: string; label: string; value: string; tone: 'normal' | 'amber' | 'red' | 'green' }[]
  session: { id: string; turns: Turn[] }
  replies: Reply[]
  // MarshBot is writing its next turn or checking coverage: show the typing dots and read again.
  thinking: boolean
  updatedAt: string
}
