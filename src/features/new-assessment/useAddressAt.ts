// Fills a new site's Address from its Coordinates (one way only: an address never sets a pin).
// Called by screens/NewAssessment. Calls api.ts `addressAt` (GET /api/sites/address on the gateway).
import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { addressAt, type NewSite } from './api'
import { parseCoordinates } from './format'

// Wait this long after the last keystroke, so typing "1.2966, 103.852" asks once, not once per digit
// (Google bills each lookup).
const PAUSE_MS = 500

export function useAddressAt(coords: string, enabled: boolean, setSite: Dispatch<SetStateAction<NewSite>>) {
  useEffect(() => {
    const point = parseCoordinates(coords)
    if (!enabled || !point) return
    let current = true
    const timer = setTimeout(() => {
      addressAt(point).then(
        ({ address }) => {
          // A newer point, or a closed form, makes this answer stale. No address found keeps what was typed.
          if (current && address) setSite((site) => ({ ...site, address }))
        },
        // Advisory: a failed lookup just leaves the Address for the engineer to type.
        () => {},
      )
    }, PAUSE_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [coords, enabled, setSite])
}
