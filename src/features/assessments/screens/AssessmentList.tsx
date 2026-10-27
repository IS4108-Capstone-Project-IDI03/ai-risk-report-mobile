// Assessment list (MB-01 AC8-AC11), the Home tab, with search and filters
// (MB-04). Calls GET /api/assessments, which returns only the engineer's own,
// newest site visit first; filtering happens on the phone, as on the web.
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { listAssessments } from '../api'
import { AssessmentRow } from '../components/AssessmentRow'
import { DateChips } from '../components/DateChips'
import { SearchBar } from '../components/SearchBar'
import { StatusChips } from '../components/StatusChips'
import { DATE_FILTERS, matches, noFilters, type DateFilter, type Filters } from '../filters'
import type { Assessment } from '../format'

export default function AssessmentList() {
  const [assessments, setAssessments] = useState<Assessment[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(noFilters)

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

  const all = assessments ?? []
  const shown = all.filter((a) => matches(a, filters))
  const filtering = filters.search.trim() !== '' || filters.status !== null || filters.date !== null
  // The date chips count every assessment, whatever the search and status (AC4).
  const counts = Object.fromEntries(
    Object.entries(DATE_FILTERS).map(([key, test]) => [key, all.filter(test).length]),
  ) as Record<DateFilter, number>
  const set = (change: Partial<Filters>) => setFilters((f) => ({ ...f, ...change }))

  return (
    <FlatList
      testID="assessment-list"
      data={shown}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <AssessmentRow assessment={item} />}
      contentContainerClassName="gap-3 p-4"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        // The filters stay on screen with an error (e.g. a failed refresh), so a
        // filtered list is never shown without the controls that filtered it.
        <View className="gap-3 pb-1">
          {error && (
            <View className="rounded-md bg-destructive/10 p-3">
              <Text className="text-destructive">{error}</Text>
            </View>
          )}
          {all.length > 0 && (
            <>
              <SearchBar value={filters.search} onChange={(search) => set({ search })} />
              <DateChips
                counts={counts}
                selected={filters.date}
                onToggle={(date) => set({ date: filters.date === date ? null : date })}
              />
              <StatusChips selected={filters.status} onChange={(status) => set({ status })} />
              <Text className="text-sm text-muted-foreground">
                {filtering
                  ? `${shown.length} of ${all.length} assessments`
                  : all.length === 1
                    ? '1 assessment'
                    : `${all.length} assessments`}
              </Text>
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        // Only after the first load, so an empty message doesn't flash while loading.
        !assessments ? undefined : all.length ? (
          <View className="mt-6 items-center gap-3 px-4">
            <Text className="text-center text-muted-foreground">No assessments match those filters.</Text>
            <Button variant="outline" accessibilityLabel="Clear filters" onPress={() => setFilters(noFilters)}>
              <Text>Clear filters</Text>
            </Button>
          </View>
        ) : error ? undefined : (
          <Text className="mt-8 px-4 text-center text-muted-foreground">
            No assessments assigned. Assessments appear here once one is created for you on the web
            app.
          </Text>
        )
      }
    />
  )
}
