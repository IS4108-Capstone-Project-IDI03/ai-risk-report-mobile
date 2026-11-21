// A card the first version of the chat does not draw in full (MB-20): the report outline, the review lanes and the
// time spent per stage. Its title and note, then where to see the rest. Called by CardView.
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { Card } from '../types'

type Props = { card: Extract<Card, { type: 'outline' | 'lanes' | 'stage-time' }> }

export function PlainCard({ card }: Props) {
  const note = card.note ?? card.lead
  return (
    <View testID={`card-${card.id}`} className="gap-1 rounded-2xl border border-border bg-card p-4">
      <Text className="font-semibold">{card.title}</Text>
      {note && <Text className="text-sm text-muted-foreground">{note}</Text>}
      <Text className="text-sm text-muted-foreground">See the detail on the web.</Text>
    </View>
  )
}
