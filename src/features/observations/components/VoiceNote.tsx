// One voice note in an observation's detail (MB-11 AC4): Play and Pause, and
// the transcript or where it stands. The gateway serves the audio behind the
// session cookie, which the phone's audio player may not send, so Play fetches
// it (fetch does send the cookie), saves it to the cache, and plays that file.
// A note waiting to upload (MB-10) is already a file on the phone.
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { File, Paths } from 'expo-file-system'
import { Pause, Play } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { useOffline } from '@/features/offline/provider'
import { download } from '@/lib/api'
import type { Recording } from '../format'
import { TryAgain, type Retry } from './TryAgain'

// The file to play: the phone's own, or the gateway's downloaded once.
async function localAudio({ id, url }: Recording) {
  if (!url.startsWith('/')) return url
  const file = new File(Paths.cache, `voice-${id}.m4a`)
  if (!file.exists) {
    const bytes = await download(url)
    try {
      file.create({ overwrite: true })
      file.write(bytes)
    } catch (e) {
      // A half-written file would read as downloaded and play as silence.
      if (file.exists) file.delete()
      throw e
    }
  }
  return file.uri
}

// The corrected transcript if the web has one, even when transcribing failed.
// Nothing for a note waiting to upload.
function transcript(t: Recording['transcription']) {
  if (!t) return null
  if (t.correction?.text) return t.correction.text
  if (t.status === 'transcribing') return 'Transcribing'
  if (t.status === 'failed') return `Couldn't transcribe: ${t.error ?? 'No reason given.'}`
  return t.transcript || 'No speech found.'
}

// `title` and `from` are for a site walk's recording (MB-16): its own name, and the second an
// observation starts at in a long part, so Play begins there.
export function VoiceNote({ note, number, retry, title, from = 0 }: { note: Recording; number: number; retry?: Retry; title?: string; from?: number }) {
  const player = useAudioPlayer()
  const { playing } = useAudioPlayerStatus(player)
  const { offline } = useOffline()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // The file is set on the player once; Pause and Play after that reuse it.
  const loaded = useRef(false)

  async function toggle() {
    if (playing) return player.pause()
    setProblem(null)
    setBusy(true)
    try {
      if (!loaded.current) {
        // Without this, the silent switch mutes it on site, where that's often on.
        await setAudioModeAsync({ playsInSilentMode: true })
        player.replace({ uri: await localAudio(note) })
        loaded.current = true
        // A seek before the file has loaded is ignored, so Play would start at 0:00.
        if (from) {
          for (let wait = 0; wait < 30 && !player.isLoaded; wait++) await new Promise((r) => setTimeout(r, 100))
          await player.seekTo(from)
        }
      }
      // After it ends the player stays at the end, so play would do nothing.
      if (player.duration && player.currentTime >= player.duration) await player.seekTo(from)
      player.play()
    } catch {
      setProblem(offline ? 'Not available offline' : "Couldn't load this voice note.")
    } finally {
      setBusy(false)
    }
  }

  const text = transcript(note.transcription)
  return (
    <View className="gap-2">
      <Button variant="outline" disabled={busy} accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${title ?? `voice note ${number}`}`} onPress={toggle}>
        {playing ? <Pause color="#2c5488" size={18} /> : <Play color="#2c5488" size={18} />}
        <Text>{playing ? 'Pause' : `Play ${title ?? `voice note ${number}`}`}</Text>
      </Button>
      {problem && <Text className="text-sm text-destructive">{problem}</Text>}
      {text && <Text className="text-base">{text}</Text>}
      {retry && note.transcription?.status === 'failed' && <TryAgain label={`voice note ${number}`} retry={retry} />}
    </View>
  )
}
