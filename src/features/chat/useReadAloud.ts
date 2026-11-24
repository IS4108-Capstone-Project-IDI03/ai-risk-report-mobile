// Reading an answer aloud with the phone's own voice (MB-25, web CB-10), through expo-speech: free, works
// offline, nothing leaves the phone. One answer reads at a time, so the state lives here, outside any
// component: playing a second answer, asking a new question or leaving the chat stops the first.
// Called by components/PlayButton, screens/Chat.
import * as Speech from 'expo-speech'
import { useEffect, useState, useSyncExternalStore } from 'react'

type State = { id: string | null; paused: boolean }
let state: State = { id: null, paused: false }
// Counts the readings started. A callback from an older one is ignored (its "stopped" can arrive after the next began).
let turn = 0
const listeners = new Set<() => void>()
const set = (next: State) => {
  state = next
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** Stops whatever is being read, if anything. */
export function stopReading() {
  if (state.id === null) return
  void Speech.stop()
  set({ id: null, paused: false })
}

// Whether the phone has a voice to read with. None: no Play button (CB-10 AC7).
export function useHasVoice() {
  const [has, setHas] = useState(false)
  useEffect(() => {
    let live = true
    Speech.getAvailableVoicesAsync().then((v) => live && setHas(v.length > 0), () => {})
    return () => {
      live = false
    }
  }, [])
  return has
}

// One answer's reading: is it the one being read, is it paused, and the four actions.
export function useReadAloud(id: string, text: string) {
  const now = useSyncExternalStore(subscribe, () => state)
  const mine = now.id === id
  return {
    reading: mine,
    paused: mine && now.paused,
    play() {
      void Speech.stop()
      const mine = ++turn
      const end = () => {
        if (turn === mine && state.id === id) set({ id: null, paused: false })
      }
      set({ id, paused: false })
      // Android caps the length of one reading (iOS does not).
      Speech.speak(text.slice(0, Speech.maxSpeechInputLength), { onDone: end, onStopped: end, onError: end })
    },
    pause() {
      void Speech.pause()
      set({ id, paused: true })
    },
    resume() {
      void Speech.resume()
      set({ id, paused: false })
    },
    stop: stopReading,
  }
}
