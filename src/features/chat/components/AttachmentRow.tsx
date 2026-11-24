// What is attached to the question being written (MB-24), as ChatGPT draws it: one row that scrolls
// sideways, a 64pt thumbnail for each photo and a small card for each PDF (icon, name, pages), each with a
// round x at its corner to remove it. Under the row: the faces choice for a photo that has faces, and a
// warning for a PDF that holds instructions. The x is read out as "Remove photo 1" / "Remove <name>" and
// has a 48pt target (hitSlop). Called by Composer.
import { FileText, X } from 'lucide-react-native'
import { Image, Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import type { PdfUpload } from '../api'
import { shownUri, type PhotoItem } from '../useAttachments'

type Props = {
  photos: PhotoItem[]
  pdfs: PdfUpload[]
  onRemovePhoto(p: PhotoItem): void
  onRemovePdf(p: PdfUpload): void
  onBlur(id: string, blur: boolean): void
}

// "1 page", "3 pages".
const pages = (n: number) => (n === 1 ? '1 page' : `${n} pages`)

// The round x on a corner of a thumbnail or card.
function RemoveButton({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      onPress={onPress}
      className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-foreground active:opacity-70"
    >
      <X color="#ffffff" size={14} strokeWidth={3} />
    </Pressable>
  )
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn('h-12 justify-center rounded-full border px-4 active:opacity-70', selected ? 'border-primary bg-primary' : 'border-border bg-card')}
    >
      <Text className={cn('text-sm font-semibold', selected && 'text-white')}>{label}</Text>
    </Pressable>
  )
}

export function AttachmentRow({ photos, pdfs, onRemovePhoto, onRemovePdf, onBlur }: Props) {
  if (!photos.length && !pdfs.length) return null
  return (
    <View className="gap-2">
      {/* Room at the top and right for the x, which sits half outside its thumbnail. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-3 pr-2 pt-2">
        {photos.map((p, i) => (
          <View key={p.id}>
            <Image accessibilityLabel={`Photo ${i + 1}`} source={{ uri: shownUri(p) }} resizeMode="cover" className="h-16 w-16 rounded-xl bg-muted" />
            <RemoveButton label={`Remove photo ${i + 1}`} onPress={() => onRemovePhoto(p)} />
          </View>
        ))}
        {pdfs.map((f) => (
          <View key={f.id}>
            <View className="h-16 w-52 flex-row items-center gap-3 rounded-xl bg-secondary px-3">
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <FileText color="#ffffff" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold" numberOfLines={1}>{f.name}</Text>
                <Text className="text-xs text-muted-foreground">{pages(f.pages)}</Text>
              </View>
            </View>
            <RemoveButton label={`Remove ${f.name}`} onPress={() => onRemovePdf(f)} />
          </View>
        ))}
      </ScrollView>
      {photos.map(
        (p, i) =>
          p.faces > 0 && (
            <View key={p.id} className="gap-1">
              <Text className="px-1 text-sm">
                <Text className="text-sm text-muted-foreground">{`Photo ${i + 1}: `}</Text>
                <Text className="text-sm font-medium">{p.faces === 1 ? '1 face found' : `${p.faces} faces found`}</Text>
              </Text>
              <View className="flex-row gap-2">
                <Choice label="Blur faces" selected={p.blur} onPress={() => onBlur(p.id, true)} />
                <Choice label="Send as is" selected={!p.blur} onPress={() => onBlur(p.id, false)} />
              </View>
            </View>
          ),
      )}
      {pdfs.map((f) => f.flagged && <Text key={f.id} className="px-1 text-sm text-destructive">This PDF has text that gives instructions. It will be read as plain text.</Text>)}
    </View>
  )
}
