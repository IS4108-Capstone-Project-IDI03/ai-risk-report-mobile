// Assessment workspace (MB-02 AC1-AC6, MB-03 AC1-AC2): opened from Home. Shows
// the assessment, where the engineer is, what's been captured there, and the
// New observation button. Opening it never starts a capture session (MB-02
// AC6): that reopens a completed assessment, so saving the first one starts it.
// MB-07: the assessment's details sit in a navy band under the header, and the
// location bar and New observation sit together at the bottom, in thumb reach.
// MB-09: WorkspaceView is also Home's right-hand pane in the iPad split view;
// the route below renders it for the reference in the URL. MB-10: opens
// offline from the last copy, and lists observations waiting to upload first.
// MB-05: a switch, Observations | Checklist, under the band; the checklist shows in place
// of the observations, with the location bar and New observation still below. On a wide
// iPad pane the two sit side by side instead, the checklist collapsible. MB-11: tapping an observation opens its detail. MB-12: swiping an uploaded one
// left deletes it, and Show deleted below the list restores.
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { ChevronDown, ChevronUp, Footprints, MapPin, Plus } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, FlatList, RefreshControl, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Eyebrow } from '@/components/Eyebrow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { easeLayout } from '@/lib/motion'
import { cn, readable } from '@/lib/utils'
import { CurrentLocationCard } from '@/features/locations/components/CurrentLocationCard'
import { listLocations } from '@/features/locations/api'
import { useCurrentLocation } from '@/features/locations/current'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { useOffline } from '@/features/offline/provider'
import { asObservation, type QueuedObservation } from '@/features/offline/queue'
import { deleteObservation, listObservations } from '@/features/observations/api'
import { confirmDelete } from '@/features/observations/confirmDelete'
import { DeletedSection } from '@/features/observations/components/DeletedSection'
import type { Item } from '@/features/checklist/api'
import { ChecklistView } from '@/features/checklist/components/ChecklistView'
import { useChecklist } from '@/features/checklist/useChecklist'
import { ObservationCard } from '@/features/observations/components/ObservationCard'
import { SwipeDelete } from '@/features/observations/components/SwipeDelete'
import type { Observation } from '@/features/observations/format'
import CaptureSheet from '@/features/capture/screens/CaptureSheet'
import { ChecklistPane } from '../components/ChecklistPane'
import { WorkspaceSwitch, type Side } from '../components/WorkspaceSwitch'
import { listAssessments } from '../api'
import { formatDate, STATUS, type Assessment } from '../format'

export default function Workspace() {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  return <WorkspaceView reference={reference} />
}

// `embedded`: inside Home's split view, where there's no stack header to set.
// `leading`: a button for the band's left edge; Home passes "Show assessments"
// there while its list is hidden (MB-09 AC7).
export function WorkspaceView({ reference, embedded = false, leading }: { reference: string; embedded?: boolean; leading?: ReactNode }) {
  const [location] = useCurrentLocation(reference)
  // undefined while loading; null once the list arrives without it.
  const [assessment, setAssessment] = useState<Assessment | null | undefined>(undefined)
  const [observations, setObservations] = useState<Observation[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { items, uploads, discard, offline } = useOffline()
  // Which side of the switch is shown (MB-05 AC1), and the checklist, read once for both
  // the switch's progress and the view.
  const [side, setSide] = useState<Side>('observations')
  const checklist = useChecklist(reference)
  const list = checklist.body?.checklist
  const progress = list ? { done: list.items.filter((i) => i.check).length, total: list.items.length } : null
  // The pane's own width, measured (it is Home's right-hand side on a split view, not
  // the window's). From 760pt the observations and the checklist go side by side, the
  // checklist collapsible; below it the switch is used (MB-05 AC20, AC21).
  const [paneWidth, setPaneWidth] = useState(0)
  const together = paneWidth >= 760
  const [collapsed, setCollapsed] = useState(false)
  // Side by side, New observation opens its form here, in place of the observations,
  // so the checklist beside it stays on screen and scrollable (MB-09 AC4).
  const [capturing, setCapturing] = useState(false)
  // The navy band as one line, to give the lists the height (wide only).
  const [compact, setCompact] = useState(false)
  // The checklist item the form is answering, when it was opened from Confirm or Differs.
  const [answer, setAnswer] = useState<{ item: Item; result: 'confirmed' | 'differs' } | undefined>()
  // Opens or closes the form.
  function openForm(on: boolean, next?: typeof answer) {
    easeLayout()
    setCapturing(on)
    setAnswer(next)
  }
  // Wide, the page fills the width with 32pt side padding, as the web's design system
  // asks ("collapsed sidebar = full width"). Narrower, it keeps the 640pt column.
  const col = together ? '' : readable
  const pad = together ? 'px-8' : 'px-4'

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
    if (together && location) return openForm(true)
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

  // Asks, then deletes on the gateway (soft: it is kept). Either way the list is read
  // again, so one that was already gone, or removed on the web, leaves it. A refusal
  // is said in an alert, not above the list, which may be scrolled out of view
  // (MB-12 AC10, AC12).
  function confirmRemove(id: string) {
    confirmDelete(() => {
      deleteObservation(id).then(
        () => {
          // Gone at once: if the signal drops now, the reload falls back to the saved
          // copy, which still has it.
          setObservations((all) => all && all.filter((o) => o.id !== id))
          return load()
        },
        async (e: unknown) => {
          await load()
          Alert.alert("Couldn't delete this observation", errorText(e))
        },
      )
    })
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
  // The band and the offline note, and (below 760pt) the switch between them: on top of
  // either side of the switch. Side by side, they sit above both columns instead.
  const top = (
    <View className={together ? undefined : 'gap-4 pb-2'}>
      {assessment && status && together && compact ? (
        // One line: the site, its status and reference, and the way back to the full band.
        <View className={cn('min-h-14 flex-row items-center gap-3 bg-navy pb-1', pad)}>
          {leading}
          <Text className="shrink text-lg font-bold text-white" numberOfLines={1}>{assessment.site.name}</Text>
          <Badge variant={status.tone}>
            <Text>{status.label}</Text>
          </Badge>
          <Text className="flex-1 tabular-nums text-sm text-[#b9c4d6]" numberOfLines={1}>{assessment.reference}</Text>
          <Button variant="header" accessibilityLabel="Show details" onPress={() => { easeLayout(); setCompact(false) }}>
            <ChevronDown color="#ffffff" size={20} />
            <Text>Details</Text>
          </Button>
        </View>
      ) : (
        assessment &&
        status && (
          <View className={cn('bg-navy pb-5', pad)}>
            {/* Over the band's corner, so it adds no height. */}
            {together && (
              <View className="absolute right-6 top-0 z-10">
                <Button variant="header" accessibilityLabel="Collapse details" onPress={() => { easeLayout(); setCompact(true) }}>
                  <ChevronUp color="#ffffff" size={20} />
                  <Text>Collapse</Text>
                </Button>
              </View>
            )}
            <View className={cn('gap-1.5', col)}>
              {leading && <View className="mb-2 flex-row">{leading}</View>}
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
            {/* The site's pins and directions (MB-02 AC19), at the band's lower corner so the band
                doesn't grow. */}
            <View className="absolute bottom-2 right-4">
              <Button
                variant="header"
                accessibilityLabel="Site pins"
                onPress={() => router.push({ pathname: '/assessment/[reference]/site-pins', params: { reference } })}
              >
                <MapPin color="#ffffff" size={18} />
                <Text>Site pins</Text>
              </Button>
            </View>
          </View>
        )
      )}
      <View className={cn('gap-4', pad, col)}>
        {!together && <WorkspaceSwitch side={side} onChange={setSide} progress={progress} />}
        <OfflineNote />
      </View>
    </View>
  )

  // The observations, for either layout.
  const observationList = (
      <FlatList
        testID="workspace"
        data={rows}
        keyExtractor={(o) => o.id}
        renderItem={({ item, index }) => {
          const waiting = queued.find((q) => q.id === item.id)
          return (
            // On a tablet, rows keep to the readable column (MB-09).
            <View className={together ? 'px-4' : readable}>
              {/* Swipe to delete: only for an uploaded one, and with a signal (MB-12 AC13, AC14). */}
              <SwipeDelete
                first={index === 0}
                last={index === rows.length - 1}
                onDelete={waiting || offline ? undefined : () => confirmRemove(item.id)}
              >
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
              </SwipeDelete>
            </View>
          )
        }}
        contentContainerClassName="pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View>
            {!together && top}
            <View className={cn('gap-4 pb-2', together && 'pt-6', pad, col)}>
              {error && (
                <View className="rounded-md bg-destructive/10 p-3">
                  <Text className="text-destructive">{error}</Text>
                </View>
              )}
              {location && <Eyebrow>{`Captured here · ${rows.length}`}</Eyebrow>}
            </View>
          </View>
        }
        ListFooterComponent={
          location ? (
            <View className={cn('pt-4', pad, col)}>
              <DeletedSection key={location.id} reference={reference} locationId={location.id} offline={offline} watch={observations} onRestored={load} />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          location && observations ? (
            <Text className="py-6 text-center text-muted-foreground">Nothing captured here yet.</Text>
          ) : undefined
        }
      />
  )

  return (
    <View testID="workspace-screen" className="flex-1" onLayout={(e) => setPaneWidth(e.nativeEvent.layout.width)}>
      {/* The site name is in the band below, so the header carries only Back. */}
      {!embedded && <Stack.Screen options={{ title: '' }} />}
      {together ? (
        <>
          {top}
          <View className="flex-1 flex-row">
            <View className="flex-1">
              {capturing ? (
                <CaptureSheet
                  reference={reference}
                  embedded={embedded}
                  answer={answer}
                  // The answer may have changed the checklist: read it again.
                  onClose={() => {
                    openForm(false)
                    checklist.load()
                  }}
                />
              ) : (
                observationList
              )}
            </View>
            <ChecklistPane wide={paneWidth >= 1100} collapsed={collapsed} onToggle={() => { easeLayout(); setCollapsed(!collapsed) }} progress={progress && `${progress.done}/${progress.total}`}>
              <ChecklistView reference={reference} state={checklist} header={null} answerBeside={(item, result) => openForm(true, { item, result })} />
            </ChecklistPane>
          </View>
        </>
      ) : side === 'checklist' ? (
        <ChecklistView reference={reference} state={checklist} header={top} />
      ) : (
        observationList
      )}
      {/* One way in, in thumb reach, below the list rather than over it, with the
          location it files to right above: one observation holds a note,
          photos, voice notes and scans together. */}
      {/* Embedded, the tab bar below already clears the home indicator. */}
      {!(together && capturing) && (
  <Bar edges={['bottom']} className={cn('border-t border-border bg-card pt-2', pad)}>
          {/* Wide: the location and the button share one row, so the bar stays slim. */}
          <View className={cn(together ? 'mb-2 flex-row items-center gap-6' : 'gap-2', col)}>
            <View className={together ? 'flex-1' : undefined}>
              <CurrentLocationCard
                location={location}
                onChange={() => router.push({ pathname: '/assessment/[reference]/locations', params: { reference } })}
              />
            </View>
            {/* New observation for one thing; Site walk to record while walking round (MB-16 AC1). */}
            <View className={together ? 'flex-row gap-3' : 'mb-2 flex-row gap-3'}>
              <Button
                size="lg"
                variant="outline"
                accessibilityLabel="Site walk"
                onPress={() => router.push({ pathname: '/assessment/[reference]/site-walks', params: { reference } })}
                className={together ? 'w-48' : 'flex-1'}
              >
                <Footprints color="#1a1f26" size={20} />
                <Text className="text-lg">Site walk</Text>
              </Button>
              <Button size="lg" accessibilityLabel="New observation" onPress={newObservation} className={together ? 'w-72' : 'flex-[1.6]'}>
                <Plus color="#ffffff" size={20} />
                <Text className="text-lg">New observation</Text>
              </Button>
            </View>
          </View>
        </Bar>
      )}
    </View>
  )
}
