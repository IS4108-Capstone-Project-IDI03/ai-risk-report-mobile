// The visit type (MB-21, web CP-23): First survey, Resurvey or Follow-up as three 48pt chips, as the
// calendar's filters. With `firstOnly` (a new site, or one with no earlier visit) the other two are
// greyed and the reason is written under them. Called by screens/NewAssessment.
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import type { VisitType } from '../api'
import { FIRST_ONLY, VISIT_TYPES } from '../format'

type Props = { value: VisitType | null; firstOnly: boolean; error?: string; onChange(type: VisitType): void }

export function TypeChips({ value, firstOnly, error, onChange }: Props) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {VISIT_TYPES.map((t) => {
          const off = firstOnly && t.value !== 'First survey'
          return (
            <Pressable
              key={t.value}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: value === t.value, disabled: off }}
              disabled={off}
              onPress={() => onChange(t.value)}
              className={cn('h-12 flex-1 items-center justify-center rounded-md border px-2 active:opacity-60', value === t.value ? 'border-2 border-primary bg-secondary' : 'border-input bg-card', off && 'opacity-40')}
            >
              <Text className="text-sm font-semibold">{t.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {firstOnly && <Text className="text-sm text-muted-foreground">{FIRST_ONLY}</Text>}
      {error && <Text className="text-sm text-destructive">{error}</Text>}
    </View>
  )
}
