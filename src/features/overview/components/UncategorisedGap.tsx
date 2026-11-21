// The "Uncategorised Observations" gap in the Overview sheet (MB-20): the gap's own line, then the
// observations with no category, one tappable row each (its title and where it was found), so
// "2 with no category" takes you to those two. The gateway's gap names no observations, but the phone
// holds them all (the workspace list), so they are listed here and the main list is left as it is.
// Called by OverviewSheet.
import { ChevronRight, Tag } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { observationTitle, type Observation } from '@/features/observations/format'
import type { SummaryItem } from '../api'
import { WEIGHT_COLOR } from '../format'
import type { Target } from '../format'

type Props = { item: SummaryItem; observations: Observation[]; onGo(target: Target): void }

// Where an observation was found: "Block A · Basement 2 · block a".
const place = (o: Observation) => [o.location?.building, o.location?.floor, o.location?.name].filter(Boolean).join(' · ') || 'No location'

export function UncategorisedGap({ item, observations, onGo }: Props) {
  const color = WEIGHT_COLOR.gap
  return (
    <View className="py-2">
      <View className="min-h-[52px] flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1a` }}>
          <Tag color={color} size={16} />
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-sm font-semibold">{item.title}</Text>
          <Text numberOfLines={2} className="text-sm text-muted-foreground">{item.detail}</Text>
        </View>
      </View>
      <View className="ml-11">
        {observations.map((o) => (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityLabel={`${observationTitle(o)}, ${place(o)}`}
            onPress={() => onGo({ kind: 'observation', id: o.id })}
            className="min-h-12 flex-row items-center gap-2 border-t border-border py-2 active:bg-muted"
          >
            <View className="flex-1">
              <Text numberOfLines={1} className="text-sm font-semibold">{observationTitle(o)}</Text>
              <Text numberOfLines={1} className="text-xs text-muted-foreground">{place(o)}</Text>
            </View>
            <ChevronRight color="#545e6b" size={18} />
          </Pressable>
        ))}
      </View>
    </View>
  )
}
