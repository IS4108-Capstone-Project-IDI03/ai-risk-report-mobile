// The Scans screen (MB-17 AC1-AC6, CP-19 AC17): every handwritten page of this assessment's observations
// that aren't deleted, newest first, with what was read from it. Opened by Scans in the workspace's
// header. Calls listObservations (the same cached list the workspace reads, so it opens offline), and
// reads it again every few seconds while a page is still being read, as the detail does.
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { cn, readable } from '@/lib/utils'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { useOffline } from '@/features/offline/provider'
import { asObservation } from '@/features/offline/queue'
import { listObservations } from '../api'
import { ScanRow } from '../components/ScanRow'
import type { Observation, Page } from '../format'
import { POLL_LIMIT, POLL_MS } from '../transcriptPoll'

type Scan = { page: Page; observation: Observation }

// Newest observation first; a page keeps its place inside its observation.
function scansOf(all: Observation[]): Scan[] {
  return [...all]
    .filter((o) => !o.deleted)
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
    .flatMap((observation) => observation.pages.map((page) => ({ page, observation })))
}

export default function Scans() {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  const { items } = useOffline()
  const [listed, setListed] = useState<Observation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Goes up to read again: pull to refresh, the poll, and coming back from a detail.
  const [reads, setReads] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const polls = useRef(0)
  const [gaveUp, setGaveUp] = useState(false)
  const focused = useIsFocused()

  // Coming back from an observation (it may have read a page again): the first focus is the mount.
  const seen = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (seen.current) setReads((n) => n + 1)
      seen.current = true
    }, []),
  )

  // `live` drops a reply that arrives after the screen has gone.
  useEffect(() => {
    let live = true
    listObservations(reference).then(
      (all) => {
        if (!live) return
        setListed(all)
        setError(null)
        setRefreshing(false)
      },
      (e) => {
        if (!live) return
        setError(errorText(e))
        setRefreshing(false)
      },
    )
    return () => {
      live = false
    }
  }, [reference, reads])

  // Observations still waiting to upload (MB-10) have pages on the phone too: show them, marked as waiting.
  const waiting = items.flatMap((i) => (i.kind === 'observation' && i.reference === reference ? [asObservation(i)] : []))
  const scans = listed && scansOf([...waiting, ...listed])

  // While a page is being read, read the list again (AC4), only while this screen is showing (an open
  // detail polls too); stop after about 2 minutes and say so, as the detail does.
  const working = !!scans?.some((s) => s.page.transcription?.status === 'transcribing')
  useEffect(() => {
    if (!working || !focused) return
    polls.current = 0
    const timer = setInterval(() => {
      if (++polls.current > POLL_LIMIT) {
        setGaveUp(true)
        clearInterval(timer)
      } else setReads((n) => n + 1)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [working, focused])

  if (error && !scans)
    return (
      <View testID="scans" className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-center text-muted-foreground">{error}</Text>
      </View>
    )
  if (!scans)
    return (
      <View testID="scans" className="flex-1 items-center justify-center">
        <ActivityIndicator color="#000f47" />
      </View>
    )

  return (
    <ScrollView
      testID="scans"
      contentContainerClassName="gap-3 p-4 pb-8"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true)
            setGaveUp(false)
            setReads((n) => n + 1)
          }}
        />
      }
    >
      <View className={cn('gap-3', readable)}>
        <OfflineNote />
        {error && <Text className="text-sm text-destructive">{error}</Text>}
        {gaveUp && working && <Text className="text-sm text-muted-foreground">Still working. Pull down to check again.</Text>}
        {scans.length === 0 ? (
          <Text className="py-8 text-center text-base text-muted-foreground">
            No scanned pages yet. Scan a page when you add an observation.
          </Text>
        ) : (
          scans.map(({ page, observation }) => (
            <ScanRow
              key={`${observation.id}:${page.id ?? page.url}`}
              page={page}
              observation={observation}
              onOpen={() =>
                router.push({ pathname: '/assessment/[reference]/observation/[id]', params: { reference, id: observation.id } })
              }
            />
          ))
        )}
      </View>
    </ScrollView>
  )
}
