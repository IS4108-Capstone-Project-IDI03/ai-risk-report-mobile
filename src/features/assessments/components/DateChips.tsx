// Home's date chips (MB-04 AC4-AC5): Overdue, Due soon and Site visits, each
// with how many assessments in progress match, as the web dashboard's date
// boxes. Tapping one filters the list; tapping it again clears it.
import { CalendarClock, CircleAlert, MapPin, type LucideIcon } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import type { DateFilter } from '../filters'

const CHIPS: { filter: DateFilter; label: string; Icon: LucideIcon }[] = [
  { filter: 'overdue', label: 'Overdue', Icon: CircleAlert },
  { filter: 'due-soon', label: 'Due soon', Icon: CalendarClock },
  { filter: 'visit-soon', label: 'Site visits', Icon: MapPin },
]

type Props = {
  counts: Record<DateFilter, number>
  selected: DateFilter | null
  onToggle(filter: DateFilter): void
}

export function DateChips({ counts, selected, onToggle }: Props) {
  return (
    <View className="flex-row gap-2">
      {CHIPS.map(({ filter, label, Icon }) => {
        const on = selected === filter
        // Red only when something is actually overdue: colour carries meaning.
        const alarm = filter === 'overdue' && counts.overdue > 0
        return (
          <Pressable
            key={filter}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${counts[filter]}`}
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(filter)}
            className={cn(
              'h-16 flex-1 justify-center gap-0.5 rounded-lg border px-3',
              on ? 'border-primary bg-secondary' : 'border-border bg-card active:bg-muted',
            )}
          >
            <View className="flex-row items-center gap-1.5">
              <Icon color={alarm ? '#ad2e2d' : '#2c5488'} size={16} />
              <Text className={cn('font-mono text-xl', alarm && 'text-destructive')}>{counts[filter]}</Text>
            </View>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
