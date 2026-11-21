// One turn of the conversation (MB-20): MarshBot's on the left (its name, the time, a bubble for what it says, then its
// cards at full width) and the engineer's on the right, in the Chatbot tab's blue-grey bubble. Each turn is drawn as its
// `says` then its `cards`; the AI-worded `program` is ignored (the web draws the same when a turn has none).
// Called by screens/Assistant.
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { Target } from '@/features/overview/format'
import { timeOf } from '../format'
import type { Say, Turn } from '../types'
import { CardView } from './CardView'

// How a line reads: the lead line is bold, an alert is red, good news green.
const SAY: Partial<Record<Say['tone'], string>> = { lead: 'font-semibold', alert: 'font-medium text-destructive', good: 'text-[#2f7049]' }

export function Bubble({ turn, onGo }: { turn: Turn; onGo(target: Target): void }) {
  if (turn.who === 'engineer')
    return (
      <View testID={`turn-${turn.id}`} className="max-w-[85%] self-end rounded-xl bg-secondary px-3.5 py-2.5">
        <Text>{turn.says[0]?.text}</Text>
      </View>
    )
  return (
    <View testID={`turn-${turn.id}`} className="gap-2">
      <View className="flex-row items-baseline gap-2">
        <Text className="text-sm font-semibold text-primary">MarshBot</Text>
        <Text className="text-xs tabular-nums text-muted-foreground">{timeOf(turn.at)}</Text>
      </View>
      {turn.says.length > 0 && (
        <View className="gap-2 self-start rounded-xl border border-border bg-card px-3.5 py-3">
          {turn.says.map((s, i) => (
            <Text key={i} className={SAY[s.tone]}>
              {s.text}
            </Text>
          ))}
        </View>
      )}
      {turn.cards.map((c) => (
        <CardView key={c.id} card={c} onGo={onGo} />
      ))}
    </View>
  )
}
