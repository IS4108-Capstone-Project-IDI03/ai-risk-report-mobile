// The month on a phone (MB-19, web CP-60), as in Apple Calendar: a grid of days that fills the
// tab height, with lines between the days. Each entry is a coloured bar carrying its site
// name, as on the web: a survey is one bar across all its days in its type's colour and icon
// (flag, repeat, calendar-check); a report due is a one-day white chip in its due state's colour and icon. A tap on a bar opens its details; a tap on the rest of a day picks the
// day, and Calendar then slides up a sheet with that day's entries.
// The web has no grid under 768px (seven columns of bars do not fit), so this is mobile's own.
// Called by screens/Calendar. Uses layoutWeek (calendar.ts) for the bars, as MonthGrid does.
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { MONTH_LANES, WEEKDAYS, addDays, dueOf, entriesOn, layoutWeek, monthStart, spokenDay, weekStart, type CalendarItem, type Show } from '../calendar'
import { DUE_COLOR, DUE_ICON, describe, typeLook } from '../format'

type Props = {
  items: CalendarItem[]
  // Any day of the month shown.
  month: string
  show: Show
  today: string
  meId: string
  // The day whose sheet is open; none when closed.
  selected: string | null
  onSelect(day: string): void
  onEntry(item: CalendarItem): void
}

// Where the bars start under a day's number, and one lane's height (the bar and a 2pt gap).
const BARS_TOP = 28
const LANE = 20
const BAR = 18

export function PhoneMonth({ items, month, show, today, meId, selected, onSelect, onEntry }: Props) {
  // A week's height, once measured: it decides how many bars fit before "+N".
  const [rowHeight, setRowHeight] = useState(0)
  const lanes = rowHeight ? Math.max(1, Math.floor((rowHeight - BARS_TOP) / LANE)) : MONTH_LANES
  const first = weekStart(monthStart(month))
  // Five weeks, or six when the month runs into a sixth.
  const weeks = Array.from({ length: 6 }, (_, i) => Array.from({ length: 7 }, (_, d) => addDays(first, i * 7 + d))).filter(
    (w) => w[0].startsWith(month.slice(0, 7)) || w[6].startsWith(month.slice(0, 7)),
  )
  return (
    <View testID="phone-month" className="flex-1">
      <View className="flex-row border-b border-border bg-muted">
        {WEEKDAYS.map((d) => (
          <Text key={d} className="flex-1 py-2 text-center text-xs font-semibold text-muted-foreground">
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week) => {
        const { entries, more } = layoutWeek(items, week[0], show, lanes)
        return (
          <View key={week[0]} className="flex-1 border-b border-border" onLayout={(e) => setRowHeight(e.nativeEvent.layout.height)}>
            <View className="flex-1 flex-row">
              {week.map((day, col) => {
                const outside = !day.startsWith(month.slice(0, 7))
                const on = day === selected
                const count = entriesOn(items, day, show).length
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={spokenDay(day)}
                    accessibilityValue={{ text: count ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'nothing' }}
                    accessibilityState={{ selected: on }}
                    onPress={() => onSelect(day)}
                    className={col < 6 ? 'flex-1 border-r border-border px-1 pt-1' : 'flex-1 px-1 pt-1'}
                    style={outside ? { backgroundColor: 'rgba(0,15,71,0.03)' } : undefined}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className={on ? 'h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1' : day === today ? 'h-6 min-w-6 items-center justify-center rounded-full border-2 border-primary px-1' : 'h-6 min-w-6 items-center justify-center px-1'}>
                        <Text className={on ? 'text-xs font-semibold text-primary-foreground' : outside ? 'text-xs text-muted-foreground/60' : day === today ? 'text-xs font-semibold text-primary' : 'text-xs'}>
                          {+day.slice(8, 10)}
                        </Text>
                      </View>
                      {more[col] > 0 && <Text className="text-[10px] font-semibold text-muted-foreground">{`+${more[col]}`}</Text>}
                    </View>
                  </Pressable>
                )
              })}
            </View>
            {/* The bars sit over the day cells, each its own button; the gaps between them still pick the day. */}
            <View pointerEvents="box-none" className="absolute inset-x-0 top-0">
              {entries.map((e) => {
                const d = describe(e.item, e.kind, today, meId)
                const survey = e.kind === 'survey'
                const look = typeLook(e.item.type)
                const color = survey ? look.fg : DUE_COLOR[dueOf(e.item, today)?.state ?? 'ok']
                const Icon = survey ? look.Icon : DUE_ICON[dueOf(e.item, today)?.state ?? 'ok']
                return (
                  // The outer view is the bar's slot (its days); the gap each side, except where the survey
                  // carries on past the week's edge, is padding, so the bar inside is a little narrower.
                  <View
                    key={e.key}
                    pointerEvents="box-none"
                    style={{
                      position: 'absolute',
                      top: BARS_TOP + e.lane * LANE,
                      left: `${(e.col / 7) * 100}%`,
                      width: `${(e.span / 7) * 100}%`,
                      paddingLeft: e.fromEarlier ? 0 : 2,
                      paddingRight: e.toLater ? 0 : 2,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={d.spoken}
                      onPress={() => onEntry(e.item)}
                      className={survey ? 'flex-row items-center gap-0.5 px-1' : 'flex-row items-center gap-0.5 border border-border bg-card px-1'}
                      style={{
                        height: BAR,
                        borderTopLeftRadius: e.fromEarlier ? 0 : 4,
                        borderBottomLeftRadius: e.fromEarlier ? 0 : 4,
                        borderTopRightRadius: e.toLater ? 0 : 4,
                        borderBottomRightRadius: e.toLater ? 0 : 4,
                        // A survey is filled in its type's colour; a report due is white with a hairline, no fill.
                        backgroundColor: survey ? look.bg : undefined,
                      }}
                    >
                      <Icon color={color} size={10} />
                      <Text numberOfLines={1} className="flex-1 text-[11px] font-semibold" style={{ color }}>
                        {e.item.site}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>
          </View>
        )
      })}
    </View>
  )
}
