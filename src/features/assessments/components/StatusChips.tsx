// Home's status chips (MB-04 AC3): All statuses, then each status but
// archived (hidden from Home). One at a time. They follow the date chips in
// Home's one scrolling filter row (MB-07 AC3).
import { Pressable } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { STATUS, type AssessmentStatus } from '../format'

const OPTIONS: (AssessmentStatus | null)[] = [
  null,
  ...(Object.keys(STATUS) as AssessmentStatus[]).filter((s) => s !== 'archived'),
]

type Props = { selected: AssessmentStatus | null; onChange(status: AssessmentStatus | null): void }

export function StatusChips({ selected, onChange }: Props) {
  return OPTIONS.map((status) => {
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
          'h-12 justify-center rounded-md border px-4',
          on ? 'border-primary bg-primary' : 'border-input bg-card active:bg-muted',
        )}
      >
        <Text className={cn('font-medium', on && 'text-primary-foreground')}>{label}</Text>
      </Pressable>
    )
  })
}
