// The checklist cards of MarshBot's chat (MB-20): "answered of total", then one bar per area that needs more
// (the Overview's AreaBar, which opens the checklist). A `checklist` card also lists the first items of each gap,
// "+N more", and the areas that are fine. Called by CardView.
import { CircleCheck } from 'lucide-react-native'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { AreaBar } from '@/features/overview/components/AreaBar'
import type { ItemLink } from '@/features/overview/api'
import type { Target } from '@/features/overview/format'
import { targetOf } from '@/features/overview/format'
import type { Card } from '../types'

type Props = { card: Extract<Card, { type: 'checklist' | 'bars' }>; onGo(target: Target): void }

export function AreaCard({ card, onGo }: Props) {
  // Both card types list areas; only a checklist card's gaps also carry their first items and a "more" count.
  const areas: { area: string; covered: number; total: number; link: ItemLink; items?: string[]; more?: number }[] = card.type === 'bars' ? card.areas : card.gaps
  return (
    <View testID={`card-${card.id}`} className="rounded-2xl border border-border bg-card px-4 py-3">
      <View className="flex-row items-center justify-between pb-1">
        <Text className="font-semibold">Checklist</Text>
        <Text className="text-sm tabular-nums text-muted-foreground">{`${card.answered} of ${card.total}`}</Text>
      </View>
      {areas.map((a) => (
        <View key={a.area}>
          <AreaBar area={a} onPress={() => onGo(targetOf(a.link))} />
          {a.items?.map((item) => <Text key={item} className="pl-2 text-sm text-muted-foreground">{`• ${item}`}</Text>)}
          {!!a.more && a.more > 0 && <Text className="pl-2 text-sm text-muted-foreground">{`+${a.more} more`}</Text>}
        </View>
      ))}
      {card.type === 'checklist' &&
        card.fine.map((t) => (
          <View key={t.title} className="flex-row items-center gap-2 pt-2">
            <CircleCheck color="#2f7049" size={18} />
            <Text className="text-sm">{t.title}</Text>
            {t.detail && <Text className="text-sm text-muted-foreground">{t.detail}</Text>}
          </View>
        ))}
    </View>
  )
}
