// The top of MarshBot's chat (MB-20): the status pill (an icon and a few words, red / amber / green / blue as the
// gateway says), a Summary button (the Overview sheet), the stage with its eight segments, and the three facts.
// It takes a quarter of a phone's height, so the screen drops all of it while the reader scrolls the chat (`hidden`).
// Called by screens/Assistant.
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Glance } from '@/features/overview/components/Glance'
import { GatewayIcon } from '@/features/overview/icons'
import { Segments } from '@/features/overview/components/OverviewButton'
import { PILL, stageIndex, stageLabel } from '../format'
import type { Thread } from '../types'

// The Summary button: back to the workspace with the Overview sheet open. Also shown with no conversation to draw, so the
// sheet's own explanation (archived, no signal) is still one tap away.
export function SummaryButton({ onPress }: { onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Summary" onPress={onPress} className="min-h-12 justify-center px-2 active:opacity-70">
      <Text className="font-semibold text-primary">Summary</Text>
    </Pressable>
  )
}

type Props = { thread: Thread; hidden: boolean; onSummary(): void }

export function StatusLine({ thread, hidden, onSummary }: Props) {
  if (hidden) return null
  const pill = PILL[thread.status.tone] ?? PILL.blue
  const index = stageIndex(thread.stage)
  return (
    <View className="gap-3 border-b border-border bg-card px-4 pb-3 pt-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="shrink flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: pill.bg }}>
          <GatewayIcon name={thread.status.icon} color={pill.fg} size={16} />
          <Text className="shrink text-sm font-medium" style={{ color: pill.fg }}>{thread.status.text}</Text>
        </View>
        <SummaryButton onPress={onSummary} />
      </View>
      <View className="gap-2">
        <Text className="font-semibold">{`${stageLabel(thread.stage)} · stage ${index + 1} of 8`}</Text>
        <Segments index={index} />
      </View>
      <Glance facts={thread.glance} />
    </View>
  )
}
