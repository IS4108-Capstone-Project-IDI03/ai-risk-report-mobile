// The Site walks screen (MB-16 AC1-AC4): this assessment's walks not yet created, newest first, each
// with its status. A walk being transcribed or proposed is read again every few seconds until it is
// done. Try again, Rename and Discard are here; Review opens a ready walk. Opened by
// Site walk in the workspace's bottom bar. Calls the walk routes in ../api.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Footprints } from 'lucide-react-native'
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { cn, readable } from '@/lib/utils'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { useOffline } from '@/features/offline/provider'
import { discardWalk, listWalks, renameWalk, retryWalk, startWalk, type SiteWalk } from '../api'
import { working } from '../format'
import { forgetWalk } from '../pending'
import { WalkRow } from '../components/WalkRow'
import { WALK_POLL_MS } from '../poll'

export default function SiteWalks() {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  const { offline } = useOffline()
  const [walks, setWalks] = useState<SiteWalk[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The walk being changed, so only one change runs at a time.
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  // Goes up to read again (Try again, and after a change).
  const [reads, setReads] = useState(0)

  // Coming back from the recorder or the review: the walk has moved on (Finish, Create all). The first
  // focus is the mount, which reads already.
  const seen = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (seen.current) setReads((n) => n + 1)
      seen.current = true
    }, []),
  )

  const read = useCallback(() => listWalks(reference), [reference])
  useEffect(() => {
    let live = true
    read().then(
      (all) => {
        if (!live) return
        setWalks(all)
        setError(null)
      },
      (e) => live && setError(errorText(e)),
    )
    return () => {
      live = false
    }
  }, [read, reads])

  // While any walk is being worked on by the gateway, read the list again (AC3).
  const anyWorking = !!walks?.some((w) => working(w.status))
  useEffect(() => {
    if (!anyWorking) return
    const timer = setInterval(() => setReads((n) => n + 1), WALK_POLL_MS)
    return () => clearInterval(timer)
  }, [anyWorking])

  // One change at a time. A refusal says why and reads the list again, in case it moved on.
  async function change(id: string, job: () => Promise<unknown>) {
    if (busy) return
    setBusy(id)
    setProblem(null)
    try {
      await job()
    } catch (e) {
      setProblem(errorText(e))
    } finally {
      setBusy(null)
      setReads((n) => n + 1)
    }
  }

  // Opens a walk's recorder (AC5).
  const record = (walkId: string) => router.push({ pathname: '/assessment/[reference]/site-walk-recording', params: { reference, walkId } })

  const review = (walkId: string) => router.push({ pathname: '/assessment/[reference]/site-walk-review', params: { reference, walkId } })

  function confirmDiscard(walk: SiteWalk) {
    Alert.alert('Discard this walk?', 'Its recordings, photos and notes are deleted.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => change(walk.id, async () => {
        await discardWalk(reference, walk.id)
        forgetWalk(walk.id)
      }) },
    ])
  }

  if (error && !walks)
    return (
      <View testID="site-walks" className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-center text-muted-foreground">{error}</Text>
        <Button variant="outline" accessibilityLabel="Try again" onPress={() => setReads((n) => n + 1)}>
          <Text>Try again</Text>
        </Button>
      </View>
    )
  if (!walks)
    return (
      <View testID="site-walks" className="flex-1 items-center justify-center">
        <ActivityIndicator color="#000f47" />
      </View>
    )

  return (
    <ScrollView testID="site-walks" contentContainerClassName="gap-3 p-4 pb-10">
      <View className={cn('gap-3', readable)}>
        <OfflineNote />
        {/* My walk still being recorded opens again; else a new one starts, and its recorder opens (AC5). */}
        <Button size="lg" accessibilityLabel="Start a walk" disabled={busy !== null || offline} onPress={() => change('start', async () => record((await startWalk(reference)).id))}>
          <Footprints color="#ffffff" size={20} />
          <Text className="text-lg">Start a walk</Text>
        </Button>
        {problem && (
          <View className="rounded-md bg-destructive/10 p-3">
            <Text className="text-destructive">{problem}</Text>
          </View>
        )}
        {walks.length === 0 ? (
          <Text className="py-8 text-center text-muted-foreground">No site walks yet.</Text>
        ) : (
          walks.map((walk) => (
            <WalkRow
              key={walk.id}
              walk={walk}
              busy={busy !== null || offline}
              onOpen={() => record(walk.id)}
              onReview={() => review(walk.id)}
              onRetry={() => change(walk.id, () => retryWalk(reference, walk.id))}
              onRename={async (name) => void (await renameWalk(reference, walk.id, name), setReads((n) => n + 1))}
              onDiscard={() => confirmDiscard(walk)}
            />
          ))
        )}
      </View>
    </ScrollView>
  )
}
