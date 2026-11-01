// One captured observation in the workspace (MB-02 AC4): what it says or
// holds, its COPE categories, severity and capture time. Read-only for now.
// MB-07: the rows join into one rounded card (`first` and `last` round its
// ends), each led by its first photo, or an icon for what it holds (AC7).
// MB-10: one queued offline carries its upload status, and Discard if refused.
import { Camera, FileText, Mic, NotebookPen } from 'lucide-react-native'
import { useState } from 'react'
import { Image, View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { capturedAt, categoriesText, observationTitle, SEVERITY, type Observation } from '../format'

type Props = {
  observation: Observation
  first: boolean
  last: boolean
  // Queued offline (MB-10): "Waiting to upload", or why the gateway refused it.
  upload?: { refused?: string }
  onDiscard?(): void
}

export function ObservationCard({ observation, first, last, upload, onDiscard }: Props) {
  const severity = observation.severity && SEVERITY[observation.severity]
  return (
    <View
      testID="observation-card"
      className={cn(
        'mx-4 flex-row items-center gap-3 border-x border-b border-border bg-card p-3',
        first && 'rounded-t-lg border-t',
        last && 'rounded-b-lg',
      )}
    >
      <Thumbnail observation={observation} />
      <View className="flex-1 gap-1.5">
        <Text className="text-base font-medium" numberOfLines={2}>
          {observationTitle(observation)}
        </Text>
        <View className="flex-row items-center gap-2">
          {severity && (
            <Badge variant={severity.tone}>
              <Text>{severity.label}</Text>
            </Badge>
          )}
          <Text className="flex-1 text-sm text-muted-foreground" numberOfLines={1}>
            {categoriesText(observation)}
          </Text>
          <Text className="font-mono text-sm text-muted-foreground">{capturedAt(observation.recordedAt)}</Text>
        </View>
        {upload &&
          (upload.refused ? (
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm text-destructive">{`Couldn't upload: ${upload.refused}`}</Text>
              <Button variant="outline" accessibilityLabel="Discard" onPress={onDiscard}>
                <Text>Discard</Text>
              </Button>
            </View>
          ) : (
            <Text className="text-sm font-medium text-muted-foreground">Waiting to upload</Text>
          ))}
      </View>
    </View>
  )
}

// The first photo, loaded from the gateway with the session cookie, or from
// the phone while queued (MB-10). If it can't load (offline, or the cookie
// isn't sent), the camera icon stands in.
function Thumbnail({ observation }: { observation: Observation }) {
  const [failed, setFailed] = useState(false)
  const photo = observation.photos[0]
  if (photo && !failed) {
    return (
      <Image
        testID="observation-photo"
        accessibilityLabel="Photo"
        source={{ uri: photo.url?.startsWith('file:') ? photo.url : `${process.env.EXPO_PUBLIC_API_URL}${photo.url}` }}
        onError={() => setFailed(true)}
        className="h-14 w-14 rounded-sm bg-muted"
      />
    )
  }
  const [Icon, label] = photo
    ? [Camera, 'Photo']
    : observation.recordings.length
      ? [Mic, 'Voice note']
      : observation.pages.length
        ? [FileText, 'Handwritten page']
        : [NotebookPen, 'Note']
  return (
    <View accessible accessibilityLabel={label} className="h-14 w-14 items-center justify-center rounded-sm bg-secondary">
      <Icon color="#2c5488" size={22} />
    </View>
  )
}
