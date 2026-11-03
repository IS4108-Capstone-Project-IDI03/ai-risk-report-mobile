// The capture sheet's COPE categories (MB-03 AC9): toggle chips, any number,
// none = uncategorised. 48px tall, for gloves. Two by two (MB-07), so all
// four show without wrapping unevenly.
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { COPE, type Cope } from '../draft'

export function CopeChips({ value, onChange }: { value: Cope[]; onChange(next: Cope[]): void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {COPE.map((c) => {
        const on = value.includes(c)
        return (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={c}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(on ? value.filter((v) => v !== c) : [...value, c])}
            className={cn(
              'h-12 grow basis-[45%] items-center justify-center rounded-md border px-4',
              on ? 'border-primary bg-primary' : 'border-input bg-card active:bg-muted',
            )}
          >
            <Text className={cn('font-medium', on && 'text-primary-foreground')}>{c}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
