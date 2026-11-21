// One checklist area that needs more (MB-20, web AS-06): its name, "1 of 4", and a bar of how
// much is covered. Tapping opens the checklist. Called by OverviewCard.
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { Summary } from '../api'

type Props = { area: Summary['areas'][number]; onPress(): void }

export function AreaBar({ area, onPress }: Props) {
  const share = area.total ? Math.round((area.covered / area.total) * 100) : 0
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${area.area}, ${area.covered} of ${area.total} covered`}
      onPress={onPress}
      className="min-h-12 justify-center gap-1.5 py-2 active:bg-muted"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold">{area.area}</Text>
        <Text className="text-sm tabular-nums text-muted-foreground">{`${area.covered} of ${area.total}`}</Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-muted">
        <View className="h-1.5 rounded-full" style={{ width: `${share}%`, backgroundColor: area.covered ? '#8f5f13' : '#ad2e2d' }} />
      </View>
    </Pressable>
  )
}
