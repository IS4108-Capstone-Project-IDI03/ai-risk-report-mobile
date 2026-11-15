// Edits one proposed observation (MB-16 AC14-AC17, AC28, AC31): its note, severity, category and
// location, with its files and the part of the recording it came from, Previous and Next through the
// list, and Delete. A page sheet over the review. Every change goes to the review's autosave. Used by
// screens/WalkReview.
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { Modal, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { CopeChips } from '@/features/capture/components/CopeChips'
import { SeverityPicker } from '@/features/capture/components/SeverityPicker'
import { duration } from '@/features/capture/draft'
import { locationLabel, type Location } from '@/features/locations/locations'
import type { Proposal, ProposedObservation, SiteWalk } from '../api'
import { Choice } from './Choice'
import { ObservationMedia } from './ObservationMedia'

type Props = {
  observation: ProposedObservation | null
  proposal: Proposal
  walk: SiteWalk
  // The assessment's own locations that the proposal doesn't have yet.
  others: Location[]
  // The list it came from, in order, so Previous and Next step through it.
  order: ProposedObservation[]
  onStep(ref: string): void
  onNote(text: string): void
  onSeverity(s: NonNullable<ProposedObservation['severity']>): void
  onCategory(c: NonNullable<ProposedObservation['copeDimension']>): void
  // A place already in the proposal, or one of the assessment's others.
  onPlace(place: { ref: string } | { existing: Location }): void
  onDelete(): void
  onClose(): void
}

export function ObservationEditor({ observation: o, proposal, walk, others, order, onStep, onNote, onSeverity, onCategory, onPlace, onDelete, onClose }: Props) {
  const at = o ? order.findIndex((x) => x.ref === o.ref) : -1
  const previous = at > 0 ? order[at - 1] : undefined
  const next = at >= 0 ? order[at + 1] : undefined
  return (
    <Modal visible={Boolean(o)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {o && (
        <SafeAreaView testID="observation-editor" className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-2">
            <Text className="text-lg font-semibold">Edit observation</Text>
            <Button variant="ghost" accessibilityLabel="Done" onPress={onClose}>
              <Text className="text-primary">Done</Text>
            </Button>
          </View>
          {/* Where this one sits in its list, with a step each way (AC31). */}
          {order.length > 1 && at >= 0 && (
            <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-1">
              <Button variant="ghost" accessibilityLabel="Previous observation" accessibilityState={{ disabled: !previous }} disabled={!previous} onPress={() => previous && onStep(previous.ref)}>
                <ChevronLeft color={previous ? '#000f47' : '#9aa3af'} size={18} />
                <Text className={previous ? 'text-primary' : 'text-muted-foreground'}>Previous</Text>
              </Button>
              <Text className="text-sm text-muted-foreground">{`${at + 1} of ${order.length}`}</Text>
              <Button variant="ghost" accessibilityLabel="Next observation" accessibilityState={{ disabled: !next }} disabled={!next} onPress={() => next && onStep(next.ref)}>
                <Text className={next ? 'text-primary' : 'text-muted-foreground'}>Next</Text>
                <ChevronRight color={next ? '#000f47' : '#9aa3af'} size={18} />
              </Button>
            </View>
          )}
          <ScrollView contentContainerClassName="gap-5 p-4 pb-10" keyboardShouldPersistTaps="handled">
            <View className="gap-2">
              <Text className="font-medium">Note</Text>
              <Input accessibilityLabel="Note" value={o.note} onChangeText={onNote} multiline textAlignVertical="top" className="h-32 py-3" />
              {o.recordingSeq !== null && o.start !== null && (
                <Text className="text-sm text-muted-foreground">{`From part ${o.recordingSeq}, ${duration(o.start * 1000)}${o.end !== null ? ` to ${duration(o.end * 1000)}` : ''}`}</Text>
              )}
            </View>
            <View className="gap-2">
              <Text className="font-medium">Severity</Text>
              <SeverityPicker value={o.severity} onChange={onSeverity} />
            </View>
            <View className="gap-2">
              <Text className="font-medium">Category</Text>
              {/* One category here, as on the web: tapping another replaces it. */}
              <CopeChips value={o.copeDimension ? [o.copeDimension] : []} onChange={(next) => next.length && onCategory(next[next.length - 1])} />
            </View>
            <View className="gap-2">
              <Text className="font-medium">Location</Text>
              {proposal.locations.map((l) => (
                <Choice key={l.ref} label={locationLabel(l)} on={o.locationRef === l.ref} onPress={() => onPlace({ ref: l.ref })} />
              ))}
              {others.length > 0 && <Text className="pt-2 text-sm text-muted-foreground">Other places on this assessment</Text>}
              {others.map((l) => (
                <Choice key={l.id} label={locationLabel(l)} on={false} onPress={() => onPlace({ existing: l })} />
              ))}
            </View>
            <ObservationMedia observation={o} walk={walk} />
            <Button variant="outline" accessibilityLabel="Delete observation" onPress={onDelete}>
              <Text className="text-destructive">Delete observation</Text>
            </Button>
          </ScrollView>
        </SafeAreaView>
      )}
    </Modal>
  )
}
