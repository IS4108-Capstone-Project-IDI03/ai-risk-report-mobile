// One handwritten page in an observation's detail (MB-11 AC3): its photo, and
// the gateway's reading of the handwriting, or where that stands. MB-17: Read again on a page that was read, and a note when the engineer corrected it (Edit text is in the edit screen).
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { Page } from '../format'
import { MediaImage } from './MediaImage'
import { ReadAgain, TryAgain, type Retry } from './TryAgain'

// Nothing for a page waiting to upload: it hasn't been read yet (MB-10).
export function reading(t: Page['transcription']) {
  if (!t) return null
  if (t.status === 'transcribing') return 'Reading the handwriting'
  if (t.status === 'failed') return `Couldn't read: ${t.error ?? 'No reason given.'}`
  // The engineer's correction replaces the reading (MB-17 AC12); the gateway keeps the reading.
  return t.correction?.text || t.transcript || 'No handwriting found.'
}

export function PageEntry({ page, number, retry, again }: { page: Page; number: number; retry?: Retry; again?: Retry }) {
  const text = reading(page.transcription)
  return (
    <View className="gap-2">
      <MediaImage url={page.url} testID="detail-page" label={`Handwritten page ${number}`} />
      {text && <Text className="text-base">{text}</Text>}
      {retry && page.transcription?.status === 'failed' && <TryAgain label={`handwritten page ${number}`} retry={retry} />}
      {page.transcription?.correction && <Text className="text-sm text-muted-foreground">Corrected by you</Text>}
      {again && page.transcription?.status === 'transcribed' && <ReadAgain label={`handwritten page ${number}`} retry={again} />}
    </View>
  )
}
