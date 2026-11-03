// A photo or handwritten page at full width in an observation's detail (MB-11
// AC3). Loaded from the gateway, or from the phone while it waits (MB-10). When
// it can't load, it says why instead of leaving a blank box (AC6).
import { useState } from 'react'
import { Image, Pressable } from 'react-native'
import { Text } from '@/components/ui/text'
import { useOffline } from '@/features/offline/provider'
import { mediaUri } from '../format'

export function MediaImage({ url, testID, label }: { url: string; testID: string; label: string }) {
  const [failed, setFailed] = useState(false)
  const { offline } = useOffline()
  if (failed) {
    // Tap to try again: the signal may be back while the screen stays open.
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try loading the image again"
        onPress={() => setFailed(false)}
        className="aspect-[4/3] w-full items-center justify-center gap-1 rounded-md bg-muted"
      >
        <Text className="text-sm text-muted-foreground">{offline ? 'Not available offline' : "Couldn't load this image"}</Text>
        <Text className="text-sm font-medium text-primary">Tap to try again</Text>
      </Pressable>
    )
  }
  return (
    <Image
      testID={testID}
      accessibilityLabel={label}
      source={{ uri: mediaUri(url) }}
      onError={() => setFailed(true)}
      resizeMode="contain"
      className="aspect-[4/3] w-full rounded-md bg-muted"
    />
  )
}
