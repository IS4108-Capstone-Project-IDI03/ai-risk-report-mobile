// "Same as…" (MB-16 AC21): pick the assessment's own place that a new place really is. Its
// observations move there and the new place is dropped. Opened from WalkReview.
import { Text } from '@/components/ui/text'
import { groupLocations, locationLabel, type Location } from '@/features/locations/locations'
import { Choice } from './Choice'
import { Sheet } from './Sheet'

type Props = { name: string; existing: Location[]; onPick(l: Location): void; onClose(): void }

export function SamePlaceSheet({ name, existing, onPick, onClose }: Props) {
  const ordered = groupLocations(existing).flatMap((g) => g.levels.flatMap((level) => level.locations))
  return (
    <Sheet title="Same as an existing location" testID="same-sheet" onClose={onClose}>
      <Text className="text-muted-foreground">{`Pick the assessment location that “${name}” really is. Its observations move there.`}</Text>
      {ordered.length ? ordered.map((l) => <Choice key={l.id} label={locationLabel(l)} onPress={() => onPick(l)} />) : <Text className="text-muted-foreground">The assessment has no locations yet.</Text>}
    </Sheet>
  )
}
