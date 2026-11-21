// One entry in the month or week grid (MB-19, web CP-60): a survey as a navy-tinted
// bar, a report due date as a white chip whose icon and words take its state. The two
// differ in shape, not only colour. Placed by MonthGrid. Tapping opens EntryDetails.
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { CalendarItem, Entry } from '../calendar'
import { describe, DUE_COLOR, DUE_ICON, typeLook } from '../format'


type Props = {
  entry: Pick<Entry, 'kind' | 'fromEarlier' | 'toLater'> & { item: CalendarItem }
  today: string
  meId: string
  // The week view gives each entry a second line (client, or days late).
  tall: boolean
  onPress(item: CalendarItem): void
}

export function EntryChip({ entry, today, meId, tall, onPress }: Props) {
  const { item, kind } = entry
  const d = describe(item, kind, today, meId)
  const survey = kind === 'survey'
  // As the web: a survey is a bar in its type's colours and icon; a report due is a white chip in its state's.
  const look = typeLook(item.type)
  const Icon = survey ? look.Icon : DUE_ICON[d.due?.state ?? 'ok']
  const color = survey ? look.fg : DUE_COLOR[d.due?.state ?? 'ok']
  // A survey that runs into another week is square at that end.
  const radius = {
    borderTopLeftRadius: entry.fromEarlier ? 0 : 8,
    borderBottomLeftRadius: entry.fromEarlier ? 0 : 8,
    borderTopRightRadius: entry.toLater ? 0 : 8,
    borderBottomRightRadius: entry.toLater ? 0 : 8,
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={d.spoken}
      onPress={() => onPress(item)}
      style={[{ flex: 1 }, radius, survey && { backgroundColor: look.bg, borderColor: 'transparent' }]}
      className={survey ? 'justify-center border px-1.5' : 'justify-center border border-border bg-card px-1.5'}
    >
      <View className="flex-row items-center gap-1">
        <Icon color={color} size={12} />
        <Text numberOfLines={1} className="flex-1 text-xs font-semibold" style={{ color }}>
          {survey ? item.site : d.chipLine}
        </Text>
      </View>
      {tall && (
        <Text numberOfLines={1} className="text-xs text-muted-foreground">
          {survey ? d.chipLine || d.type : item.site}
        </Text>
      )}
    </Pressable>
  )
}
