// One image section of the capture sheet (MB-03): PHOTOS or SCANNED NOTES. Shows
// what's been added as removable thumbnails, then an add tile that opens the
// camera, and a "From library" link for pictures taken earlier.
import { Camera, Images, X, type LucideIcon } from 'lucide-react-native'
import { Image, Pressable, ScrollView, View } from 'react-native'
import { Eyebrow } from '@/components/Eyebrow'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

type Props = {
  title: string // "Photos", "Scanned notes"
  uris: string[]
  testID: string // each thumbnail's, for tests
  addLabel: string // "Take photo", "Scan handwritten notes"
  libraryLabel: string // "Add photo from library"
  noun: string // "photo", "scan", for the remove buttons
  Icon?: LucideIcon
  onTake(): void
  onLibrary(): void
  onRemove(index: number): void
}

const SIZE = 88

export function ImageSection({ title, uris, testID, addLabel, libraryLabel, noun, Icon = Camera, onTake, onLibrary, onRemove }: Props) {
  return (
    <View className="gap-2">
      <Eyebrow>{`${title} · ${uris.length}`}</Eyebrow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2 pt-2">
        {uris.map((uri, i) => (
          <View key={uri + i} testID={testID}>
            <Image source={{ uri }} className="rounded-md bg-muted" style={{ width: SIZE, height: SIZE }} />
            {/* A 32px circle with a 48px hit area, for gloves. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${noun}`}
              onPress={() => onRemove(i)}
              hitSlop={8}
              className="absolute -right-2 -top-2 h-8 w-8 items-center justify-center rounded-full border border-border bg-card"
            >
              <X color="#1a1f26" size={16} />
            </Pressable>
          </View>
        ))}
        {/* The add tile sits where the next thumbnail goes. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          onPress={onTake}
          className="items-center justify-center gap-1 rounded-md border border-dashed border-primary bg-secondary active:bg-muted"
          style={{ width: uris.length ? SIZE : undefined, height: SIZE, paddingHorizontal: uris.length ? 0 : 20 }}
        >
          <Icon color="#2c5488" size={24} />
          <Text className="text-sm font-medium text-secondary-foreground">{uris.length ? 'Add' : addLabel}</Text>
        </Pressable>
      </ScrollView>
      <Button variant="link" accessibilityLabel={libraryLabel} onPress={onLibrary} className="h-12 self-start px-0">
        <Images color="#2c5488" size={16} />
        <Text className="text-sm">From library</Text>
      </Button>
    </View>
  )
}
