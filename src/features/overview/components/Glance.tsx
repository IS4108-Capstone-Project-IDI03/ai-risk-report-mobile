// "At a glance" (MB-20, web AS-06): the gateway's three facts as small tiles, each with an icon,
// a label and a value tinted amber, red or green as the gateway says. Called by OverviewCard.
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { Summary } from '../api'
import { GatewayIcon } from '../icons'
import { TONE_COLOR } from '../format'

export function Glance({ facts }: { facts: Summary['glance'] }) {
  return (
    <View className="flex-row gap-2">
      {facts.map((f) => (
          <View key={f.label} accessible accessibilityLabel={`${f.label}, ${f.value}`} className="flex-1 gap-1 rounded-md border border-border p-2">
            <GatewayIcon name={f.icon} color="#545e6b" size={16} />
            <Text className="text-xs text-muted-foreground">{f.label}</Text>
            <Text className="text-sm font-semibold" style={{ color: TONE_COLOR[f.tone] }}>{f.value}</Text>
          </View>
      ))}
    </View>
  )
}
