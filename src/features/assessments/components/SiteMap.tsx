// The map on the Site pins screen (MB-02 AC25-AC28): a marker for each pinned row, labelled as the
// rows are (S, 1, 2…), zoomed to show them all; tap one to pick its row; press and hold, drag and
// let go to move it. Apple Maps on iOS (react-native-maps, no key); Android would need a Google
// Maps key in store builds. Used by screens/SitePins, which saves a move.
import * as Location from 'expo-location'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import type { PinRow } from '../siteMap'

type Props = {
  // Only the pinned rows, with the label each carries (the same as its row's badge).
  pins: { row: PinRow & { point: NonNullable<PinRow['point']> }; label: string }[]
  selected: string | null
  // False while a save runs or with no signal: a drag would be refused.
  canMove: boolean
  // Exposed so the screen can move the map to a row the engineer tapped.
  focus: string | null
  // Fill the space it is given (the wide layout); else a fixed 280pt strip.
  fill?: boolean
  // Where the pin being edited would go, once a spot is chosen: shown, not saved, until Set.
  draft: { point: { lat: number; lng: number }; label: string } | null
  onSelect(key: string): void
  // The map was tapped at this spot (the screen uses it only while a pin is being edited).
  onPlace(point: { lat: number; lng: number }): void
  onMove(key: string, point: { lat: number; lng: number }): void
}

// Six places, as the form and the web round them.
const six = (n: number) => Number(n.toFixed(6))
const EDGE = { top: 60, right: 60, bottom: 60, left: 60 }
// About 500 m across: a single pin, or one the engineer tapped.
const CLOSE = 0.005
// With nothing pinned: Singapore, until the phone's last position is known.
const SINGAPORE = { latitude: 1.3521, longitude: 103.8198, latitudeDelta: 0.3, longitudeDelta: 0.3 }

// One marker. Its picture is drawn once and the map keeps that snapshot, so it is redrawn only
// for a moment after it appears: left on `tracksViewChanges={false}` from the start, a marker
// made from a view can come out blank. Keyed by whether it is picked, so a change of colour
// makes a fresh one that is drawn again.
type MarkerProps = { label: string; selected: boolean } & React.ComponentProps<typeof Marker>
function PinMarker(props: MarkerProps) {
  return <DrawnMarker key={String(props.selected)} {...props} />
}
function DrawnMarker({ label, selected, ...marker }: MarkerProps) {
  const [tracking, setTracking] = useState(true)
  useEffect(() => {
    const stop = setTimeout(() => setTracking(false), 300)
    return () => clearTimeout(stop)
  }, [])
  return (
    <Marker {...marker} tracksViewChanges={tracking}>
      <View className={cn('h-9 w-9 items-center justify-center rounded-full border-2 border-white', selected ? 'bg-ink-600' : 'bg-navy')}>
        <Text className="text-sm font-bold text-white">{label}</Text>
      </View>
    </Marker>
  )
}

export function SiteMap({ pins, selected, canMove, focus, fill, draft, onSelect, onPlace, onMove }: Props) {
  const map = useRef<MapView>(null)
  const noPins = useRef(pins.length === 0)
  // The blue dot only when access was already given: the map never asks by itself.
  const [here, setHere] = useState(false)
  useEffect(() => {
    let live = true
    Location.getForegroundPermissionsAsync()
      .then(async (p) => {
        if (!live || !p.granted) return
        setHere(true)
        // Nothing pinned: start where the phone last was, rather than Singapore.
        const last = noPins.current ? await Location.getLastKnownPositionAsync() : null
        if (live && last) map.current?.animateToRegion({ latitude: last.coords.latitude, longitude: last.coords.longitude, latitudeDelta: CLOSE * 4, longitudeDelta: CLOSE * 4 })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  // Zoom to all the pins when the map opens or one is added or removed, not when one is moved.
  const count = pins.length
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!ready || !count) return
    if (count === 1) {
      const { lat, lng } = pins[0].row.point
      map.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: CLOSE, longitudeDelta: CLOSE })
    } else {
      map.current?.fitToCoordinates(
        pins.map((p) => ({ latitude: p.row.point.lat, longitude: p.row.point.lng })),
        { edgePadding: EDGE, animated: true },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- by count and readiness only, not each move
  }, [ready, count])

  // A row's name was tapped: move to its pin.
  useEffect(() => {
    const target = pins.find((p) => p.row.key === focus)
    if (target) {
      map.current?.animateToRegion({ latitude: target.row.point.lat, longitude: target.row.point.lng, latitudeDelta: CLOSE, longitudeDelta: CLOSE })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the tap is the trigger
  }, [focus])

  return (
    <MapView
      ref={map}
      testID="site-map"
      style={fill ? { flex: 1 } : { height: 280, width: '100%' }}
      showsUserLocation={here}
      onMapReady={() => setReady(true)}
      // The first pin, until the map is ready to fit them all.
      initialRegion={
        pins[0]
          ? { latitude: pins[0].row.point.lat, longitude: pins[0].row.point.lng, latitudeDelta: CLOSE * 4, longitudeDelta: CLOSE * 4 }
          : SINGAPORE
      }
      onPress={(e) => onPlace({ lat: six(e.nativeEvent.coordinate.latitude), lng: six(e.nativeEvent.coordinate.longitude) })}
    >
      {pins.map(({ row, label }) => (
        <PinMarker
          key={row.key}
          label={label}
          selected={row.key === selected}
          testID={`map-pin-${row.key}`}
          coordinate={{ latitude: row.point.lat, longitude: row.point.lng }}
          draggable={canMove}
          onPress={() => onSelect(row.key)}
          onDragEnd={(e) => onMove(row.key, { lat: six(e.nativeEvent.coordinate.latitude), lng: six(e.nativeEvent.coordinate.longitude) })}
        />
      ))}
      {draft && (
        // Ringed in the lighter blue, so it reads as not yet saved.
        <PinMarker
          label={draft.label}
          selected
          testID="map-pin-draft"
          coordinate={{ latitude: draft.point.lat, longitude: draft.point.lng }}
        />
      )}
    </MapView>
  )
}
