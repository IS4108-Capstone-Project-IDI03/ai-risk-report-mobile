// Home's status chips (MB-04 AC3): All statuses, then each status but
// archived (hidden from Home), in a horizontal scrolling row. One at a time.
import { Pressable, ScrollView } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { STATUS, type AssessmentStatus } from '../format'

const OPTIONS: (AssessmentStatus | null)[] = [
  null,
  ...(Object.keys(STATUS) as AssessmentStatus[]).filter((s) => s !== 'archived'),
]

type Props = { selected: AssessmentStatus | null; onChange(status: AssessmentStatus | null): void }

export function StatusChips({ selected, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4" className="-mx-4">
      {OPTIONS.map((status) => {
        const on = selected === status
        const label = status ? STATUS[status].label : 'All statuses'
        return (
          <Pressable
            key={status ?? 'all'}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(status)}
            className={cn(
              'h-10 justify-center rounded-full border px-4',
              on ? 'border-primary bg-primary' : 'border-input bg-card active:bg-muted',
            )}
          >
            <Text className={cn('text-sm font-medium', on && 'text-primary-foreground')}>{label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
