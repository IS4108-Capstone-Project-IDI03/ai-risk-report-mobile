// The recorder of a site walk (MB-16 AC6-AC12, AC32-AC37): record in parts (Record, Pause, Resume, Stop),
// take photos, type notes (and edit them), then Finish walk and name it. Opened from the Site walks screen. Everything taken is kept
// on the phone first and sent when there is signal (pending.ts); Finish waits until it is all sent,
// then starts the gateway's two paid AI steps (transcribing, proposing). Calls ../api, ../pending,
// and the voice note hook and camera of the capture feature.
import { useKeepAwake } from 'expo-keep-awake'
import { router, useLocalSearchParams } from 'expo-router'
import { CircleHelp } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { cn, readable } from '@/lib/utils'
import { duration } from '@/features/capture/draft'
import { takePhoto } from '@/features/capture/media'
import { useVoiceNote } from '@/features/capture/useVoiceNote'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { finishWalk, getWalk, type SiteWalk } from '../api'
import { HelpSheet } from '../components/HelpSheet'
import { NoteItem } from '../components/NoteItem'
import { RecordControls } from '../components/RecordControls'
import { addPending, keepFile, pendingFor, putNote, readDraft, sendPending, writeDraft, type Pending } from '../pending'

export default function WalkRecording() {
  const { reference, walkId } = useLocalSearchParams<{ reference: string; walkId: string }>()
  // The screen stays on while a walk is being recorded (AC9).
  useKeepAwake()
  const [walk, setWalk] = useState<SiteWalk | null>(null)
  const [pending, setPending] = useState<Pending[]>(() => pendingFor(walkId))
  const [problem, setProblem] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  // The note being typed, kept on the phone for this walk until it is added (AC34).
  const [note, setNote] = useState(() => readDraft(walkId))
  const [ended, setEnded] = useState(false)
  const [help, setHelp] = useState(false)
  // The name box shows once Finish walk is tapped.
  const [naming, setNaming] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  // The next number for a part or a note, which share one (AC8). Set when the walk loads.
  const nextSeq = useRef(1)
  // The part just taken, so a photo can be tied to it (AC7).
  const lastPart = useRef<{ seq: number; durationSec: number } | null>(null)
  const taking = useRef(false)

  // Shows the walk as the gateway holds it, and numbers the next part or note after what it and the
  // phone already have.
  const show = useCallback(
    (w: SiteWalk) => {
      setWalk(w)
      const seqs = [...w.recordings.map((r) => r.seq), ...w.notes.map((n) => n.seq), ...pendingFor(walkId).flatMap((p) => ('seq' in p ? [p.seq] : []))]
      nextSeq.current = Math.max(nextSeq.current, ...seqs.map((n) => n + 1))
      const last = [...w.recordings].sort((a, b) => b.seq - a.seq)[0]
      if (last && !lastPart.current) lastPart.current = { seq: last.seq, durationSec: last.durationSec }
    },
    [walkId],
  )

  // On opening: read the walk, and send anything left waiting from last time (AC11).
  useEffect(() => {
    let live = true
    getWalk(reference, walkId).then(
      (w) => live && show(w),
      (e) => live && setProblem(errorText(e)),
    )
    if (pendingFor(walkId).length)
      sendPending(reference, walkId).then(({ left, problem: why }) => {
        if (!live) return
        setPending(left)
        if (why) setProblem(why)
      })
    return () => {
      live = false
    }
  }, [reference, walkId, show])

  // Sends what is waiting (no signal leaves it waiting), then reads the walk so "Waiting to upload"
  // becomes "Sent".
  async function send() {
    setSending(true)
    const { left, problem: why } = await sendPending(reference, walkId)
    setPending(left)
    if (why) setProblem(why)
    setSending(false)
    getWalk(reference, walkId).then(show, () => {})
    return { left, why }
  }

  // Each stopped part is the next numbered recording (AC6).
  const voice = useVoiceNote(async (taken) => {
    const seq = nextSeq.current++
    const durationSec = Math.round(taken.durationMillis / 1000)
    lastPart.current = { seq, durationSec }
    const file = await keepFile(walkId, taken.uri, `recording-${seq}.m4a`)
    setPending(addPending(walkId, { kind: 'recording', seq, file, durationSec }))
    void send()
  })

  async function record() {
    setProblem(null)
    setEnded(false)
    const failed = await voice.start()
    if (failed) setProblem(failed.message)
  }

  // The camera and the microphone can't both be in use: the part is saved, then the camera opens,
  // and the photo follows that part (AC7). If I was recording, the next part starts when it closes (AC33).
  async function photo() {
    if (taking.current) return
    taking.current = true
    setProblem(null)
    const wasRecording = voice.recording
    try {
      if (wasRecording) await voice.stop()
      const picked = await takePhoto()
      if ('denied' in picked) return setProblem(picked.denied)
      if ('canceled' in picked) return
      const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      const part = lastPart.current
      const file = await keepFile(walkId, picked.uris[0], `${id}.jpg`)
      setPending(addPending(walkId, { kind: 'photo', id, file, recordingSeq: part?.seq ?? null, offsetSec: part?.durationSec ?? null }))
      void send()
    } finally {
      taking.current = false
      if (wasRecording) await record()
    }
  }

  function type(text: string) {
    setNote(text)
    writeDraft(walkId, text)
  }
  function addNote() {
    if (!note.trim()) return
    setPending(addPending(walkId, { kind: 'note', seq: nextSeq.current++, text: note.trim() }))
    type('')
    void send()
  }
  // An edit or a remove (blank) is kept on the phone and sent like a new note, under the same number.
  function changeNote(seq: number, text: string) {
    setPending(putNote(walkId, seq, text))
    void send()
  }

  // If the app leaves the foreground, the part saves what it has, and the screen says so (AC9).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      // Only a real exit stops it: iOS also says "inactive" for Control Center or a call banner.
      if (state !== 'background' || !voice.recording) return
      void voice.stop()
      setProblem('Recording stopped because the app was closed. Record again to continue.')
      setEnded(true)
    })
    return () => sub.remove()
  })

  const nothing = !walk || (!walk.recordings.length && !walk.photos.length && !walk.notes.length && !pending.length && !note.trim())

  // a. Send everything waiting. b. Only when all of it is sent, finish under the name: the gateway
  // then transcribes and proposes (paid). With no signal it says so and nothing is lost (AC10, AC12).
  async function finish() {
    if (!naming?.trim() || finishing) return
    setFinishing(true)
    setProblem(null)
    // A note typed but not added is sent with the rest, as a note after the last part.
    if (note.trim()) addNote()
    try {
      const { left, why } = await send()
      // The reason the gateway gave, else no signal: "Connect to the internet" is only true then.
      if (left.length) return setProblem(`${left.length} still to send. ${why ?? 'Connect to the internet, then finish the walk.'}`)
      await finishWalk(reference, walkId, naming.trim())
      router.back()
    } catch (e) {
      setProblem(errorText(e))
    } finally {
      setFinishing(false)
    }
  }

  if (!walk) {
    return (
      <View testID="walk-recording" className="flex-1 items-center justify-center px-8">
        {problem ? <Text className="text-center text-destructive">{problem}</Text> : <ActivityIndicator color="#000f47" />}
      </View>
    )
  }

  const parts = [
    ...walk.recordings.map((r) => ({ seq: r.seq, durationSec: r.durationSec, waiting: false })),
    ...pending.flatMap((p) => (p.kind === 'recording' ? [{ seq: p.seq, durationSec: p.durationSec, waiting: true }] : [])),
  ].sort((a, b) => a.seq - b.seq)
  // A waiting note replaces the sent one with its number; blank text means removed.
  const waitingNotes = pending.flatMap((p) => (p.kind === 'note' ? [p] : []))
  const notes = [
    ...walk.notes.filter((n) => !waitingNotes.some((w) => w.seq === n.seq)).map((n) => ({ seq: n.seq, text: n.text, waiting: false })),
    ...waitingNotes.map((p) => ({ seq: p.seq, text: p.text, waiting: true })),
  ].filter((n) => n.text.trim()).sort((a, b) => a.seq - b.seq)
  const photos = walk.photos.length + pending.filter((p) => p.kind === 'photo').length

  return (
    <KeyboardAvoidingView testID="walk-recording" className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className={cn('gap-4', readable)}>
          <OfflineNote />
          <View className="flex-row items-center justify-end">
            <Button variant="link" accessibilityLabel="How to record a walk" onPress={() => setHelp(true)} className="h-12 px-1">
              <CircleHelp color="#2c5488" size={16} />
              <Text className="text-sm">How to record a walk</Text>
            </Button>
          </View>
          <RecordControls recording={voice.recording} paused={voice.paused} millis={voice.durationMillis} onRecord={record} onPause={voice.pause} onResume={voice.resume} onStop={() => voice.stop()} onPhoto={photo} />
          {problem && (
            <View className="gap-2 rounded-md bg-destructive/10 p-3">
              <Text className="text-destructive">{problem}</Text>
              {ended && !voice.recording && (
                <Button accessibilityLabel="Continue recording" onPress={record}>
                  <Text>Continue recording</Text>
                </Button>
              )}
            </View>
          )}

          <View className="gap-2">
            <Input accessibilityLabel="Note" value={note} onChangeText={type} placeholder="Type a note" multiline maxLength={2000} textAlignVertical="top" className="h-20 py-3" />
            <Button variant="outline" accessibilityLabel="Add note" disabled={!note.trim()} onPress={addNote}>
              <Text>Add note</Text>
            </Button>
          </View>

          {/* What this walk holds so far, in the order taken; waiting ones are still on the phone. */}
          <View testID="walk-items" className="gap-2">
            {parts.map((p) => (
              <View key={`r${p.seq}`} className="flex-row justify-between rounded-md border border-border bg-card p-3">
                <Text>{`Part ${p.seq} · ${duration(p.durationSec * 1000)}`}</Text>
                <Text className="text-muted-foreground">{p.waiting ? 'Waiting to upload' : 'Sent'}</Text>
              </View>
            ))}
            {notes.map((n) => (
              <NoteItem key={`n${n.seq}-${n.text}`} text={n.text} waiting={n.waiting} onSave={(text) => changeNote(n.seq, text)} onRemove={() => changeNote(n.seq, '')} />
            ))}
            {photos > 0 && <Text className="text-muted-foreground">{`${photos} ${photos === 1 ? 'photo' : 'photos'}`}</Text>}
            {pending.length > 0 && <Text className="text-sm text-muted-foreground">{`${pending.length} waiting to upload${sending ? ' · sending…' : ''}`}</Text>}
          </View>

          {naming === null ? (
            <View className="gap-1">
              <Button size="lg" variant="outline" accessibilityLabel="Finish walk" accessibilityState={{ disabled: nothing || voice.recording }} disabled={nothing || voice.recording} onPress={() => setNaming(walk.name ?? '')}>
                <Text className="text-lg">Finish walk</Text>
              </Button>
              {nothing && <Text className="text-sm text-muted-foreground">Record or write something to finish.</Text>}
            </View>
          ) : (
            <View className="gap-2 rounded-lg border border-primary bg-card p-3">
              <Text className="font-semibold">Name this walk</Text>
              <Input accessibilityLabel="Walk name" value={naming} onChangeText={setNaming} maxLength={100} autoFocus />
              <View className="flex-row gap-2">
                <Button accessibilityLabel="Finish and send" className="flex-1" disabled={!naming.trim() || finishing} onPress={finish}>
                  {finishing ? <ActivityIndicator color="#ffffff" /> : <Text>Finish and send</Text>}
                </Button>
                <Button variant="outline" accessibilityLabel="Cancel finish" disabled={finishing} onPress={() => setNaming(null)} className="flex-1">
                  <Text>Cancel</Text>
                </Button>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
    </KeyboardAvoidingView>
  )
}
