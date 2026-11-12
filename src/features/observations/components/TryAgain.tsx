// "Try again" under a transcript that failed (MB-12 AC27). One paid AI call per tap, so it
// is never automatic. Greyed with the reason when there is no signal. Used by VoiceNote and
// PageEntry; the screen (ObservationDetail) owns the request.
import { RotateCcw } from 'lucide-react-native'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

export type Retry = { run(): void; disabled: boolean; offline: boolean }

export function TryAgain({ label, retry }: { label: string; retry: Retry }) {
  return (
    <View className="items-start gap-1">
      <Button variant="outline" accessibilityLabel={`Try again: ${label}`} disabled={retry.disabled} onPress={retry.run}>
        <RotateCcw color="#1a1f26" size={16} />
        <Text>Try again</Text>
      </Button>
      {retry.offline && <Text className="text-sm text-muted-foreground">Connect to try again.</Text>}
    </View>
  )
}
