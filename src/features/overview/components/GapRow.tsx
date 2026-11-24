// One open item (MB-20, web AS-06): an icon tile tinted by how urgent it is, its title and one
// line of detail, and a way straight to it. One that points to a web-only tab is greyed and
// says so in words. A 60pt row, as the calendar's. Called by OverviewSheet.
import { ChevronRight } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { SummaryItem } from '../api'
import { GatewayIcon } from '../icons'
import { targetOf, WEB_ONLY, WEIGHT_COLOR, WEIGHT_LABEL, type Target } from '../format'

type Props = { item: SummaryItem; onGo(target: Target): void }

export function GapRow({ item, onGo }: Props) {
  const target = targetOf(item.link, item.id)
  const web = target.kind === 'web'
  const color = WEIGHT_COLOR[item.weight]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[WEIGHT_LABEL[item.weight], item.title, item.detail, web ? WEB_ONLY : null].filter(Boolean).join(', ')}
      accessibilityState={{ disabled: web }}
      disabled={web}
      onPress={() => onGo(target)}
      className="min-h-[60px] flex-row items-center gap-3 py-2 active:bg-muted"
      style={web ? { opacity: 0.6 } : undefined}
    >
      <View className="h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1a` }}>
        <GatewayIcon name={item.icon} color={color} size={16} />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-sm font-semibold">{item.title}</Text>
        <Text numberOfLines={2} className="text-sm text-muted-foreground">{web ? `${item.detail ? `${item.detail} · ` : ''}${WEB_ONLY}` : item.detail}</Text>
      </View>
      <Text className="shrink-0 text-xs font-semibold" style={{ color }}>{WEIGHT_LABEL[item.weight]}</Text>
      {!web && <ChevronRight color="#545e6b" size={18} />}
    </Pressable>
  )
}
