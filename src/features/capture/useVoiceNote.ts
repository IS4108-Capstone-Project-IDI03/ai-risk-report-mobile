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
  // True while starting or stopping, so a second tap is ignored.
  const busy = useRef(false)

  // Returns why it couldn't start, or null once recording.
  async function start(): Promise<RecordingProblem | null> {
    if (busy.current || recording) return null
    busy.current = true
    try {
      if (!(await requestRecordingPermissionsAsync()).granted)
        return { message: DENIED.microphone, settings: true }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
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
    if (busy.current || !recording) return
    busy.current = true
    try {
      const durationMillis = state.durationMillis
      await recorder.stop()
      setRecording(false)
      if (recorder.uri) onRecorded({ uri: recorder.uri, durationMillis })
    } finally {
      busy.current = false
    }
  }

  // Stops at the limit, keeping what was recorded.
  useEffect(() => {
    if (recording && state.durationMillis >= MAX_MILLIS) stop()
  })

  return { recording, durationMillis: state.durationMillis, start, stop }
}
