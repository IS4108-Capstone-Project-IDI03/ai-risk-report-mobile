// Asking by voice (MB-25, web CB-10): record a question with capture's recorder, turn it into text on the
// gateway, and hand the text to the box to check and edit. Nothing is sent as a question by itself.
// Called by components/Composer. Calls capture/useVoiceNote and api.ts.
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useVoiceNote, type RecordingProblem } from '@/features/capture/useVoiceNote'
import { errorText } from '@/lib/api'
import { transcribe } from './api'

const MIN_MILLIS = 1000

export function useVoiceQuestion(onText: (text: string) => void) {
  const [transcribing, setTranscribing] = useState(false)
  const [problem, setProblem] = useState<RecordingProblem | null>(null)
  // Set when the screen goes away mid-recording: that clip is dropped, nothing is sent.
  const dropped = useRef(false)
  const note = useVoiceNote(async ({ uri, durationMillis }) => {
    if (dropped.current) return
    // An accidental tap records a fraction of a second; sending it would spend a paid call on nothing.
    if (durationMillis < MIN_MILLIS) return setProblem({ message: 'That was too short. Hold on a little longer, then tap Stop.', settings: false })
    setTranscribing(true)
    try {
      onText(await transcribe(uri))
    } catch (e) {
      setProblem({ message: errorText(e), settings: false })
    } finally {
      setTranscribing(false)
    }
  })
  // Leaving the chat (another tab, or the screen closing) stops a recording and drops the clip. Tabs stay
  // mounted, so an unmount cleanup alone would keep the microphone on in the background (AC5).
  // `latest` lets the cleanup call today's stop, not the one from the render it was made in.
  const latest = useRef(note)
  useEffect(() => {
    latest.current = note
  })
  useFocusEffect(
    useCallback(
      () => () => {
        dropped.current = true
        if (latest.current.recording) void latest.current.stop()
      },
      [],
    ),
  )

  async function start() {
    // Only a new recording clears the drop: coming back to the screen must not revive an old clip.
    dropped.current = false
    setProblem(null)
    setProblem(await note.start())
  }

  return { recording: note.recording, durationMillis: note.durationMillis, transcribing, problem, start, stop: note.stop }
}
