// What a calendar entry says about itself (MB-19): its words, spoken name and colour,
// shared by the grid chip, the list row and the details. Mirrors the web's Entry.tsx
// `describe`. Called by components/EntryChip, EntryRow and EntryDetails.
import { Calendar, CalendarCheck, CalendarClock, CalendarX, CircleCheck, Flag, Repeat, type LucideIcon } from 'lucide-react-native'
import { assessmentType, dueOf, formatDay, formatSpan, type CalendarItem, type DueState, type EntryKind } from './calendar'

// A report due date's colour, as the web's Report due cell: red late, amber within
// 7 days, grey on track, green finalised.
export const DUE_COLOR: Record<DueState, string> = {
  late: '#ad2e2d',
  soon: '#8f5f13',
  ok: '#545e6b',
  done: '#2f7049',
}

// And its icon: the Report due cell's calendar-x, calendar-clock, calendar and tick.
export const DUE_ICON: Record<DueState, LucideIcon> = { late: CalendarX, soon: CalendarClock, ok: Calendar, done: CircleCheck }

// A survey's icon and colours by assessment type, as the web's AssessmentTypeTile
// (ASSESSMENT_TYPES in design-system/components/display/AssessmentTypeTile.tsx): flag on ink,
// repeat on teal, calendar-check on amber. `fg` is the icon and words, `bg` the bar's fill.
export const TYPE_LOOK: Record<string, { Icon: LucideIcon; fg: string; bg: string }> = {
  'First survey': { Icon: Flag, fg: '#002c77', bg: '#e9f2fe' },
  Resurvey: { Icon: Repeat, fg: '#016d9e', bg: '#dff4f8' },
  'Follow-up': { Icon: CalendarCheck, fg: '#8f5f13', bg: '#fdf1d8' },
}
/** Returns the look of a survey's type, whatever the gateway stored ("Follow-up visit" included). */
export const typeLook = (surveyType: string) => TYPE_LOOK[assessmentType(surveyType)]

export const NOT_MINE = 'Only the assigned engineer can change these dates.'
export const OFFLINE_RESCHEDULE = 'Connect to reschedule.'

export function describe(item: CalendarItem, kind: EntryKind, today: string, meId: string) {
  const type = assessmentType(item.type)
  // Someone else's assessment names its engineer (a knowledge admin's list), first,
  // so a long client name that gets cut never cuts them.
  const who = item.engineer && item.engineer.id !== meId ? item.engineer.name : null
  if (kind === 'survey') {
    const when = item.start ? formatSpan(item.start, item.end) : 'No survey date'
    return {
      type,
      due: null,
      line: [who, type, item.client].filter(Boolean).join(' · '),
      chipLine: [who, item.client].filter(Boolean).join(' · '),
      spoken: [type, item.site, item.client, when, who].filter(Boolean).join(', '),
    }
  }
  const due = dueOf(item, today)
  return {
    type,
    due,
    line: [who, 'Report due', item.client].filter(Boolean).join(' · '),
    // Short enough for one day's column: "Due in 3 days", "6 days late", "Finalised".
    chipLine: !due ? 'Report due' : due.state === 'late' ? due.note : due.state === 'done' ? 'Finalised' : `Due ${due.note}`,
    spoken: ['Report due', item.site, item.client, item.due ? formatDay(item.due) : null, due?.note, who]
      .filter(Boolean)
      .join(', '),
  }
}
