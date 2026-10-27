// The capture sheet's VOICE NOTES section (MB-03 AC4): each voice note as a
// slim row like an audio attachment, then "Record voice note", which becomes
// the recording panel (timer and Stop) while recording.
import { Mic, X } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Eyebrow } from '@/components/Eyebrow'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { duration, type VoiceNote } from '../draft'
import { RecordingPanel } from './RecordingPanel'

type Props = {
  recordings: VoiceNote[]
  recording: boolean
  durationMillis: number
  onRecord(): void
  onStop(): void
  onRemove(index: number): void
}

export function VoiceNotesSection({ recordings, recording, durationMillis, onRecord, onStop, onRemove }: Props) {
  return (
    <View className="gap-2">
      <Eyebrow>{`Voice notes · ${recordings.length}`}</Eyebrow>
      {recordings.map((r, i) => (
        <View
          key={r.uri + i}
          testID="evidence-voice-note"
          className="h-14 flex-row items-center gap-3 rounded-lg border border-border bg-card pl-3"
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <Mic color="#2c5488" size={18} />
          </View>
          <Text className="flex-1 font-medium">{`Voice note ${i + 1}`}</Text>
          <Text className="font-mono text-sm text-muted-foreground">{duration(r.durationMillis)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove voice note"
            onPress={() => onRemove(i)}
            className="h-12 w-12 items-center justify-center rounded-md active:bg-muted"
          >
            <X color="#545e6b" size={20} />
          </Pressable>
        </View>
      ))}
      {recording ? (
        <RecordingPanel durationMillis={durationMillis} onStop={onStop} />
      ) : (
        <Button variant="secondary" size="lg" accessibilityLabel="Record voice note" onPress={onRecord}>
          <Mic color="#22406c" size={20} />
          <Text>Record voice note</Text>
        </Button>
      )}
    </View>
  )
}
