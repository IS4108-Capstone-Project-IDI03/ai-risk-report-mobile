// The calendar's grid on a wide window (MB-19, web CP-60): weekday names, then one row
// per week (six in the month, one in the week). Each day is a tap target that opens
// its week; entries sit over the days in lanes from layoutWeek, so a survey of several
// days is one bar. A month day shows three lanes, then "+N more", which opens its week.
// Called by screens/Calendar. Calls EntryChip.
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { MONTH_LANES, WEEKDAYS, formatDay, spokenDay, type CalendarItem, type Week } from '../calendar'
import { EntryChip } from './EntryChip'

const DATE_BAND = 30 // the day's date, top left
const GAP = 4
const MONTH_CHIP = 28 // taller than the web's 24: a finger is not a mouse
const WEEK_CHIP = 52 // two lines
const MORE_BAND = 24

type Props = {
  weeks: Week[]
  // 'YYYY-MM' of the month shown, so other months' days grey; null in the week view.
  month: string | null
  today: string
  meId: string
  onEntry(item: CalendarItem): void
  onWeek(day: string): void
}

export function MonthGrid({ weeks, month, today, meId, onEntry, onWeek }: Props) {
  const tall = month === null
  const chip = tall ? WEEK_CHIP : MONTH_CHIP
  return (
    <View testID="calendar-grid">
      <View className="flex-row border-b border-border">
        {WEEKDAYS.map((d) => (
          <Text key={d} className="flex-1 py-2 text-center text-xs font-semibold text-muted-foreground">
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week) => {
        const height = tall
          ? Math.max(280, DATE_BAND + week.lanes * (chip + GAP) + MORE_BAND)
          : DATE_BAND + MONTH_LANES * (chip + GAP) + MORE_BAND
        return (
          <View key={week.start} style={{ height }} className="border-b border-border">
            <View className="flex-1 flex-row">
              {week.days.map((day) => {
                const outside = month !== null && !day.startsWith(month)
                return (
                  <Pressable
                    key={day}
                    // The week view's days are not buttons: there is nothing more to open.
                    disabled={tall}
                    accessibilityRole={tall ? undefined : 'button'}
                    accessibilityLabel={spokenDay(day)}
                    accessibilityHint={tall ? undefined : 'Opens its week'}
                    onPress={() => onWeek(day)}
                    className={outside ? 'flex-1 border-l border-border bg-muted p-1.5' : 'flex-1 border-l border-border bg-card p-1.5'}
                  >
                    <View className={day === today ? 'self-start rounded-full border-2 border-primary px-1.5' : 'self-start px-1.5'}>
                      <Text className={outside ? 'text-sm font-medium text-muted-foreground' : 'text-sm font-medium'}>
                        {/* The first of a month reads "1 Dec". */}
                        {day.endsWith('-01') ? formatDay(day).slice(0, -5) : +day.slice(8, 10)}
                      </Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
            {/* Entries over the days; the overlay lets taps through to the day beneath. */}
            <View pointerEvents="box-none" className="absolute inset-0">
              {week.entries.map((e) => (
                <View
                  key={e.key}
                  pointerEvents="box-none"
                  style={{
                    position: 'absolute',
                    left: `${(e.col * 100) / 7}%`,
                    width: `${(e.span * 100) / 7}%`,
                    top: DATE_BAND + e.lane * (chip + GAP),
                    height: chip,
                    paddingHorizontal: 2,
                  }}
                >
                  <EntryChip entry={e} today={today} meId={meId} tall={tall} onPress={onEntry} />
                </View>
              ))}
              {week.more.map((n, col) =>
                n ? (
                  <Pressable
                    key={col}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} more on ${spokenDay(week.days[col])}. Opens its week`}
                    hitSlop={8}
                    onPress={() => onWeek(week.days[col])}
                    style={{ position: 'absolute', left: `${(col * 100) / 7}%`, width: `${100 / 7}%`, top: DATE_BAND + MONTH_LANES * (chip + GAP) }}
                    className="px-2"
                  >
                    <Text className="text-xs font-semibold text-muted-foreground">{`+${n} more`}</Text>
                  </Pressable>
                ) : null,
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}
