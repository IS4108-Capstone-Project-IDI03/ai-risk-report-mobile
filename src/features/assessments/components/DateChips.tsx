// Home's date chips (MB-04 AC4-AC5): Overdue, Due soon and Site visits, each
// with how many assessments in progress match, as the web dashboard's date
// boxes. Tapping one filters the list; tapping it again clears it. Pills that
// sit in Home's one scrolling filter row, before the status chips (MB-07 AC3).
import { CalendarClock, CircleAlert, MapPin, type LucideIcon } from 'lucide-react-native'
import { Pressable } from 'react-native'
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
  return CHIPS.map(({ filter, label, Icon }) => {
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
          'h-12 flex-row items-center gap-2 rounded-md border px-3.5',
          on ? 'border-2 border-primary bg-secondary' : 'border-input bg-card active:bg-muted',
        )}
      >
        <Icon color={alarm ? '#ad2e2d' : '#2c5488'} size={16} />
        <Text className={cn('font-mono font-medium', alarm ? 'text-destructive' : 'text-primary')}>{counts[filter]}</Text>
        <Text className="font-medium">{label}</Text>
      </Pressable>
    )
  })
}
