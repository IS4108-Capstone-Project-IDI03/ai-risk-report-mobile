// The stage as one line (MB-20, web AS-06): "Capture · stage 3 of 8" and eight dots, the
// stages done filled, this one ringed, the rest empty. Called by OverviewCard.
import { View } from 'react-native'
import { Text } from '@/components/ui/text'

type Props = { label: string; index: number }

// The eight stage dots: done filled, this one ringed, the rest empty.
export function StageDots({ index }: { index: number }) {
  const size = 'h-2.5 w-2.5'
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="flex-row gap-1">
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} className={i < index ? `${size} rounded-full bg-primary` : i === index ? `${size} rounded-full border-2 border-primary` : `${size} rounded-full border border-border`} />
      ))}
    </View>
  )
}

export function StageLine({ label, index }: Props) {
  return (
    <View accessible accessibilityLabel={`${label}, stage ${index + 1} of 8`} className="flex-row items-center justify-between gap-3">
      <Text className="font-semibold">{`${label} · stage ${index + 1} of 8`}</Text>
      <StageDots index={index} />
    </View>
  )
}
