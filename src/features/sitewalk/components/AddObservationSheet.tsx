// Add an observation by hand to a proposal (MB-16 AC27), as the web's Add manually does: a note,
// severity, category and place, with photos, voice notes and scanned pages. It reuses the capture
// sheet's buttons, media tray and chips (MB-03, MB-07). Nothing is sent until Save observation; the
// review's useProposal.addByHand uploads the files to the walk and then adds the observation.
// Opened from WalkReview.
import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Eyebrow } from '@/components/Eyebrow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { CaptureButtons } from '@/features/capture/components/CaptureButtons'
import { CopeChips } from '@/features/capture/components/CopeChips'
import { EvidenceTray } from '@/features/capture/components/EvidenceTray'
import { SeverityPicker } from '@/features/capture/components/SeverityPicker'
import { emptyDraft, missing, type Draft } from '@/features/capture/draft'
import { choosePhotos, takePhoto } from '@/features/capture/media'
import { useVoiceNote, type RecordingProblem } from '@/features/capture/useVoiceNote'
import { locationLabel, type Location } from '@/features/locations/locations'
import { errorText } from '@/lib/api'
import type { Proposal } from '../api'
import type { NewByHand, Place } from '../useProposal'
import { Choice } from './Choice'
import { Sheet } from './Sheet'

type Props = {
  proposal: Proposal
  // The assessment's places the proposal doesn't have yet.
  others: Location[]
  // The place chosen on the review, so the form starts there.
  startAt: string | null
  // Uploads and adds; throws the reason when it can't.
  onSave(input: NewByHand): Promise<void>
  onClose(): void
}

type ListKey = 'photos' | 'pages' | 'recordings'

export function AddObservationSheet({ proposal, others, startAt, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [place, setPlace] = useState<Place | null>(startAt && proposal.locations.some((l) => l.ref === startAt) ? { ref: startAt } : null)
  const [problem, setProblem] = useState<RecordingProblem | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const voice = useVoiceNote((note) => setDraft((d) => ({ ...d, recordings: [...d.recordings, note] })))
  const update = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }))
  const remove = (key: ListKey, index: number) => setDraft((d) => ({ ...d, [key]: d[key].filter((_: unknown, i: number) => i !== index) }))

  // Adds what the camera or library gave; a cancel adds nothing; refused access says why.
  async function addImages(into: 'photos' | 'pages', from: 'camera' | 'library') {
    const picked = await (from === 'camera' ? takePhoto() : choosePhotos())
    if ('denied' in picked) return setProblem({ message: picked.denied, settings: true })
    if (!('uris' in picked)) return
    setProblem(null)
    setDraft((d) => ({ ...d, [into]: [...d[into], ...picked.uris] }))
  }

  async function save() {
    if (saving) return
    const why = missing(draft) ?? (place ? null : 'Choose a location for this observation.')
    if (why) return setError(why)
    setSaving(true)
    setError(null)
    try {
      if (voice.recording) await voice.stop()
      await onSave({ note: draft.note.trim(), copeDimension: draft.cope[0] ?? null, severity: draft.severity!, place: place!, photos: draft.photos, pages: draft.pages, recordings: draft.recordings })
    } catch (e) {
      // The form stays as it was, so nothing typed or taken is lost.
      setError(errorText(e))
      setSaving(false)
    }
  }

  return (
    <Sheet title="Add observation" testID="add-observation-sheet" onClose={saving ? () => {} : onClose}>
      <View className="gap-2">
        <Eyebrow>Note</Eyebrow>
        <Input accessibilityLabel="Note" value={draft.note} onChangeText={(note) => update({ note })} placeholder="What did you see?" multiline textAlignVertical="top" className="h-28 py-3" />
      </View>
      <View className="gap-2">
        <Eyebrow>Severity</Eyebrow>
        <SeverityPicker value={draft.severity} onChange={(severity) => update({ severity })} />
      </View>
      <View className="gap-2">
        <Eyebrow>Category</Eyebrow>
        <CopeChips value={draft.cope} onChange={(next) => update({ cope: next.slice(-1) })} />
      </View>
      <View className="gap-2">
        <Eyebrow>Location</Eyebrow>
        {proposal.locations.map((l) => (
          <Choice key={l.ref} label={locationLabel(l)} on={place !== null && 'ref' in place && place.ref === l.ref} onPress={() => setPlace({ ref: l.ref })} />
        ))}
        {others.length > 0 && <Text className="pt-2 text-sm text-muted-foreground">Other places on this assessment</Text>}
        {others.map((l) => (
          <Choice key={l.id} label={locationLabel(l)} on={place !== null && 'existing' in place && place.existing.id === l.id} onPress={() => setPlace({ existing: l })} />
        ))}
      </View>
      <EvidenceTray draft={draft} onRemove={remove} />
      <CaptureButtons
        draft={draft}
        recording={voice.recording}
        durationMillis={voice.durationMillis}
        busy={saving}
        onPhoto={() => addImages('photos', 'camera')}
        onRecord={async () => setProblem(await voice.start())}
        onStop={voice.stop}
        onScan={() => addImages('pages', 'camera')}
        onPhotoLibrary={() => addImages('photos', 'library')}
        onScanLibrary={() => addImages('pages', 'library')}
      />
      {problem && <Text className="text-destructive">{problem.message}</Text>}
      {error && (
        <View className="rounded-md bg-destructive/10 p-3">
          <Text className="text-destructive">{error}</Text>
        </View>
      )}
      <Button size="lg" accessibilityLabel="Save observation" disabled={saving} onPress={save}>
        {saving ? <ActivityIndicator color="#ffffff" /> : <Text className="text-lg">Save observation</Text>}
      </Button>
    </Sheet>
  )
}
