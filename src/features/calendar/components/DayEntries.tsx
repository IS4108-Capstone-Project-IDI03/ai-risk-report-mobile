// What is on the day picked in the phone's month (MB-19, web CP-60): a row for each survey
// that covers it and each report due on it, or "Nothing on this day." Shown inside the
// BottomSheet (src/components) that slides up when a day is tapped. Called by screens/Calendar. Calls EntryRow.
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { dueOf, formatWeekday, type CalendarItem, type DayEntry } from '../calendar'
import { EntryRow } from './EntryRow'

type Props = { entries: DayEntry[]; today: string; meId: string; onPress(item: CalendarItem): void }

/** Returns the sheet's title: "Today · Wed 18 Nov", or "Thu 19 Nov". */
export const dayTitle = (day: string, today: string) => (day === today ? `Today · ${formatWeekday(day)}` : formatWeekday(day))

export function DayEntries({ entries, today, meId, onPress }: Props) {
  return (
    <View testID="day-entries">
      {entries.length ? (
        entries.map((e) => (
          <EntryRow
            key={e.key}
            item={e.item}
            kind={e.kind}
            today={today}
            meId={meId}
            // A report due says how long; a survey's days are in its details.
            right={e.kind === 'due' ? dueOf(e.item, today)?.note : undefined}
            onPress={onPress}
          />
        ))
      ) : (
        <Text className="px-4 py-4 text-muted-foreground">Nothing on this day.</Text>
      )}
    </View>
  )
}
