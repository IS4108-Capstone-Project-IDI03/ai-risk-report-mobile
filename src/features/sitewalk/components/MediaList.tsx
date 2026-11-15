// All photos, or all handwritten pages, of a proposal's live observations (MB-16 AC30): each with
// its place, note and category, and Go to observation. Deleted observations' files are left out, as
// on the web. Shown by screens/WalkReview in place of the list.
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { MediaImage } from '@/features/observations/components/MediaImage'
import type { Proposal, SiteWalk } from '../api'
import { ALL, placeName, sectionsAt } from '../proposal'
import { filesOf } from './ObservationMedia'

type Props = { kind: 'photos' | 'pages'; proposal: Proposal; walk: SiteWalk; onOpen(ref: string): void }

export function MediaList({ kind, proposal: p, walk, onOpen }: Props) {
  const photos = kind === 'photos'
  const rows = sectionsAt(p, ALL)
    .flatMap((s) => s.items)
    .flatMap((o) => filesOf(o, walk)[kind].map((f) => ({ o, f })))
  const places = new Set(rows.map((r) => r.o.locationRef)).size
  return (
    <View testID={`${kind}-screen`} className="gap-4">
      {rows.length === 0 ? (
        <View className="gap-1">
          <Text className="font-medium">{photos ? 'No photos yet' : 'No handwritten pages yet'}</Text>
          <Text className="text-muted-foreground">{photos ? 'Photos appear here once they are part of an observation.' : 'Pages appear here once they are added to an observation.'}</Text>
        </View>
      ) : (
        <Text className="text-sm text-muted-foreground">{`${rows.length} ${photos ? (rows.length === 1 ? 'photo' : 'photos') : rows.length === 1 ? 'page' : 'pages'} across ${places} ${places === 1 ? 'location' : 'locations'}`}</Text>
      )}
      {rows.map(({ o, f }) => (
        <View key={o.ref + f.id} className="gap-2 rounded-lg border border-border bg-card p-3">
          <MediaImage url={f.url} testID={`proposed-${photos ? 'photo' : 'page'}-${f.id}`} label={photos ? 'Photo from the walk' : 'Handwritten page'} />
          <Text className="text-sm text-muted-foreground">{placeName(p, o.locationRef)}</Text>
          <Text>{o.note.trim() || 'No note yet'}</Text>
          {o.copeDimension && <Text className="text-sm text-muted-foreground">{o.copeDimension}</Text>}
          <Button variant="outline" accessibilityLabel={`Go to observation: ${o.note.trim() || 'No note yet'}`} onPress={() => onOpen(o.ref)}>
            <Text>Go to observation</Text>
          </Button>
        </View>
      ))}
    </View>
  )
}
