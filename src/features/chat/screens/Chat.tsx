// Chatbot tab (MB-01). A placeholder: asking the knowledge base (the gateway's
// POST /api/chat, a paid LLM call) is its own story, after capture. Nothing
// here calls the gateway.
import { MessageCircle } from 'lucide-react-native'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'

export default function Chat() {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-info">
        <MessageCircle color="#2c5488" size={28} />
      </View>
      <Text className="text-xl font-semibold">Ask the knowledge base</Text>
      {/* Design system: an empty state states the cause, then the trigger. */}
      <Text className="text-center text-muted-foreground">
        Cited answers from standards and past reports arrive in a later update. Until then, use
        the chatbot in the web app.
      </Text>
    </View>
  )
}
