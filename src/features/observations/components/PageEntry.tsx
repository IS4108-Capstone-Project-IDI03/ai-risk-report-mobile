// One handwritten page in an observation's detail (MB-11 AC3): its photo, and
// the gateway's reading of the handwriting, or where that stands.
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import type { Page } from '../format'
import { MediaImage } from './MediaImage'

// Nothing for a page waiting to upload: it hasn't been read yet (MB-10).
function reading(t: Page['transcription']) {
  if (!t) return null
  if (t.status === 'transcribing') return 'Reading the handwriting'
  if (t.status === 'failed') return `Couldn't read: ${t.error ?? 'No reason given.'}`
  return t.transcript || 'No handwriting found.'
}

export function PageEntry({ page, number }: { page: Page; number: number }) {
  const text = reading(page.transcription)
  return (
    <View className="gap-2">
      <MediaImage url={page.url} testID="detail-page" label={`Handwritten page ${number}`} />
      {text && <Text className="text-base">{text}</Text>}
    </View>
  )
}
