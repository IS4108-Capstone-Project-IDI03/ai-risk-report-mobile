// One observation in full (MB-11): the whole note, severity, tags, location, and
// its photos, pages and voice notes. View only. Opened by tapping a card in the
// workspace (route assessment/[reference]/observation/[id]). Calls
// listObservations (the same cached list the workspace reads) and, for one
// waiting to upload (MB-10), the queue.
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { listLocations } from '@/features/locations/api'
import { locationLabel } from '@/features/locations/locations'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { useOffline } from '@/features/offline/provider'
import { asObservation, type QueuedObservation } from '@/features/offline/queue'
import { cn, readable } from '@/lib/utils'
import { listObservations } from '../api'
import { DetailFacts } from '../components/DetailFacts'
import { MediaImage } from '../components/MediaImage'
import { PageEntry } from '../components/PageEntry'
import { VoiceNote } from '../components/VoiceNote'
import type { Observation } from '../format'

export default function ObservationDetail() {
  const { reference, id } = useLocalSearchParams<{ reference: string; id: string }>()
  const { items } = useOffline()
  // From the list: undefined while loading; null once it arrives without it (AC7).
  const [listed, setListed] = useState<Observation | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [places, setPlaces] = useState<Awaited<ReturnType<typeof listLocations>>>([])

  const waiting = items.find((i): i is QueuedObservation => i.kind === 'observation' && i.id === id)
  // Opened while waiting. If it then uploads, it gets a new ID on the gateway, so
  // it can't be found by this one: say so rather than "isn't available" (AC5).
  const [openedWaiting] = useState(!!waiting)

  // a. A waiting one is on the phone. b. Any other is in the list (the saved
  // copy offline). `live` drops a reply that arrives after the screen has moved on.
  useEffect(() => {
    if (openedWaiting) return
    let live = true
    listObservations(reference).then(
      (all) => live && setListed(all.find((o) => o.id === id) ?? null),
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
  }, [reference, id, openedWaiting])
  const found = waiting ? asObservation(waiting) : listed

  // A waiting observation knows its location's ID, not its name.
  useEffect(() => {
    listLocations(reference).then(setPlaces, () => {})
  }, [reference])

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
      <ScrollView contentContainerClassName="gap-4 p-4 pb-8">
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
            <VoiceNote key={note.id} note={note} number={i + 1} />
          ))}
          {found.pages.map((page, i) => (
            <PageEntry key={page.id ?? page.url} page={page} number={i + 1} />
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

// What the screen says when there's nothing to show, and a way out. Opened by a
// link there's nothing to go back to, so it goes to the workspace instead.
function Unavailable({ title, hint }: { title: string; hint: string }) {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  return (
    <View testID="observation-detail" className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-lg font-semibold">{title}</Text>
      <Text className="text-center text-muted-foreground">{hint}</Text>
      <Button variant="outline" accessibilityLabel="Back" onPress={() =>
          router.canGoBack() ? router.back() : router.replace({ pathname: '/assessment/[reference]', params: { reference } })
        }>
        <Text>Back</Text>
      </Button>
    </View>
  )
}
