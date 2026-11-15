// The review of a ready site walk (MB-16 AC13-AC31): the AI's proposed observations by location,
// each tappable to edit; a location chooser and filters; places to add, rename, match or delete;
// deleted ones to restore (with Undo); and Create all, which adds everything to the assessment once.
// Every edit is autosaved (useProposal). Opened by Review on the Site walks screen. Calls ../useProposal
// and ../proposal; the pieces are in ../components.
import { router, useLocalSearchParams } from 'expo-router'
import { ChevronDown, ChevronLeft } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { samePlace, type Location } from '@/features/locations/locations'
import { cn, readable } from '@/lib/utils'
import { AddObservationSheet } from '../components/AddObservationSheet'
import { DeletedList } from '../components/DeletedList'
import { FilterBar } from '../components/FilterBar'
import { LocationSheet } from '../components/LocationSheet'
import { MediaList } from '../components/MediaList'
import { ObservationEditor } from '../components/ObservationEditor'
import { ObservationRow } from '../components/ObservationRow'
import { PlaceSheet } from '../components/PlaceSheet'
import { ReviewHeader } from '../components/ReviewHeader'
import { SamePlaceSheet } from '../components/SamePlaceSheet'
import { WALK_STATUS } from '../format'
import {
  addLocation, ALL, confirmMessage, createdMessage, createProblem, firstIncomplete, incompleteCount, inputOf, linkLocation, locationProblem, matchesFilters, NEEDS_LOCATION, NO_FILTERS,
  placeName, removeLocation, removeObservation, renameLocation, restoreObservation, sameAs, sectionsAt, updateObservation, type LocationInput,
} from '../proposal'
import { useProposal } from '../useProposal'

// The list, or one of the screens that replace it (back goes to the list).
type Screen = 'list' | 'deleted' | 'photos' | 'pages'
const SCREEN_TITLE = { deleted: 'Deleted observations', photos: 'All photos', pages: 'All handwritten pages' }

// Which sheet is open over the review, if any.
type Sheet = { kind: 'places' } | { kind: 'add' } | { kind: 'location'; ref: string | null } | { kind: 'same'; ref: string } | null

export default function WalkReview() {
  const { reference, walkId } = useLocalSearchParams<{ reference: string; walkId: string }>()
  const r = useProposal(reference, walkId)
  const [openRef, setOpenRef] = useState<string | null>(null)
  const [picked, setPicked] = useState(ALL)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [screen, setScreen] = useState<Screen>('list')
  // The observation just deleted, and where it was, so Undo can put it back there.
  const [undo, setUndo] = useState<{ ref: string; at: number } | null>(null)
  const { walk, proposal: p } = r

  if (!walk || !p) {
    // Not loaded, or the gateway has no proposal yet (still working, or failed).
    const status = walk && WALK_STATUS[walk.status]
    return (
      <View testID="walk-review" className="flex-1 items-center justify-center gap-3 px-8">
        {r.problem ? <Text className="text-center text-destructive">{r.problem}</Text> : status ? <Text className="text-center text-muted-foreground">{`This walk isn't ready to review: ${status.label.toLowerCase()}.`}</Text> : <ActivityIndicator color="#000f47" />}
        {walk?.status === 'failed' && (
          <Button variant="outline" accessibilityLabel="Try again" onPress={r.retry}>
            <Text>Try again</Text>
          </Button>
        )}
      </View>
    )
  }

  // a. What to show: the chosen place (All if it was deleted), narrowed by the filters.
  const selected = picked === ALL || picked === NEEDS_LOCATION || p.locations.some((l) => l.ref === picked) ? picked : ALL
  const title = selected === ALL ? 'All locations' : selected === NEEDS_LOCATION ? 'No location yet' : placeName(p, selected)
  const inPlace = sectionsAt(p, selected)
  const shown = inPlace.map((s) => ({ ...s, items: s.items.filter((o) => matchesFilters(o, filters, walk.media)) })).filter((s) => s.items.length)
  const total = inPlace.reduce((n, s) => n + s.items.length, 0)
  const count = shown.reduce((n, s) => n + s.items.length, 0)
  const open = p.observations.find((o) => o.ref === openRef) ?? null
  const left = incompleteCount(p)
  // The order the editor steps through: the whole list, whatever is filtered.
  const order = sectionsAt(p, ALL).flatMap((s) => s.items)
  // The assessment's places the proposal doesn't have yet.
  const others = r.existing.filter((l) => !p.locations.some((x) => x.existingId === l.id || samePlace(x, l)))
  const form = sheet?.kind === 'location' && sheet.ref ? p.locations.find((l) => l.ref === sheet.ref) : null

  // b. Places: add or rename (a refusal is thrown to the form), match to an existing one, delete.
  function savePlace(input: LocationInput) {
    const ref = sheet?.kind === 'location' ? sheet.ref : null
    const problem = locationProblem(p!, input, ref ?? undefined)
    if (problem) throw new Error(problem)
    if (ref) r.change((cur) => renameLocation(cur, ref, input))
    else {
      const added = addLocation(p!, input, r.existing)
      r.change(() => added.proposal)
      setPicked(added.location.ref)
    }
    setSheet(null)
  }
  function confirmDelete(ref: string) {
    const l = p!.locations.find((x) => x.ref === ref)!
    const n = p!.observations.filter((o) => o.locationRef === ref).length
    const moved = n === 0 ? 'It has no observations.' : `Its ${n === 1 ? 'observation moves' : `${n} observations move`} to “No location yet”, where you can choose a place for ${n === 1 ? 'it' : 'them'}.`
    Alert.alert('Delete this location?', `“${l.name}” is only in this proposal, so nothing on the assessment changes. ${moved}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete location', style: 'destructive', onPress: () => { r.change((cur) => removeLocation(cur, ref)); setSheet(null) } },
    ])
  }
  function matchPlace(ref: string, existing: Location) {
    const done = sameAs(p!, ref, existing)
    r.change(() => done.proposal)
    setPicked(done.ref)
    setSheet(null)
  }

  // c. Delete an observation: it goes to Deleted, and Undo puts it back where it was.
  function deleteObservation(ref: string) {
    setUndo({ ref, at: p!.observations.findIndex((o) => o.ref === ref) })
    r.change((cur) => removeObservation(cur, ref))
    setOpenRef(null)
  }

  // d. Create all: something missing is said at once, with no question; otherwise ask first (it can't be
  // undone here), then on success say what was added and go back to the Site walks screen, where this walk is gone.
  async function create() {
    if (await r.create()) {
      Alert.alert('Added to the assessment', createdMessage(p!))
      router.back()
    }
  }
  function askToCreate() {
    if (createProblem(p!)) return void r.create()
    Alert.alert('Create all?', confirmMessage(p!), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Create all', onPress: create },
    ])
  }

  return (
    <ScrollView testID="walk-review" contentContainerClassName="gap-4 p-4 pb-10">
      <View className={cn('gap-4', readable)}>
        <ReviewHeader
          name={walk.name ?? 'Site walk'}
          saveState={r.saveState}
          total={p.observations.length}
          left={left}
          onFix={() => setOpenRef(firstIncomplete(p)?.ref ?? null)}
          onRetry={() => void r.save()}
          onRename={r.rename}
        />
        {r.problem && (
          <View className="rounded-md bg-destructive/10 p-3">
            <Text className="text-destructive">{r.problem}</Text>
          </View>
        )}
        {screen !== 'list' && (
          <View className="gap-3">
            <Button variant="outline" accessibilityLabel="Back to the walk" onPress={() => setScreen('list')} className="self-start">
              <ChevronLeft color="#1a1f26" size={18} />
              <Text>Back to the walk</Text>
            </Button>
            <Text className="text-lg font-semibold">{SCREEN_TITLE[screen]}</Text>
            {screen === 'deleted' && <FilterBar filters={filters} onChange={setFilters} shown={(p.removed ?? []).filter((o) => matchesFilters(o, filters, walk.media)).length} total={p.removed?.length ?? 0} />}
            {screen === 'deleted' && <DeletedList proposal={p} walk={walk} filters={filters} onRestore={(ref) => r.change((cur) => restoreObservation(cur, ref))} />}
            {screen !== 'deleted' && <MediaList kind={screen} proposal={p} walk={walk} onOpen={(ref) => { setScreen('list'); setOpenRef(ref) }} />}
          </View>
        )}
        {screen === 'list' && <>
        <Button variant="outline" size="lg" accessibilityLabel={`Location: ${title}`} onPress={() => setSheet({ kind: 'places' })} className="justify-between">
          <Text className="flex-1">{title}</Text>
          <ChevronDown color="#1a1f26" size={18} />
        </Button>
        <FilterBar filters={filters} onChange={setFilters} shown={count} total={total} />
        {undo && (
          <View className="flex-row items-center justify-between rounded-md border border-border bg-card p-3">
            <Text>Observation deleted.</Text>
            <Button variant="outline" accessibilityLabel="Undo" onPress={() => { r.change((cur) => restoreObservation(cur, undo.ref, undo.at)); setUndo(null) }}>
              <Text>Undo</Text>
            </Button>
          </View>
        )}
        {shown.length === 0 && <Text className="text-muted-foreground">{total === 0 ? 'No observations here.' : 'No observations match these filters.'}</Text>}
        {shown.map((s) => (
          <View key={s.ref} className="gap-2">
            {selected === ALL && <Text className="text-sm font-semibold uppercase text-muted-foreground">{s.title}</Text>}
            {s.items.map((o) => (
              <ObservationRow key={o.ref} observation={o} onOpen={() => { setUndo(null); setOpenRef(o.ref) }} />
            ))}
          </View>
        ))}
        {!!p.removed?.length && (
          <Button variant="outline" accessibilityLabel={`Deleted (${p.removed.length})`} onPress={() => setScreen('deleted')}>
            <Text>{`Deleted (${p.removed.length})`}</Text>
          </Button>
        )}
        <Button variant="outline" size="lg" accessibilityLabel="Add observation" onPress={() => setSheet({ kind: 'add' })}>
          <Text>Add observation</Text>
        </Button>
        <Button size="lg" accessibilityLabel="Create all" disabled={r.creating || r.saveState === 'failed'} onPress={askToCreate}>
          {r.creating ? <ActivityIndicator color="#ffffff" /> : <Text className="text-lg">Create all</Text>}
        </Button>
        </>}
      </View>
      <ObservationEditor
        observation={open}
        proposal={p}
        walk={walk}
        others={others}
        order={order}
        onStep={setOpenRef}
        onNote={(note) => r.change((cur) => updateObservation(cur, open!.ref, { note }))}
        onSeverity={(severity) => r.change((cur) => updateObservation(cur, open!.ref, { severity }))}
        onCategory={(copeDimension) => r.change((cur) => updateObservation(cur, open!.ref, { copeDimension }))}
        onPlace={(place) =>
          r.change((cur) => {
            if ('ref' in place) return updateObservation(cur, open!.ref, { locationRef: place.ref })
            const linked = linkLocation(cur, place.existing)
            return updateObservation(linked.proposal, open!.ref, { locationRef: linked.ref })
          })
        }
        onDelete={() => deleteObservation(open!.ref)}
        onClose={() => setOpenRef(null)}
      />
      {sheet?.kind === 'add' && (
        <AddObservationSheet
          proposal={p}
          others={others}
          startAt={selected}
          onSave={async (input) => {
            await r.addByHand(input)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'places' && (
        <PlaceSheet
          proposal={p}
          selected={selected}
          onPick={(ref) => { setPicked(ref); setSheet(null) }}
          onAdd={() => setSheet({ kind: 'location', ref: null })}
          onRename={(ref) => setSheet({ kind: 'location', ref })}
          onSameAs={(ref) => setSheet({ kind: 'same', ref })}
          onDelete={confirmDelete}
          onPhotos={() => { setScreen('photos'); setSheet(null) }}
          onPages={() => { setScreen('pages'); setSheet(null) }}
          onDeleted={() => { setScreen('deleted'); setSheet(null) }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'location' && (
        <LocationSheet
          title={sheet.ref ? 'Rename location' : 'Add location'}
          known={[...r.existing, ...p.locations.map((l) => ({ ...l, id: l.ref }))]}
          initial={form ? inputOf(form) : undefined}
          onSave={savePlace}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'same' && (
        <SamePlaceSheet name={p.locations.find((l) => l.ref === sheet.ref)?.name ?? ''} existing={r.existing} onPick={(l) => matchPlace(sheet.ref, l)} onClose={() => setSheet(null)} />
      )}
    </ScrollView>
  )
}
