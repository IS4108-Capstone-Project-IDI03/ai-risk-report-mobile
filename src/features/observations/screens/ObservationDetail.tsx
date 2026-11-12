// One observation in full (MB-11): the whole note, severity, tags, location, and
// its photos, pages and voice notes. Opened by tapping a card in the
// workspace (route assessment/[reference]/observation/[id]). Calls
// listObservations (the same cached list the workspace reads) and, for one
// waiting to upload (MB-10), the queue. MB-12: Edit and Delete for one that is
// uploaded.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Pencil, Trash2 } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { listLocations } from '@/features/locations/api'
import { locationLabel } from '@/features/locations/locations'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { useOffline } from '@/features/offline/provider'
import { asObservation, type QueuedObservation } from '@/features/offline/queue'
import { cn, readable } from '@/lib/utils'
import { deleteObservation, listObservations, retryTranscription, type MediaKind } from '../api'
import { POLL_LIMIT, POLL_MS } from '../transcriptPoll'
import { confirmDelete } from '../confirmDelete'
import { DetailFacts } from '../components/DetailFacts'
import { MediaImage } from '../components/MediaImage'
import { PageEntry } from '../components/PageEntry'
import { VoiceNote } from '../components/VoiceNote'
import type { Observation } from '../format'

export default function ObservationDetail() {
  const { reference, id } = useLocalSearchParams<{ reference: string; id: string }>()
  const { items, offline } = useOffline()
  // From the list: undefined while loading; null once it arrives without it (AC7).
  const [listed, setListed] = useState<Observation | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [places, setPlaces] = useState<Awaited<ReturnType<typeof listLocations>>>([])
  // A delete in progress, and why one didn't work (MB-12 AC11, AC12).
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // Goes up to read the list again, e.g. after a refused delete: it may be gone.
  const [reloads, setReloads] = useState(0)
  // A retry request in flight, how many times the list was read for a result, and
  // whether we stopped waiting (MB-12 AC28-AC30).
  const [retrying, setRetrying] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const polls = useRef(0)
  const [gaveUp, setGaveUp] = useState(false)

  const waiting = items.find((i): i is QueuedObservation => i.kind === 'observation' && i.id === id)
  // Opened while waiting. If it then uploads, it gets a new ID on the gateway, so
  // it can't be found by this one: say so rather than "isn't available" (AC5).
  const [openedWaiting] = useState(!!waiting)

  // a. A waiting one is on the phone. b. Any other is in the list (the saved
  // copy offline), read again on coming back from the editor so it shows what was
  // changed (MB-12 AC2). `live` drops a reply that arrives after the screen has moved on.
  useFocusEffect(
    useCallback(() => {
      if (openedWaiting) return
      void reloads // not used: its change is what makes this read the list again
      let live = true
      listObservations(reference).then(
        (all) => {
          if (!live) return
          setListed(all.find((o) => o.id === id) ?? null)
          setError(null)
        },
        (e: Error) => live && setError(e.message),
      )
      return () => {
        live = false
      }
    }, [reference, id, openedWaiting, reloads]),
  )
  const found = waiting ? asObservation(waiting) : listed

  // While a voice note or page is being transcribed, read the list again every few
  // seconds so the result shows without leaving; stop after about 2 minutes (AC29).
  const transcribing = !!found && !waiting && [...found.recordings, ...found.pages].some((m) => m.transcription?.status === 'transcribing')
  useEffect(() => {
    if (!transcribing) return
    const timer = setInterval(() => {
      if (++polls.current > POLL_LIMIT) {
        setGaveUp(true)
        clearInterval(timer)
      } else setReloads((n) => n + 1)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [transcribing, attempt])

  // One new attempt at a failed transcript, one tap (AC28). The reply is 202 with no
  // body, so the list is read again to show "Transcribing"; a refusal or no signal says
  // why and reads it again too, in case it already changed (AC30). Nothing is queued.
  async function retry(kind: MediaKind | 'pages', itemId: string) {
    if (retrying) return
    setRetrying(true)
    setProblem(null)
    setGaveUp(false)
    polls.current = 0
    try {
      await retryTranscription(id, kind, itemId)
    } catch (e) {
      setProblem(errorText(e))
    } finally {
      setRetrying(false)
      setAttempt((n) => n + 1)
      setReloads((n) => n + 1)
    }
  }
  const tryAgain = (kind: MediaKind | 'pages', itemId: string) =>
    waiting ? undefined : { run: () => retry(kind, itemId), disabled: offline || retrying, offline }

  // A waiting observation knows its location's ID, not its name.
  useEffect(() => {
    listLocations(reference).then(setPlaces, () => {})
  }, [reference])

  // Deleted on the gateway (soft: it is kept), then back to the workspace, whose
  // list reloads as it comes back into view.
  async function remove() {
    setBusy(true)
    setProblem(null)
    try {
      await deleteObservation(id)
      leaveDetail(reference)
    } catch (e) {
      setProblem(errorText(e))
      setBusy(false)
      setReloads((n) => n + 1)
    }
  }

  if (openedWaiting && !waiting)
    return <Unavailable title="This observation was uploaded" hint="Go back, and it shows in the list with the others." />
  if (error) return <Unavailable title="Couldn't load this observation" hint={`${error} Go back and try again.`} />
  if (found === undefined) return <View testID="observation-detail" className="flex-1" />
  // Removed on the web since the workspace loaded (AC7).
  if (found === null)
    return <Unavailable title="This observation isn't available" hint="It may have been removed. Go back and pull down to refresh." />

  const where = found.location?.name ? found.location : places.find((p) => p.id === found.location?.id)
  return (
    <View testID="observation-detail" className="flex-1">
      <ScrollView contentContainerClassName="gap-4 p-4 pb-8" className="flex-1">
        <View className={cn('gap-4', readable)}>
          <OfflineNote />
          {waiting && (
            <Text className={cn('text-base font-medium', waiting.error ? 'text-destructive' : 'text-muted-foreground')}>
              {waiting.error ? `Couldn't upload: ${waiting.error}` : 'Waiting to upload'}
            </Text>
          )}
          <DetailFacts observation={found} place={where ? locationLabel(where) : null} />
          {found.note && <Text className="text-lg">{found.note}</Text>}
          {found.photos.map((photo, i) => (
            <MediaImage key={photo.id ?? photo.url} url={photo.url} testID="detail-photo" label={`Photo ${i + 1}`} />
          ))}
          {found.recordings.map((note, i) => (
            <VoiceNote key={note.id} note={note} number={i + 1} retry={tryAgain('recordings', note.id)} />
          ))}
          {found.pages.map((page, i) => (
            <PageEntry key={page.id ?? page.url} page={page} number={i + 1} retry={page.id ? tryAgain('pages', page.id) : undefined} />
          ))}
          {gaveUp && transcribing && <Text className="text-sm text-muted-foreground">Still working. Check back soon.</Text>}
        </View>
      </ScrollView>
      {/* Only for an uploaded one: a waiting one has Discard in the workspace (MB-10).
          Greyed out with no signal, with the reason, since both need the gateway (AC14). */}
      {!waiting && (
        <SafeAreaView edges={['bottom']} className="border-t border-border bg-card px-4 pt-2">
          <View className={cn('mb-2 gap-2', readable)}>
            {offline && <Text className="text-sm text-muted-foreground">Connect to edit or delete.</Text>}
            {problem && <Text className="text-sm text-destructive">{problem}</Text>}
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                accessibilityLabel="Edit observation"
                className="flex-1"
                disabled={offline || busy}
                onPress={() =>
                  router.push({ pathname: '/assessment/[reference]/observation/[id]/edit', params: { reference, id } })
                }
              >
                <Pencil color="#1a1f26" size={18} />
                <Text>Edit</Text>
              </Button>
              <Button
                variant="outline"
                accessibilityLabel="Delete observation"
                className="flex-1"
                disabled={offline || busy}
                onPress={() => confirmDelete(remove)}
              >
                <Trash2 color="#ad2e2d" size={18} />
                <Text className="text-destructive">Delete</Text>
              </Button>
            </View>
          </View>
        </SafeAreaView>
      )}
    </View>
  )
}

// Back to the workspace; opened by a link there's nothing to go back to, so it
// goes there instead.
function leaveDetail(reference: string) {
  if (router.canGoBack()) router.back()
  else router.replace({ pathname: '/assessment/[reference]', params: { reference } })
}

// What the screen says when there's nothing to show, and a way out. Opened by a
// link there's nothing to go back to, so it goes to the workspace instead.
function Unavailable({ title, hint }: { title: string; hint: string }) {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  return (
    <View testID="observation-detail" className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-lg font-semibold">{title}</Text>
      <Text className="text-center text-muted-foreground">{hint}</Text>
      <Button variant="outline" accessibilityLabel="Back" onPress={() => leaveDetail(reference)}>
        <Text>Back</Text>
      </Button>
    </View>
  )
}
