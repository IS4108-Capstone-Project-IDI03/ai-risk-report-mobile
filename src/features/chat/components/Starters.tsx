// An empty conversation (MB-06 AC1): what the chat is for, then starter
// questions to tap, so an engineer can try it without typing on site.
import { BookOpen, MessageCircle } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { STARTERS } from '../starters'

export function Starters({ onAsk }: { onAsk(question: string): void }) {
  return (
    <View className="gap-5 py-4">
      <View className="items-center gap-3 px-6">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-info">
          <MessageCircle color="#2c5488" size={26} />
        </View>
        <Text className="text-center text-lg font-semibold">Ask about standards and past reports</Text>
        <Text className="text-center text-muted-foreground">
          Answers cite the passages they come from. Tap a number to read the source.
        </Text>
      </View>
      <View className="gap-2">
        {STARTERS.map((s) => (
          <Pressable
            key={s.label}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            onPress={() => onAsk(s.question)}
            className="min-h-14 flex-row items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 active:bg-muted"
          >
            <BookOpen color="#2c5488" size={18} />
            <Text className="flex-1 font-medium">{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
