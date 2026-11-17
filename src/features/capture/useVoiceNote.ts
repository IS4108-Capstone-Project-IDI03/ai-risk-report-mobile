// Records voice notes for the capture sheet (MB-03 AC4), through expo-audio.
// Tap to start, tap to stop. Guards against double taps (each would record or
// save the same file twice, and each saved recording is transcribed at a cost)
// and stops on its own before a recording outgrows the gateway's 25 MB limit.
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import { useEffect, useRef, useState } from 'react'
import type { VoiceNote } from './draft'
import { DENIED } from './media'

// HIGH_QUALITY is about 128 kbps, so 20 minutes is about 19 MB: under the
// gateway's 25 MB per recording, with room to spare.
const MAX_MILLIS = 20 * 60 * 1000

export type RecordingProblem = { message: string; settings: boolean }

export function useVoiceNote(onRecorded: (note: VoiceNote) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const state = useAudioRecorderState(recorder)
  const [recording, setRecording] = useState(false)
  // Held by Pause (the site walk's recorder, MB-16 AC32); still recording as far as the part goes.
  const [paused, setPaused] = useState(false)
  // True while starting or stopping, so a second tap is ignored.
  const busy = useRef(false)
  // Whether a part is going now, read by the functions below even from a screen's older render: the
  // site walk stops a part for the camera and starts the next in one handler (MB-16 AC33), where
  // `recording` would still be the value from before.
  const active = useRef(false)
  const held = useRef(false)

  // Returns why it couldn't start, or null once recording.
  async function start(): Promise<RecordingProblem | null> {
    if (busy.current || active.current) return null
    busy.current = true
    try {
      if (!(await requestRecordingPermissionsAsync()).granted)
        return { message: DENIED.microphone, settings: true }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      active.current = true
      setRecording(true)
      return null
    } catch {
      // e.g. a call or another app holding the microphone.
      return { message: 'Recording could not start. Close other apps using the microphone, then try again.', settings: false }
    } finally {
      busy.current = false
    }
  }

  async function stop() {
    if (busy.current || !active.current) return
    busy.current = true
    try {
      const durationMillis = state.durationMillis
      await recorder.stop()
      active.current = false
      held.current = false
      setRecording(false)
      setPaused(false)
      if (recorder.uri) onRecorded({ uri: recorder.uri, durationMillis })
    } finally {
      busy.current = false
    }
  }

  // Pause holds the part and Resume goes on with it (record() again): one part, one file.
  function pause() {
    if (busy.current || !active.current || held.current) return
    recorder.pause()
    held.current = true
    setPaused(true)
  }
  function resume() {
    if (busy.current || !active.current || !held.current) return
    recorder.record()
    held.current = false
    setPaused(false)
  }

  // Stops at the limit, keeping what was recorded.
  useEffect(() => {
    if (recording && state.durationMillis >= MAX_MILLIS) stop()
  })

  return { recording, paused, durationMillis: state.durationMillis, start, stop, pause, resume }
}
