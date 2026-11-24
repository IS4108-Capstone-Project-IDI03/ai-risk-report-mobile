// My question as a bubble (MB-06), with what was sent beside it (MB-24): its photos and PDF chips above
// the words. A saved chat's photos come from the gateway behind the session cookie. Called by screens/Chat.
import { FileText } from 'lucide-react-native'
import { Image, View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { Turn } from '../useConversation'

export function MyMessage({ turn }: { turn: Extract<Turn, { role: 'user' }> }) {
  return (
    // A quiet bubble in Marsh light blue, as on the web (chat.css, ink-50).
    <View testID="my-message" className="max-w-[85%] gap-2 self-end rounded-xl bg-secondary px-3.5 py-2.5">
      {turn.photos?.map((p, i) => (
        <Image key={i} accessibilityLabel={`Photo ${i + 1}`} source={{ uri: p.uri }} resizeMode="cover" className="h-40 w-52 rounded-md bg-muted" />
      ))}
      {turn.pdfs?.map((f) => (
        <View key={f.id} className="flex-row items-center gap-2">
          <FileText color="#2c5488" size={18} />
          <Text className="flex-shrink font-medium" numberOfLines={1}>{f.name}</Text>
        </View>
      ))}
      <Text className="text-base leading-6">{turn.text}</Text>
    </View>
  )
}
