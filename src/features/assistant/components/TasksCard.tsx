// The "To do" card of MarshBot's chat (MB-20): its title, "N of M done" and its rows. Called by CardView.
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { Target } from '@/features/overview/format'
import type { Card } from '../types'
import { Row } from './Row'

type Props = { card: Extract<Card, { type: 'tasks' }>; onGo(target: Target): void }

export function TasksCard({ card, onGo }: Props) {
  return (
    <View testID={`card-${card.id}`} className="rounded-2xl border border-border bg-card px-4 pt-3">
      <View className="flex-row items-center justify-between pb-2">
        <Text className="font-semibold">{card.title}</Text>
        <Text className="text-sm tabular-nums text-muted-foreground">{`${card.done} of ${card.total} done`}</Text>
      </View>
      {card.rows.map((r) => (
        <Row key={r.id} row={r} onGo={onGo} />
      ))}
    </View>
  )
}
