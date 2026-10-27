// Assessment list (MB-01 AC8-AC11), the Home tab. Calls GET /api/assessments,
// which returns only the engineer's own, newest site visit first.
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { listAssessments } from '../api'
import { AssessmentRow } from '../components/AssessmentRow'
import type { Assessment } from '../format'

export default function AssessmentList() {
  const [assessments, setAssessments] = useState<Assessment[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Archived assessments are left out (AC9): the gateway refuses capture on them.
  // State is set in the promise's callbacks, once the reply arrives.
  const load = useCallback(
    () =>
      listAssessments().then(
        (all) => {
          setAssessments(all.filter((a) => a.status !== 'archived'))
          setError(null)
        },
        // A 401 has already sent the engineer to sign-in (src/lib/api.ts).
        (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
      ),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  async function refresh() {
    setRefreshing(true)
    try {
      await load()
    } finally {
      // Without this, a failed reload leaves the spinner up for good.
      setRefreshing(false)
    }
  }

  return (
    <FlatList
        testID="assessment-list"
        data={assessments ?? []}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AssessmentRow assessment={item} />}
        contentContainerClassName="gap-3 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          error ? (
            <View className="rounded-md bg-destructive/10 p-3">
              <Text className="text-destructive">{error}</Text>
            </View>
          ) : assessments?.length ? (
            <Text className="text-sm text-muted-foreground">
              {assessments.length === 1 ? '1 assessment' : `${assessments.length} assessments`}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          // Only after the first load, so "no assessments" doesn't flash while loading.
          assessments && !error ? (
            <Text className="mt-8 px-4 text-center text-muted-foreground">
              No assessments assigned. Assessments appear here once one is created for you on
              the web app.
            </Text>
          ) : undefined
        }
      />
  )
}
