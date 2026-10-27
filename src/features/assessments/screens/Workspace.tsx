// Assessment workspace (MB-02 AC1-AC6): opened from Home. Shows the
// assessment, where the engineer is, and what's been captured there. Opening it
// never starts a capture session (AC6): that reopens a completed assessment,
// so MB-03 starts one only when the first observation is saved.
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { CurrentLocationCard } from '@/features/locations/components/CurrentLocationCard'
import { useCurrentLocation } from '@/features/locations/current'
import { listObservations } from '@/features/observations/api'
import { ObservationCard } from '@/features/observations/components/ObservationCard'
import type { Observation } from '@/features/observations/format'
import { listAssessments } from '../api'
import { formatDate, STATUS, type Assessment } from '../format'

// The 11px letterspaced structural label from the design system.
function Eyebrow({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">{children}</Text>
  )
}

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

  useEffect(() => {
    load()
  }, [load])

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
    <>
      <Stack.Screen options={{ title: assessment?.site.name ?? '' }} />
      <FlatList
        testID="workspace"
        data={here}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <ObservationCard observation={item} />}
        contentContainerClassName="gap-3 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="gap-5 pb-1">
            {error && (
              <View className="rounded-md bg-destructive/10 p-3">
                <Text className="text-destructive">{error}</Text>
              </View>
            )}
            {assessment && status && (
              <Card className="gap-1 px-4 py-4">
                <Text className="text-xl font-semibold">{assessment.client}</Text>
                <Text className="text-muted-foreground">{assessment.site.name}</Text>
                <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-2">
                  <Text className="font-mono text-sm text-muted-foreground">{assessment.reference}</Text>
                  <Text className="font-mono text-sm text-muted-foreground">
                    {formatDate(assessment.siteVisitDate)}
                  </Text>
                  <Badge variant={status.tone}>
                    <Text>{status.label}</Text>
                  </Badge>
                </View>
              </Card>
            )}
            <View className="gap-2">
              <Eyebrow>Location</Eyebrow>
              <CurrentLocationCard
                location={location}
                onChange={() =>
                  router.push({ pathname: '/assessment/[reference]/locations', params: { reference } })
                }
              />
            </View>
            {location && <Eyebrow>{`Captured here · ${here.length}`}</Eyebrow>}
          </View>
        }
        ListEmptyComponent={
          location && observations ? (
            <Text className="py-6 text-center text-muted-foreground">Nothing captured here yet.</Text>
          ) : undefined
        }
      />
    </>
  )
}
