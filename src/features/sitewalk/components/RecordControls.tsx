// The recorder's buttons and clock (MB-16 AC6, AC32): Record; while recording, Pause (or Resume) and
// Stop; and Photo. "0:42 of 20:00" shows the part against its cap, with a one-minute warning. Used by
// screens/WalkRecording, which owns the recorder (capture/useVoiceNote).
import { Camera, Mic, Pause, Play, Square } from 'lucide-react-native'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { duration } from '@/features/capture/draft'

// A part stops by itself at 20 minutes (useVoiceNote); this warns a minute before.
const CAP_MILLIS = 20 * 60 * 1000
const WARN_MILLIS = 19 * 60 * 1000

type Props = { recording: boolean; paused: boolean; millis: number; onRecord(): void; onPause(): void; onResume(): void; onStop(): void; onPhoto(): void }

export function RecordControls({ recording, paused, millis, onRecord, onPause, onResume, onStop, onPhoto }: Props) {
  return (
    <View className="gap-3">
      {recording && (
        <View className="items-center">
          <Text className="text-3xl font-semibold tabular-nums">{`${duration(millis)} of ${duration(CAP_MILLIS)}`}</Text>
          <Text className={paused ? 'font-medium text-warning-foreground' : 'font-medium text-destructive'}>{paused ? 'Recording paused' : 'Recording'}</Text>
        </View>
      )}
      {/* While recording, Pause or Resume and Stop share a row, and Photo has its own below: three side by side
          left Resume ("Resum" over a cut-off "e") too narrow on a phone. Not recording: Record and Photo. */}
      {recording ? (
        <>
          <View className="flex-row gap-3">
            <Button size="lg" variant="outline" accessibilityLabel={paused ? 'Resume recording' : 'Pause recording'} onPress={paused ? onResume : onPause} className="flex-1">
              {paused ? <Play color="#1a1f26" size={18} /> : <Pause color="#1a1f26" size={18} />}
              <Text className="text-lg">{paused ? 'Resume' : 'Pause'}</Text>
            </Button>
            <Button size="lg" accessibilityLabel="Stop recording" onPress={onStop} className="flex-1 bg-destructive">
              <Square color="#ffffff" size={18} />
              <Text className="text-lg">Stop</Text>
            </Button>
          </View>
          <Button size="lg" variant="outline" accessibilityLabel="Take photo" onPress={onPhoto}>
            <Camera color="#1a1f26" size={20} />
            <Text className="text-lg">Photo</Text>
          </Button>
        </>
      ) : (
        <View className="flex-row gap-3">
          <Button size="lg" accessibilityLabel="Record" onPress={onRecord} className="flex-1">
            <Mic color="#ffffff" size={20} />
            <Text className="text-lg">Record</Text>
          </Button>
          <Button size="lg" variant="outline" accessibilityLabel="Take photo" onPress={onPhoto}>
            <Camera color="#1a1f26" size={20} />
            <Text className="text-lg">Photo</Text>
          </Button>
        </View>
      )}
      {recording && millis >= WARN_MILLIS && <Text className="font-medium text-warning-foreground">Under a minute left in this part.</Text>}
    </View>
  )
}
