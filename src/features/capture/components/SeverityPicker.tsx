// The capture sheet's severity (MB-03 AC10): four 48px segments, each in the
// design system's severity colour when selected. Required to save.
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { SEVERITY, type Severity } from '@/features/observations/format'
import { cn } from '@/lib/utils'

// Selected colours per severity: text and border in the fg tone, on its fill.
const SELECTED: Record<Severity, string> = {
  critical: 'border-critical-foreground bg-critical',
  high: 'border-high-foreground bg-high',
  moderate: 'border-warning-foreground bg-warning',
  low: 'border-success-foreground bg-success',
}
const SELECTED_TEXT: Record<Severity, string> = {
  critical: 'text-critical-foreground',
  high: 'text-high-foreground',
  moderate: 'text-warning-foreground',
  low: 'text-success-foreground',
}

export function SeverityPicker({ value, onChange }: { value: Severity | null; onChange(s: Severity): void }) {
  return (
    <View className="flex-row gap-2">
      {(Object.keys(SEVERITY) as Severity[]).map((s) => {
        const on = value === s
        return (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={SEVERITY[s].label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(s)}
            className={cn(
              'h-12 flex-1 items-center justify-center rounded-md border',
              on ? cn('border-2', SELECTED[s]) : 'border-input bg-card active:bg-muted',
            )}
          >
            <Text className={cn('text-sm font-medium', on && cn('font-semibold', SELECTED_TEXT[s]))}>
              {SEVERITY[s].label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
