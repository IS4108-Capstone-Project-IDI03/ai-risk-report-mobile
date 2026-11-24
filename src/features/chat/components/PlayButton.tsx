// Play under an answer (MB-25): reads it aloud with the phone's voice. While it reads, Pause (then Resume)
// and Stop. Each is an icon with its word, on a 48pt target. Hidden when the phone has no voice, or the
// answer has no words yet. Called by AnswerView.
import { Pause, Play, Square, Volume2 } from 'lucide-react-native'
import { Platform, Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { useHasVoice, useReadAloud } from '../useReadAloud'

function Action({ label, word, Icon, onPress }: { label: string; word: string; Icon: typeof Play; onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="h-12 flex-row items-center gap-1.5 pr-3 active:opacity-70">
      <Icon color="#2c5488" size={18} />
      <Text className="font-semibold text-primary">{word}</Text>
    </Pressable>
  )
}

export function PlayButton({ id, text }: { id: string; text: string }) {
  const has = useHasVoice()
  const read = useReadAloud(id, text)
  if (!has || !text) return null
  if (!read.reading) return <View className="flex-row"><Action label="Play answer" word="Play" Icon={Volume2} onPress={read.play} /></View>
  return (
    <View className="flex-row">
      {/* expo-speech cannot pause on Android: there it is Stop only. */}
      {Platform.OS !== 'android' &&
        (read.paused ? (
          <Action label="Resume answer" word="Resume" Icon={Play} onPress={read.resume} />
        ) : (
          <Action label="Pause answer" word="Pause" Icon={Pause} onPress={read.pause} />
        ))}
      <Action label="Stop answer" word="Stop" Icon={Square} onPress={read.stop} />
    </View>
  )
}
