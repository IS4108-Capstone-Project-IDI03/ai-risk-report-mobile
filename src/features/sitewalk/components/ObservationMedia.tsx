// What a proposed observation holds (MB-16 AC17, AC28): the walk recording it came from, voice notes
// added by hand with their transcripts, photos (the walk's and added ones) and handwritten pages.
// Used by ObservationEditor and DeletedList. Files are the walk's (api.ts SiteWalk.photos, .media).
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { MediaImage } from '@/features/observations/components/MediaImage'
import { VoiceNote } from '@/features/observations/components/VoiceNote'
import type { ProposedObservation, SiteWalk } from '../api'

type Media = NonNullable<SiteWalk['media']>[number]

// Create all transcribes a clip that failed again, on the observation.
const NOT_YET = 'Not transcribed yet. It is transcribed again when you create all.'
const clipText = (m: Media) => m.transcript ?? (m.transcription === 'failed' ? NOT_YET : 'Transcribing…')

// The photos and pages of one observation, for a list that shows them (All photos, All pages).
export function filesOf(o: ProposedObservation, walk: SiteWalk) {
  const added = (walk.media ?? []).filter((m) => o.mediaIds?.includes(m.id))
  return {
    photos: [...walk.photos.filter((p) => o.photoIds.includes(p.id)).map((p) => ({ id: p.id, url: p.url })), ...added.filter((m) => m.kind === 'photo')],
    pages: added.filter((m) => m.kind === 'page'),
    voices: added.filter((m) => m.kind === 'voice'),
  }
}

export function ObservationMedia({ observation: o, walk }: { observation: ProposedObservation; walk: SiteWalk }) {
  const { photos, pages, voices } = filesOf(o, walk)
  const part = walk.recordings.find((r) => r.seq === o.recordingSeq)
  if (!part && !voices.length && !photos.length && !pages.length) return null
  return (
    <View className="gap-4">
      {part?.audioUrl && <VoiceNote note={{ id: `walk-${walk.id}-${part.seq}`, url: part.audioUrl }} number={part.seq} title="site walk recording" from={o.start ?? 0} />}
      {voices.map((v, i) => (
        <View key={v.id} className="gap-1">
          <VoiceNote note={{ id: v.id, url: v.url }} number={i + 1} />
          <Text className="text-base">{clipText(v)}</Text>
        </View>
      ))}
      {photos.length > 0 && (
        <View className="gap-2">
          <Text className="font-medium">Photos</Text>
          {photos.map((p) => <MediaImage key={p.id} url={p.url} testID={`proposed-photo-${p.id}`} label="Photo from the walk" />)}
        </View>
      )}
      {pages.length > 0 && (
        <View className="gap-2">
          <Text className="font-medium">Handwritten pages</Text>
          {pages.map((p) => <MediaImage key={p.id} url={p.url} testID={`proposed-page-${p.id}`} label="Handwritten page" />)}
        </View>
      )}
    </View>
  )
}
