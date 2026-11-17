// A 48px choice in a list: a place, a filter value. Used by ObservationEditor, FilterBar, SamePlaceSheet.
import { Pressable } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

type Props = { label: string; on?: boolean; hint?: string; onPress(): void }

export function Choice({ label, on = false, hint, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={cn('min-h-12 flex-row items-center justify-between gap-3 rounded-md border px-4 py-2', on ? 'border-primary bg-primary' : 'border-input bg-card active:bg-muted')}
    >
      <Text className={cn('flex-1', on && 'font-medium text-primary-foreground')}>{label}</Text>
      {hint ? <Text className={cn('text-sm', on ? 'text-primary-foreground' : 'text-muted-foreground')}>{hint}</Text> : null}
    </Pressable>
  )
}
