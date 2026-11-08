// The "Media" section of the edit screen (MB-12 AC16-AC21): the photos, voice notes
// and handwritten pages inside a saved observation. Photos and voice notes can be
// removed or restored (soft; each its own request, applied at once, and the reply
// replaces the screen's copy through `onChange`) and added. An added photo or voice
// note waits in a "new" row until the screen is saved (`staged`, held by the editor),
// as on the web's Add media dialog: nothing is uploaded or transcribed before then.
// Pages are only listed, because the gateway can't add or remove them on a saved
// observation yet (web CP-20). Used by screens/ObservationEdit.
import { Camera, Images, Mic, RotateCcw, Square, Trash2 } from 'lucide-react-native'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Alert, Image, View, type ImageSourcePropType } from 'react-native'
import { Eyebrow } from '@/components/Eyebrow'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { Big } from '@/features/capture/components/CaptureButtons'
import { duration } from '@/features/capture/draft'
import { choosePhotos, takePhoto, type Picked } from '@/features/capture/media'
import { useVoiceNote } from '@/features/capture/useVoiceNote'
import { removeMedia, restoreMedia, type MediaKind, type NewMedia } from '../api'
import { capturedAt, mediaUri, type Observation, type Transcription } from '../format'

// Where a transcript stands, in the words the detail screen uses.
const STATUS: Record<Transcription['status'], string> = {
  transcribing: 'Transcribing',
  transcribed: 'Transcribed',
  failed: "Couldn't transcribe",
}

const NAME: Record<MediaKind, string> = { photos: 'photo', recordings: 'voice note' }

type Props = {
  observation: Observation
  onChange(o: Observation): void
  // New photos and voice notes waiting for Save, and how to change them.
  staged: NewMedia
  setStaged: Dispatch<SetStateAction<NewMedia>>
  // True while an action runs, a picker is open or a recording is going, so the screen can
  // keep Save, Cancel and Back from closing it halfway (AC21).
  onBusyChange(busy: boolean): void
}

export function MediaSection({ observation, onChange, staged, setStaged, onBusyChange }: Props) {
  const [busy, setBusy] = useState(false)
  // The camera or library is open, so a second tap can't open another.
  const [picking, setPicking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // One remove or restore at a time. A failure leaves the list as it was and says why (AC21).
  async function run(action: () => Promise<Observation>) {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      onChange(await action())
    } catch (e) {
      setProblem(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  // A photo from the camera or library waits to be added on Save (AC20).
  async function addPhotos(pick: () => Promise<Picked>) {
    if (picking) return
    setPicking(true)
    setProblem(null)
    try {
      const picked = await pick()
      if ('denied' in picked) return setProblem(picked.denied)
      if ('canceled' in picked) return
      setStaged((s) => ({ ...s, photos: [...s.photos, ...picked.uris] }))
    } finally {
      setPicking(false)
    }
  }

  const voice = useVoiceNote((note) => setStaged((s) => ({ ...s, recordings: [...s.recordings, note] })))
  async function record() {
    const failed = await voice.start()
    if (failed) setProblem(failed.message)
  }
  // Off while recording: the camera would take the microphone's audio session.
  const locked = busy || picking || voice.recording
  useEffect(() => onBusyChange(locked), [locked, onBusyChange])

  function confirmRemove(kind: MediaKind, itemId: string) {
    Alert.alert(`Remove this ${NAME[kind]}?`, 'It is removed from this observation and the report draft. It is kept, so it can be restored.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => run(() => removeMedia(observation.id, kind, itemId)) },
    ])
  }

  const removed = [
    ...(observation.removedPhotos ?? []).map((item) => ({ kind: 'photos' as const, item })),
    ...(observation.removedRecordings ?? []).map((item) => ({ kind: 'recordings' as const, item })),
  ]

  return (
    <View testID="media" className="gap-3">
      <Eyebrow>Media</Eyebrow>
      {observation.photos.map((photo, i) => (
        <Row key={photo.id ?? photo.url} source={{ uri: mediaUri(photo.url) }} title={`Photo ${i + 1}`}>
          {photo.id && <Remove label={`Remove photo ${i + 1}`} disabled={locked} onPress={() => confirmRemove('photos', photo.id!)} />}
        </Row>
      ))}
      {observation.recordings.map((note, i) => (
        <Row key={note.id} title={`Voice note ${i + 1}`} subtitle={note.transcription && STATUS[note.transcription.status]}>
          <Remove label={`Remove voice note ${i + 1}`} disabled={locked} onPress={() => confirmRemove('recordings', note.id)} />
        </Row>
      ))}
      {observation.pages.map((page, i) => (
        <Row key={page.id ?? page.url} source={{ uri: mediaUri(page.url) }} title={`Handwritten page ${i + 1}`} />
      ))}
      {observation.pages.length > 0 && (
        <Text className="text-sm text-muted-foreground">{"Pages can't be added or removed on a saved observation yet."}</Text>
      )}

      {/* Waiting for Save (AC20): nothing here is uploaded or transcribed yet. */}
      {staged.photos.map((uri, i) => (
        <Row key={`photo-${i}-${uri}`} source={{ uri }} title={`New photo ${i + 1}`} subtitle="Added when you save">
          <Discard label={`Discard new photo ${i + 1}`} onPress={() => setStaged((s) => ({ ...s, photos: s.photos.filter((_, n) => n !== i) }))} />
        </Row>
      ))}
      {staged.recordings.map((note, i) => (
        <Row key={`voice-${i}-${note.uri}`} title={`New voice note ${i + 1}`} subtitle={`${duration(note.durationMillis)} · Added when you save`}>
          <Discard label={`Discard new voice note ${i + 1}`} onPress={() => setStaged((s) => ({ ...s, recordings: s.recordings.filter((_, n) => n !== i) }))} />
        </Row>
      ))}

      {removed.map(({ kind, item }, n) => (
        <Row
          key={item.id}
          title={`${NAME[kind] === 'photo' ? 'Photo' : 'Voice note'} · Removed by ${item.removed.by.name}, ${capturedAt(item.removed.at)}`}
          source={'url' in item && kind === 'photos' ? { uri: mediaUri(item.url) } : undefined}
        >
          <Button variant="outline" accessibilityLabel={`Restore ${NAME[kind]} ${n + 1}`} disabled={locked} onPress={() => run(() => restoreMedia(observation.id, kind, item.id!))}>
            <RotateCcw color="#1a1f26" size={16} />
            <Text>Restore</Text>
          </Button>
        </Row>
      ))}

      {/* The same big tiles as the capture sheet; no Scan page, as pages can't be added. */}
      <View className="gap-1">
        <View className="flex-row gap-2">
          <Big label="Take photo" text="Take photo" Icon={Camera} onPress={() => addPhotos(takePhoto)} disabled={locked} />
          {voice.recording ? (
            <Big label="Stop recording" text={`Stop ${duration(voice.durationMillis)}`} Icon={Square} onPress={voice.stop} danger />
          ) : (
            <Big label="Record voice note" text="Record" Icon={Mic} onPress={record} disabled={busy || picking} />
          )}
        </View>
        <View className="flex-row justify-center">
          <Button variant="link" accessibilityLabel="Add photo from library" disabled={locked} onPress={() => addPhotos(choosePhotos)} className="h-12 px-1">
            <Images color="#2c5488" size={16} />
            <Text className="text-sm">Photo from library</Text>
          </Button>
        </View>
      </View>
      {busy && <Text className="text-sm text-muted-foreground">Working…</Text>}
      {problem && <Text className="text-destructive">{problem}</Text>}
    </View>
  )
}

// One line of media: a small picture if it has one, its name and where it stands,
// and what can be done to it on the right.
function Row({ source, title, subtitle, children }: { source?: ImageSourcePropType; title: string; subtitle?: string | null; children?: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-3 rounded-md border border-border bg-card p-2">
      {source && <Image source={source} className="h-12 w-12 rounded-md bg-muted" />}
      <View className="flex-1">
        <Text className="font-medium">{title}</Text>
        {subtitle ? <Text className="text-sm text-muted-foreground">{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function Remove({ label, disabled, onPress }: { label: string; disabled: boolean; onPress(): void }) {
  return (
    <Button variant="outline" accessibilityLabel={label} disabled={disabled} onPress={onPress}>
      <Trash2 color="#ad2e2d" size={16} />
      <Text className="text-destructive">Remove</Text>
    </Button>
  )
}

// Takes a new photo or voice note off the waiting list, before anything was sent.
function Discard({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Button variant="outline" accessibilityLabel={label} onPress={onPress}>
      <Text>Discard</Text>
    </Button>
  )
}
