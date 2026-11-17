// One handwritten page in the Scans list (MB-17 AC2): a small picture, what the gateway read (or
// where that stands: PageEntry's `reading`), and when and which observation it belongs to (time first,
// so a long name is what gets cut off, not the time). Used by screens/Scans. Tapping opens that
// observation's detail, where Read again and Try again are.
import { Image, Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { capturedAt, mediaUri, observationTitle, type Observation, type Page } from '../format'
import { reading } from './PageEntry'

export function ScanRow({ page, observation, onOpen }: { page: Page; observation: Observation; onOpen: () => void }) {
  return (
    <Pressable
      testID="scan-row"
      accessibilityRole="button"
      onPress={onOpen}
      className="min-h-[72px] flex-row gap-3 rounded-lg border border-border bg-card p-3"
    >
      <Image source={{ uri: mediaUri(page.url) }} accessibilityLabel="Handwritten page" resizeMode="cover" className="size-16 rounded-md bg-muted" />
      <View className="flex-1 gap-1">
        <Text className="text-base" numberOfLines={4}>
          {reading(page.transcription) ?? 'Waiting to upload'}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {capturedAt(observation.recordedAt)} · {observationTitle(observation)}
        </Text>
      </View>
    </Pressable>
  )
}
