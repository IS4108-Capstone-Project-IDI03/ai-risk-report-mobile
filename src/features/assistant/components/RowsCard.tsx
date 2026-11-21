// A card of rows (MB-20): a title, an optional note, the rows, the tick cells (things in order, with their own
// small bar) and one call to action that opens its link. Called by CardView.
import { CircleCheck } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { targetOf, WEB_ONLY, type Target } from '@/features/overview/format'
import type { Card } from '../types'
import { Row } from './Row'

type Props = { card: Extract<Card, { type: 'rows' }>; onGo(target: Target): void }

export function RowsCard({ card, onGo }: Props) {
  const cta = card.cta && { ...card.cta, target: targetOf(card.cta.link) }
  const web = cta?.target.kind === 'web'
  return (
    <View testID={`card-${card.id}`} className="rounded-2xl border border-border bg-card px-4 pt-3">
      <Text className="font-semibold">{card.title}</Text>
      {card.note && <Text className="pb-2 text-sm text-muted-foreground">{card.note}</Text>}
      {card.rows.map((r) => (
        <Row key={r.id} row={r} onGo={onGo} />
      ))}
      {card.ticks.map((t) => (
        <View key={t.title} className="flex-row items-center gap-3 border-t border-border py-3">
          <CircleCheck color="#2f7049" size={20} />
          <View className="flex-1">
            <Text className="font-semibold">{t.title}</Text>
            {t.detail && <Text className="text-sm text-muted-foreground">{t.detail}</Text>}
          </View>
        </View>
      ))}
      {cta && (
        <View className="border-t border-border py-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cta.label}
            disabled={web}
            onPress={() => onGo(cta.target)}
            className={`min-h-12 items-center justify-center rounded-full bg-primary px-4 active:opacity-80 ${web ? 'opacity-50' : ''}`}
          >
            <Text className="font-semibold text-primary-foreground">{cta.label}</Text>
          </Pressable>
          {web && <Text className="pt-1 text-sm text-muted-foreground">{WEB_ONLY}</Text>}
        </View>
      )}
    </View>
  )
}
