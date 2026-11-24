// The Site pins screen (MB-02 AC19-AC24, AC40): the site, its blocks and the places elsewhere on site with their pins, Directions to
// each (opens the maps app), and Pin here / Move here by the phone's GPS, so an engineer standing
// at a block can set where it is. No map in the app. Opened by Site pins in the workspace's
// band. Calls listAssessments and listLocations (cached), changePin (PUT /api/sites/:id/map, or PATCH the location).
import { useLocalSearchParams } from 'expo-router'
import { ChevronDown, ChevronUp, Navigation, Pencil } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { useSplitView } from '@/lib/device'
import { easeLayout } from '@/lib/motion'
import { cn, readable } from '@/lib/utils'
import { listLocations } from '@/features/locations/api'
import type { Location } from '@/features/locations/locations'
import { DENIED, pinHere } from '@/features/locations/position'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { useOffline } from '@/features/offline/provider'
import { listAssessments } from '../api'
import type { Assessment } from '../format'
import { SiteMap } from '../components/SiteMap'
import { changePin, directionsUrl, parseCoordinates, pinRows, type PinRow } from '../siteMap'

export default function SitePins() {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  const { offline } = useOffline()
  // On a wide iPad the map fills the left and the rows sit in a column on the right (AC34).
  const wide = useSplitView()
  const [site, setSite] = useState<Assessment['site'] | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  // The row being saved, so only one change runs at a time (the gateway takes one each).
  const [saving, setSaving] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  // The row picked on the map or in the list, and the one the map should move to (a row's name tapped).
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  // The map can be folded away, to see more of the rows (AC30).
  const [mapShown, setMapShown] = useState(true)
  // The row whose pin is being edited, and the coordinates typed for it (AC22, AC31, AC32).
  const [editing, setEditing] = useState<PinRow | null>(null)
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState<string | null>(null)

  // Reads the visit's site (with its pins) and its locations (their buildings make the blocks; those
  // elsewhere on site are rows of their own).
  const read = useCallback(async () => {
    const [all, locations] = await Promise.all([listAssessments(), listLocations(reference)])
    const found = all.find((a) => a.reference === reference)
    if (!found) throw new Error("This assessment isn't available.")
    return { site: found.site, locations }
  }, [reference])
  const show = (d: Awaited<ReturnType<typeof read>>) => {
    setSite(d.site)
    setLocations(d.locations)
    setLoadError(null)
  }
  // Goes up to read again (Try again).
  const [tries, setTries] = useState(0)
  useEffect(() => {
    let live = true
    read().then(
      (d) => live && show(d),
      (e) => live && setLoadError(errorText(e)),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `show` only sets state
  }, [read, tries])

  // a. Read the phone's position (asks first, says when off). b. Save that one change.
  // c. Read the site again, so the row shows what the gateway now holds.
  async function setPin(row: PinRow, point: PinRow['point'] | 'here'): Promise<boolean> {
    if (saving || !site?.id) return false
    setSaving(row.key)
    setProblem(null)
    try {
      let target = point === 'here' ? null : point
      if (point === 'here') {
        const here = await pinHere()
        if (!('pinned' in here)) {
          setProblem('denied' in here ? DENIED : here.failed)
          return false
        }
        target = { lat: here.pinned.lat, lng: here.pinned.lng }
      }
      await changePin(site.id, reference, row, target)
      show(await read())
      return true
    } catch (e) {
      setProblem(errorText(e))
      return false
    } finally {
      setSaving(null)
    }
  }

  // Tapping the map and Use my position only fill the Coordinates field (and show the draft marker);
  // Set is what saves. On a refusal the panel stays, with the reason shown, so another way can be tried.
  const fill = (point: { lat: number; lng: number }) => {
    setTyped(`${point.lat}, ${point.lng}`)
    setTypedError(null)
  }
  const [locating, setLocating] = useState(false)
  async function useMyPosition() {
    if (locating) return
    setLocating(true)
    setProblem(null)
    const here = await pinHere()
    if ('pinned' in here) fill(here.pinned)
    else setProblem('denied' in here ? DENIED : here.failed)
    setLocating(false)
  }

  async function setTypedPin() {
    if (!editing) return
    const point = parseCoordinates(typed)
    if (!point) return setTypedError('Type latitude and longitude, like 1.2966, 103.8520.')
    setTypedError(null)
    if (await setPin(editing, point)) {
      setEditing(null)
      setTyped('')
    }
  }

  function confirmRemove(row: PinRow) {
    Alert.alert('Remove this pin?', `${row.name} is no longer pinned on the site. Directions to it go too.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (await setPin(row, null)) setEditing(null)
        },
      },
    ])
  }

  if (loadError && !site)
    return (
      <View testID="site-pins" className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-center text-muted-foreground">{loadError}</Text>
        <Button variant="outline" accessibilityLabel="Try again" onPress={() => setTries((n) => n + 1)}>
          <Text>Try again</Text>
        </Button>
      </View>
    )
  if (!site)
    return (
      <View testID="site-pins" className="flex-1 items-center justify-center">
        <ActivityIndicator color="#000f47" />
      </View>
    )

  const rows = pinRows(site, locations)
  // Each row's label is the web's: S for the site, 1, 2… for its blocks, then the places elsewhere on site.
  const labelled = rows.map((row, i) => ({ row, label: row.key === 'site' ? 'S' : String(i) }))
  const pinned = labelled.filter((r): r is typeof r & { row: { point: NonNullable<PinRow['point']> } } => !!r.row.point)

  // The bar that folds the map away on a phone; the wide layout always shows the map.
  const mapHeader = (
    <View className="flex-row items-center justify-between border-b border-border bg-card px-4">
      <Text className="font-medium">Map</Text>
      <Button
        variant="ghost"
        accessibilityLabel={mapShown ? 'Hide map' : 'Show map'}
        onPress={() => {
          easeLayout()
          setMapShown((on) => !on)
        }}
      >
        {mapShown ? <ChevronUp color="#1a1f26" size={18} /> : <ChevronDown color="#1a1f26" size={18} />}
        <Text>{mapShown ? 'Hide map' : 'Show map'}</Text>
      </Button>
    </View>
  )

  const editPanel = editing && (
        <View testID="edit-pin" className="gap-3 border-b border-border bg-accent p-4">
          <Text className="font-semibold">{`Place ${editing.name}`}</Text>
          <Text className="text-sm text-muted-foreground">Tap the map, use your position or type coordinates, then tap Set.</Text>
          {/* One full-width button, then the field with Set, then Cancel and Remove at the two ends:
              each line fits the 420pt column on an iPad and a phone alike. */}
          <Button variant="outline" accessibilityLabel="Use my position" disabled={offline || !!saving || locating} onPress={useMyPosition}>
            {locating ? <ActivityIndicator color="#000f47" /> : <Navigation color="#2c5488" size={16} />}
            <Text>{locating ? 'Finding…' : 'Use my position'}</Text>
          </Button>
          <View className="flex-row gap-2">
            <Input
              accessibilityLabel="Coordinates"
              placeholder="e.g. 1.2966, 103.8520"
              value={typed}
              onChangeText={setTyped}
              autoCorrect={false}
              autoCapitalize="none"
              className="flex-1"
            />
            <Button accessibilityLabel="Set typed coordinates" disabled={offline || !!saving} onPress={setTypedPin}>
              <Text>{saving ? 'Saving…' : 'Set'}</Text>
            </Button>
          </View>
          {typedError && <Text className="text-sm text-destructive">{typedError}</Text>}
          <View className="flex-row items-center justify-between">
            <Button variant="ghost" accessibilityLabel="Cancel editing" onPress={() => setEditing(null)}>
              <Text>Cancel</Text>
            </Button>
            {editing.point && (
              <Button variant="ghost" accessibilityLabel="Remove pin" disabled={offline || !!saving} onPress={() => confirmRemove(editing)}>
                <Text className="text-destructive">Remove pin</Text>
              </Button>
            )}
          </View>
        </View>
      )

  const mapView = (
        <SiteMap
          pins={pinned}
          selected={selected}
          fill={wide}
          focus={focus}
          canMove={!offline && !saving}
          onSelect={setSelected}
          // The pin being edited, once a valid spot is typed, tapped or taken from the GPS.
          draft={editing && parseCoordinates(typed) ? { point: parseCoordinates(typed)!, label: labelled.find((l) => l.row.key === editing.key)?.label ?? '' } : null}
          // Tapping the map fills the field; with no pin being edited it does nothing.
          onPlace={(point) => editing && fill(point)}
          onMove={(key, point) => {
            setSelected(key)
            const row = rows.find((r) => r.key === key)
            if (row) setPin(row, point)
          }}
        />
      )

  const rowsList = (
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <View className={cn('gap-4', !wide && readable)}>
          <OfflineNote />
          <Text className="text-muted-foreground">Where the site, its blocks and places elsewhere on site are. Pins are shared by every visit to this site.</Text>
          {labelled.map(({ row, label }) => {
            const busy = saving === row.key
            return (
              <View
                key={row.key}
                testID={`pin-row-${row.name}`}
                accessibilityState={{ selected: row.key === selected }}
                className={cn('gap-3 rounded-lg border bg-card p-4', row.key === selected ? 'border-primary' : 'border-border')}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${row.name} on the map`}
                  disabled={!row.point}
                  onPress={() => {
                    setSelected(row.key)
                    setFocus(null)
                    // A fresh trigger each tap, so tapping the same row again moves the map back to it.
                    setTimeout(() => setFocus(row.key), 0)
                  }}
                  className="flex-row items-center gap-3"
                >
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-navy">
                    <Text className="text-sm font-bold text-white">{label}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold">{row.name}</Text>
                    {row.place && <Text className="text-sm text-muted-foreground">Elsewhere on site</Text>}
                    <Text className="tabular-nums text-muted-foreground">{row.point ? `${row.point.lat}, ${row.point.lng}` : 'Not pinned'}</Text>
                  </View>
                </Pressable>
                {/* Two equal buttons side by side; Remove lives in the edit panel. */}
                <View className="flex-row gap-2">
                  {row.point && (
                    <Button variant="outline" className="flex-1" accessibilityLabel={`Directions to ${row.name}`} onPress={() => Linking.openURL(directionsUrl(row.point!))}>
                      <Navigation color="#2c5488" size={16} />
                      <Text>Directions</Text>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="flex-1"
                    accessibilityLabel={`${row.point ? 'Edit' : 'Set'} ${row.name} pin`}
                    disabled={offline || !!saving}
                    onPress={() => {
                      setMapShown(true)
                      setTypedError(null)
                      setEditing(row)
                    }}
                  >
                    {busy ? <ActivityIndicator color="#000f47" /> : <Pencil color="#2c5488" size={16} />}
                    <Text>{busy ? 'Saving…' : row.point ? 'Edit pin' : 'Set pin'}</Text>
                  </Button>
                </View>
              </View>
            )
          })}
          {offline && <Text className="text-sm text-muted-foreground">Connect to change pins.</Text>}
          {problem && (
            <View className="rounded-md bg-destructive/10 p-3">
              <Text className="text-destructive">{problem}</Text>
            </View>
          )}
        </View>
      </ScrollView>
  )

  if (wide)
    return (
      <View testID="site-pins" className="flex-1">
        <View testID="pins-columns" className="flex-1 flex-row">
          <View className="flex-1">{mapView}</View>
          <View testID="pins-side" className="w-[420px] border-l border-border bg-background">
            {editPanel}
            {rowsList}
          </View>
        </View>
      </View>
    )
  return (
    <View testID="site-pins" className="flex-1">
      {mapHeader}
      {editPanel}
      {mapShown && mapView}
      {rowsList}
    </View>
  )
}
