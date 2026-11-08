// Assessment workspace (MB-02 AC1-AC6, MB-03 AC1-AC2): opened from Home. Shows
// the assessment, where the engineer is, what's been captured there, and the
// New observation button. Opening it never starts a capture session (MB-02
// AC6): that reopens a completed assessment, so saving the first one starts it.
// MB-07: the assessment's details sit in a navy band under the header, and the
// location bar and New observation sit together at the bottom, in thumb reach.
// MB-09: WorkspaceView is also Home's right-hand pane in the iPad split view;
// the route below renders it for the reference in the URL. MB-10: opens
// offline from the last copy, and lists observations waiting to upload first.
// MB-11: tapping an observation opens its detail.
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, FlatList, RefreshControl, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Eyebrow } from '@/components/Eyebrow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { cn, readable } from '@/lib/utils'
import { CurrentLocationCard } from '@/features/locations/components/CurrentLocationCard'
import { listLocations } from '@/features/locations/api'
import { useCurrentLocation } from '@/features/locations/current'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { useOffline } from '@/features/offline/provider'
import { asObservation, type QueuedObservation } from '@/features/offline/queue'
import { listObservations } from '@/features/observations/api'
import { ObservationCard } from '@/features/observations/components/ObservationCard'
import type { Observation } from '@/features/observations/format'
import { listAssessments } from '../api'
import { formatDate, STATUS, type Assessment } from '../format'

export default function Workspace() {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  return <WorkspaceView reference={reference} />
}

// `embedded`: inside Home's split view, where there's no stack header to set.
export function WorkspaceView({ reference, embedded = false }: { reference: string; embedded?: boolean }) {
  const [location] = useCurrentLocation(reference)
  // undefined while loading; null once the list arrives without it.
  const [assessment, setAssessment] = useState<Assessment | null | undefined>(undefined)
  const [observations, setObservations] = useState<Observation[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { items, uploads, discard } = useOffline()

  // Both together, so one failing isn't hidden by the other succeeding, and
  // pull to refresh retries both. State is set once the replies arrive.
  const load = useCallback(
    () =>
      Promise.all([listAssessments(), listObservations(reference)]).then(
        ([all, captured]) => {
          setAssessment(all.find((a) => a.reference === reference) ?? null)
          setObservations(captured)
          setError(null)
        },
        (e: Error) => setError(e.message),
      ),
    [reference],
  )

  // Its locations too, once, unused here: that keeps a copy on the phone, so
  // the picker opens offline even if it wasn't opened online (MB-10 AC1).
  useEffect(() => {
    listLocations(reference).catch(() => {})
  }, [reference])

  // On open, and again on returning from the capture sheet, so a new
  // observation shows straight away (MB-03 AC11).
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )
  // After each upload, so one that was waiting shows from the gateway (MB-10
  // AC4). Not on open: the focus effect above has that.
  const seenUploads = useRef(uploads)
  useEffect(() => {
    if (uploads === seenUploads.current) return
    seenUploads.current = uploads
    load()
  }, [uploads, load])

  // Capture needs a location (CP-15 AC1), so without one the picker comes first.
  function newObservation() {
    const pathname = location ? '/assessment/[reference]/capture' : '/assessment/[reference]/locations'
    router.push({ pathname, params: { reference } })
  }

  // Asks first: it never reached the gateway, so it's gone for good (MB-10 AC6).
  function confirmDiscard(id: string) {
    Alert.alert('Discard this observation?', "It wasn't uploaded, so its photos, voice notes, scans and note are deleted.", [
      { text: 'Keep', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => discard(id) },
    ])
  }

  async function refresh() {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  // Archived or reassigned since Home loaded: say so rather than show a blank
  // workspace the engineer could go on filing observations into.
  if (assessment === null) {
    return (
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <Text className="text-lg font-semibold">{"This assessment isn't available"}</Text>
        <Text className="text-center text-muted-foreground">
          {embedded
            ? 'It may have been archived or assigned to someone else. Pull down on your list to refresh it.'
            : 'It may have been archived or assigned to someone else. Go back to Home to refresh your list.'}
        </Text>
      </View>
    )
  }

  // Only what was captured at the chosen location (AC4); the gateway sends newest first.
  const here = location && observations ? observations.filter((o) => o.location?.id === location.id) : []
  // Waiting to upload from here, newest first, above the gateway's (MB-10 AC2).
  // Refused ones show from any location, so each can be found and discarded.
  const queued = items.filter(
    (i): i is QueuedObservation =>
      i.kind === 'observation' && i.reference === reference && (!!i.error || i.locationId === location?.id),
  )
  const rows = [...queued.map(asObservation).reverse(), ...here]
  const status = assessment && STATUS[assessment.status]
  const Bar = embedded ? View : SafeAreaView

  return (
    <View testID="workspace-screen" className="flex-1">
      {/* The site name is in the band below, so the header carries only Back. */}
      {!embedded && <Stack.Screen options={{ title: '' }} />}
      <FlatList
        testID="workspace"
        data={rows}
        keyExtractor={(o) => o.id}
        renderItem={({ item, index }) => {
          const waiting = queued.find((q) => q.id === item.id)
          return (
            // On a tablet, rows keep to the readable column (MB-09).
            <View className={readable}>
              <ObservationCard
                observation={item}
                first={index === 0}
                last={index === rows.length - 1}
                upload={waiting && { refused: waiting.error }}
                onDiscard={waiting && (() => confirmDiscard(waiting.id))}
                onOpen={() =>
                  router.push({ pathname: '/assessment/[reference]/observation/[id]', params: { reference, id: item.id } })
                }
              />
            </View>
          )
        }}
        contentContainerClassName="pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            {assessment && status && (
              <View className="bg-navy px-4 pb-5">
                <View className={cn('gap-1.5', readable)}>
                  <Text className="text-2xl font-bold text-white">{assessment.site.name}</Text>
                  <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
                    <Text className="text-[#d6dde8]">{assessment.client}</Text>
                    <Badge variant={status.tone}>
                      <Text>{status.label}</Text>
                    </Badge>
                  </View>
                  <View className="flex-row flex-wrap gap-x-4">
                    <Text className="tabular-nums text-sm text-[#b9c4d6]">{assessment.reference}</Text>
                    <Text className="tabular-nums text-sm text-[#b9c4d6]">{formatDate(assessment.siteVisitDate)}</Text>
                  </View>
                </View>
              </View>
            )}
            <View className={cn('gap-4 px-4', readable)}>
              <OfflineNote />
              {error && (
                <View className="rounded-md bg-destructive/10 p-3">
                  <Text className="text-destructive">{error}</Text>
                </View>
              )}
              {location && <Eyebrow>{`Captured here · ${rows.length}`}</Eyebrow>}
            </View>
          </View>
        }
        ListEmptyComponent={
          location && observations ? (
            <Text className="py-6 text-center text-muted-foreground">Nothing captured here yet.</Text>
          ) : undefined
        }
      />
      {/* One way in, in thumb reach, below the list rather than over it, with the
          location it files to right above: one observation holds a note,
          photos, voice notes and scans together. */}
      {/* Embedded, the tab bar below already clears the home indicator. */}
      <Bar edges={['bottom']} className="border-t border-border bg-card px-4 pt-2">
        <View className={cn('gap-2', readable)}>
          <CurrentLocationCard
            location={location}
            onChange={() => router.push({ pathname: '/assessment/[reference]/locations', params: { reference } })}
          />
          <Button size="lg" accessibilityLabel="New observation" onPress={newObservation} className="mb-2">
            <Plus color="#ffffff" size={20} />
            <Text className="text-lg">New observation</Text>
          </Button>
        </View>
      </Bar>
    </View>
  )
}
