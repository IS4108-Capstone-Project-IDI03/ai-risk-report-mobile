// Shown while a voice note records (MB-03 AC4): a large running timer and one
// big Stop button, easy to hit with gloves. Stopping keeps the recording; it
// can be removed from the sheet afterwards.
import { Square } from 'lucide-react-native'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { duration } from '../draft'

export function RecordingPanel({ durationMillis, onStop }: { durationMillis: number; onStop(): void }) {
  return (
    <View className="gap-5 rounded-lg border border-border bg-card p-6" accessibilityLiveRegion="polite">
      <View className="flex-row items-center justify-center gap-3">
        <View className="h-3 w-3 rounded-full bg-destructive" />
        <Text className="text-base font-medium">Recording…</Text>
      </View>
      <Text className="text-center font-mono text-5xl">{duration(durationMillis)}</Text>
      <Button variant="destructive" size="lg" accessibilityLabel="Stop recording" onPress={onStop}>
        <Square color="#ffffff" fill="#ffffff" size={18} />
        <Text>Stop</Text>
      </Button>
    </View>
  )
}
