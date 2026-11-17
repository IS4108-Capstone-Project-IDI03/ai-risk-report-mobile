// Add a place to the proposal, or rename one the proposal added (MB-16 AC20, AC21). It is the picker's
// Add location form (MB-02) without the GPS pin; a refusal ("already in the proposal") is thrown
// back to the form, which shows it above Save. Opened from WalkReview.
import { AddLocationForm } from '@/features/locations/components/AddLocationForm'
import type { Location } from '@/features/locations/locations'
import { Sheet } from './Sheet'

type Props = {
  title: string
  // The places the form suggests building and level names from.
  known: Location[]
  initial?: { building: string; floor: string; name: string }
  // Throws the reason when the place can't be saved.
  onSave(details: { building: string; floor: string; name: string }): void
  onClose(): void
}

export function LocationSheet({ title, known, initial, onSave, onClose }: Props) {
  return (
    <Sheet title={title} testID="location-sheet" onClose={onClose}>
      <AddLocationForm locations={known} initial={initial} withPin={false} onSave={async (d) => onSave(d)} />
    </Sheet>
  )
}
