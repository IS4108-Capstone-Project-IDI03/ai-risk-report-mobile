// Assessment workspace (MB-02 AC1-AC6, MB-03 AC1-AC2): opened from Home. Shows
// the assessment, where the engineer is, what's been captured there, and the
// New observation button. Opening it never starts a capture session (MB-02
// AC6): that reopens a completed assessment, so saving the first one starts it.
// MB-07: the assessment's details sit in a navy band under the header, and the
// location bar and New observation sit together at the bottom, in thumb reach.
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Eyebrow } from '@/components/Eyebrow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { CurrentLocationCard } from '@/features/locations/components/CurrentLocationCard'
import { useCurrentLocation } from '@/features/locations/current'
import { listObservations } from '@/features/observations/api'
import { ObservationCard } from '@/features/observations/components/ObservationCard'
import type { Observation } from '@/features/observations/format'
import { listAssessments } from '../api'
import { formatDate, STATUS, type Assessment } from '../format'

export default function Workspace() {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  const [location] = useCurrentLocation(reference)
  // undefined while loading; null once the list arrives without it.
  const [assessment, setAssessment] = useState<Assessment | null | undefined>(undefined)
  const [observations, setObservations] = useState<Observation[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // On open, and again on returning from the capture sheet, so a new
  // observation shows straight away (MB-03 AC11).
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  // Capture needs a location (CP-15 AC1), so without one the picker comes first.
  function newObservation() {
    const pathname = location ? '/assessment/[reference]/capture' : '/assessment/[reference]/locations'
    router.push({ pathname, params: { reference } })
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
          It may have been archived or assigned to someone else. Go back to Home to refresh your list.
        </Text>
      </View>
    )
  }

  // Only what was captured at the chosen location (AC4); the gateway sends newest first.
  const here = location && observations ? observations.filter((o) => o.location?.id === location.id) : []
  const status = assessment && STATUS[assessment.status]

  return (
    <View testID="workspace-screen" className="flex-1">
      {/* The site name is in the band below, so the header carries only Back. */}
      <Stack.Screen options={{ title: '' }} />
      <FlatList
        testID="workspace"
        data={here}
        keyExtractor={(o) => o.id}
        renderItem={({ item, index }) => (
          <ObservationCard observation={item} first={index === 0} last={index === here.length - 1} />
        )}
        contentContainerClassName="pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            {assessment && status && (
              <View className="gap-1.5 bg-navy px-4 pb-5">
                <Text className="text-2xl font-bold text-white">{assessment.site.name}</Text>
                <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  <Text className="text-[#d6dde8]">{assessment.client}</Text>
                  <Badge variant={status.tone}>
                    <Text>{status.label}</Text>
                  </Badge>
                </View>
                <View className="flex-row flex-wrap gap-x-4">
                  <Text className="font-mono text-sm text-[#b9c4d6]">{assessment.reference}</Text>
                  <Text className="font-mono text-sm text-[#b9c4d6]">{formatDate(assessment.siteVisitDate)}</Text>
                </View>
              </View>
            )}
            {error && (
              <View className="mx-4 rounded-md bg-destructive/10 p-3">
                <Text className="text-destructive">{error}</Text>
              </View>
            )}
            {location && (
              <View className="px-4">
                <Eyebrow>{`Captured here · ${here.length}`}</Eyebrow>
              </View>
            )}
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
      <SafeAreaView edges={['bottom']} className="gap-2 border-t border-border bg-card px-4 pt-2">
        <CurrentLocationCard
          location={location}
          onChange={() => router.push({ pathname: '/assessment/[reference]/locations', params: { reference } })}
        />
        <Button size="lg" accessibilityLabel="New observation" onPress={newObservation} className="mb-2">
          <Plus color="#ffffff" size={20} />
          <Text className="text-lg">New observation</Text>
        </Button>
      </SafeAreaView>
    </View>
  )
}
