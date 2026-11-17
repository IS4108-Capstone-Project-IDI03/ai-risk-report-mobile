// The review's location chooser (MB-16 AC21, AC22): All locations, No location yet, and each place
// with how many observations are there. A place the AI proposed or I added (not one the assessment
// already has) also offers Rename, Same as… and Delete. The foot opens Add location, All photos, All
// handwritten pages and the Deleted list. Opened from WalkReview. Plain taps; the screen does the work.
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { locationLabel } from '@/features/locations/locations'
import type { Proposal } from '../api'
import { ALL, NEEDS_LOCATION, observationsAt, orderedLocations } from '../proposal'
import { Choice } from './Choice'
import { Sheet } from './Sheet'

type Props = {
  proposal: Proposal
  selected: string
  onPick(ref: string): void
  onAdd(): void
  onRename(ref: string): void
  onSameAs(ref: string): void
  onDelete(ref: string): void
  onPhotos(): void
  onPages(): void
  onDeleted(): void
  onClose(): void
}

export function PlaceSheet({ proposal: p, selected, onPick, onAdd, onRename, onSameAs, onDelete, onPhotos, onPages, onDeleted, onClose }: Props) {
  const count = (ref: string) => String(observationsAt(p, ref).length)
  const needs = p.observations.some((o) => !o.locationRef)
  return (
    <Sheet title="Locations" testID="place-sheet" onClose={onClose}>
      <Choice label="All locations" hint={count(ALL)} on={selected === ALL} onPress={() => onPick(ALL)} />
      {needs && <Choice label="No location yet" hint={count(NEEDS_LOCATION)} on={selected === NEEDS_LOCATION} onPress={() => onPick(NEEDS_LOCATION)} />}
      {orderedLocations(p).map((ref) => {
        const l = p.locations.find((x) => x.ref === ref)!
        return (
          <View key={ref} className="gap-2">
            <Choice label={locationLabel(l)} hint={count(ref)} on={selected === ref} onPress={() => onPick(ref)} />
            {/* Only a place that is just in this proposal can be changed; the assessment's own can't. */}
            {!l.existingId && (
              <View className="flex-row gap-2">
                <Button variant="outline" accessibilityLabel={`Rename ${l.name}`} onPress={() => onRename(ref)} className="flex-1"><Text>Rename</Text></Button>
                <Button variant="outline" accessibilityLabel={`Same as… ${l.name}`} onPress={() => onSameAs(ref)} className="flex-1"><Text>Same as…</Text></Button>
                <Button variant="outline" accessibilityLabel={`Delete ${l.name}`} onPress={() => onDelete(ref)} className="flex-1"><Text className="text-destructive">Delete</Text></Button>
              </View>
            )}
          </View>
        )
      })}
      <View className="mt-2 gap-2 border-t border-border pt-4">
        <Button variant="outline" size="lg" accessibilityLabel="Add location" onPress={onAdd}><Text>Add location</Text></Button>
        <Button variant="outline" size="lg" accessibilityLabel="All photos" onPress={onPhotos}><Text>All photos</Text></Button>
        <Button variant="outline" size="lg" accessibilityLabel="All handwritten pages" onPress={onPages}><Text>All handwritten pages</Text></Button>
        <Button variant="outline" size="lg" accessibilityLabel={`Deleted observations, ${p.removed?.length ?? 0}`} onPress={onDeleted}><Text>{`Deleted observations (${p.removed?.length ?? 0})`}</Text></Button>
      </View>
    </Sheet>
  )
}
