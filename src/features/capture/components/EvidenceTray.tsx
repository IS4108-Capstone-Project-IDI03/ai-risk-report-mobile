// The capture sheet's Evidence tray (MB-07 AC10): every photo, voice note and
// scan added so far, in one scrolling row, each with a remove button. Replaces
// MB-03's three separate sections. Used by screens/CaptureSheet.
import { Mic, X } from 'lucide-react-native'
import { Image, Pressable, ScrollView, View } from 'react-native'
import { Eyebrow } from '@/components/Eyebrow'
import { Text } from '@/components/ui/text'
import { duration, type Draft } from '../draft'

type ListKey = 'photos' | 'pages' | 'recordings'
type Props = { draft: Draft; onRemove(key: ListKey, index: number): void }

const SIZE = 84

export function EvidenceTray({ draft, onRemove }: Props) {
  const count = draft.photos.length + draft.recordings.length + draft.pages.length
  return (
    <View className="gap-2">
      <Eyebrow>{`Evidence · ${count}`}</Eyebrow>
      {count === 0 ? (
        <Text className="rounded-lg border border-dashed border-input p-4 text-center text-sm text-muted-foreground">
          Nothing added yet. Take a photo, record a voice note or scan a page with the buttons below.
        </Text>
      ) : (
        // pt-2 and pr-2 leave room for the remove buttons, which overhang each tile.
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-2 pt-2">
          {draft.photos.map((uri, i) => (
            <Tile key={`photo-${i}-${uri}`} testID="evidence-photo" label="Remove photo" onRemove={() => onRemove('photos', i)}>
              <Image source={{ uri }} className="rounded-sm bg-muted" style={{ width: SIZE, height: SIZE }} />
            </Tile>
          ))}
          {draft.recordings.map((r, i) => (
            <Tile key={`voice-${i}-${r.uri}`} testID="evidence-voice-note" label="Remove voice note" onRemove={() => onRemove('recordings', i)}>
              <View className="items-center justify-center gap-1 rounded-sm bg-secondary" style={{ width: SIZE, height: SIZE }}>
                <Mic color="#2c5488" size={20} />
                <Text className="text-xs font-medium text-secondary-foreground">{`Voice note ${i + 1}`}</Text>
                <Text className="tabular-nums text-xs text-secondary-foreground">{duration(r.durationMillis)}</Text>
              </View>
            </Tile>
          ))}
          {/* Handwritten pages: transcribed by the gateway (CP-19), bordered so they don't read as site photos. */}
          {draft.pages.map((uri, i) => (
            <Tile key={`page-${i}-${uri}`} testID="evidence-page" label="Remove scan" onRemove={() => onRemove('pages', i)}>
              <Image source={{ uri }} className="rounded-sm border-2 border-input bg-card" style={{ width: SIZE, height: SIZE }} />
            </Tile>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

type TileProps = { testID: string; label: string; onRemove(): void; children: React.ReactNode }

function Tile({ testID, label, onRemove, children }: TileProps) {
  return (
    <View testID={testID}>
      {children}
      {/* A 32px circle with a 48px hit area, for gloves. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onRemove}
        hitSlop={8}
        className="absolute -right-2 -top-2 h-8 w-8 items-center justify-center rounded-full border border-border bg-card"
      >
        <X color="#1a1f26" size={16} />
      </Pressable>
    </View>
  )
}
