// The phone's GPS for Add location (MB-02 AC13, AC15): reads the position once, when the
// engineer taps Pin where I am, through expo-location. Asks for access first and says when
// it's off or there's no fix, rather than failing silently. Called by components/AddLocationForm.
import * as Location from 'expo-location'

// What the gateway stores (location.service.ts `coordinates`).
export type Coordinates = { lat: number; lng: number }
export type Pinned = Coordinates & { accuracy: number | null }
export type PinResult = { pinned: Pinned } | { denied: string } | { failed: string }

export const DENIED = 'Location access is off. Turn it on in Settings, or save without a pin.'
export const NO_FIX = "Couldn't find your position. Try near a window, then try again."

// Six places is about 10 cm, finer than any phone's GPS, as the web rounds them.
const six = (n: number) => Number(n.toFixed(6))

export async function pinHere(): Promise<PinResult> {
  if (!(await Location.requestForegroundPermissionsAsync()).granted) return { denied: DENIED }
  try {
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    return { pinned: { lat: six(coords.latitude), lng: six(coords.longitude), accuracy: coords.accuracy } }
  } catch {
    // Indoors, GPS off, or a timeout: the pin is optional, so saving still works.
    return { failed: NO_FIX }
  }
}
