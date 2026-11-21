// One entry as a row (MB-19, web CP-60): the phone's day list and the Late reports and
// No survey date cards. A tile, the site, one grey line, and a date or days at the right.
// Tapping opens EntryDetails. Used by DayList and SideLists.
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { CalendarItem, EntryKind } from '../calendar'
import { describe, DUE_COLOR, DUE_ICON, typeLook } from '../format'

type Props = {
  item: CalendarItem
  kind: EntryKind
  today: string
  meId: string
  // The words at the right: "6 days late", and under it (a new line) its date.
  right?: string
  onPress(item: CalendarItem): void
}

export function EntryRow({ item, kind, today, meId, right, onPress }: Props) {
  const d = describe(item, kind, today, meId)
  const survey = kind === 'survey'
  // The tile is the survey's type tile as on the web (flag, repeat or calendar-check); a report due keeps its state's icon.
  const look = typeLook(item.type)
  const Icon = survey ? look.Icon : DUE_ICON[d.due?.state ?? 'ok']
  const color = survey ? look.fg : DUE_COLOR[d.due?.state ?? 'ok']
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={d.spoken}
      onPress={() => onPress(item)}
      className="min-h-[60px] flex-row items-center gap-3 px-4 py-2 active:bg-muted"
    >
      <View
        className={survey ? 'h-8 w-8 items-center justify-center rounded-lg' : 'h-8 w-8 items-center justify-center rounded-lg border border-border bg-card'}
        style={survey ? { backgroundColor: look.bg } : undefined}
      >
        <Icon color={color} size={16} />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-sm font-semibold">{item.site}</Text>
        <Text numberOfLines={1} className="text-sm text-muted-foreground">{d.line}</Text>
      </View>
      {right ? (
        <Text className="shrink-0 text-right text-sm font-medium tabular-nums" style={{ color: survey ? undefined : color }}>
          {right}
        </Text>
      ) : null}
    </Pressable>
  )
}
