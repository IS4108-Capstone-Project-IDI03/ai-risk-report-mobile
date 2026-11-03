// How many observations and locations are queued on the phone (MB-10 AC7), so
// the engineer knows not to delete the app or sign out yet. On Home. Nothing
// when the queue is empty.
import { CloudUpload } from 'lucide-react-native'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { useOffline } from '../provider'

export function UploadStatus() {
  const { items } = useOffline()
  const refused = items.filter((i) => i.error).length
  const waiting = items.length - refused
  if (!items.length) return null
  return (
    <View className="flex-row items-center gap-2 rounded-md bg-secondary p-3">
      <CloudUpload color="#2c5488" size={18} />
      <View className="flex-1">
        {waiting > 0 && <Text className="text-sm font-medium text-secondary-foreground">{`${waiting} waiting to upload`}</Text>}
        {/* Each refused one says why, with Discard, in its workspace. */}
        {refused > 0 && <Text className="text-sm font-medium text-destructive">{`${refused} couldn't upload`}</Text>}
      </View>
    </View>
  )
}
