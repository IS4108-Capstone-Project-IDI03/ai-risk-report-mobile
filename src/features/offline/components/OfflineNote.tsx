// Says the screen shows its last copy because the gateway can't be reached
// (MB-10 AC1). Used by Home, the workspace and the location picker. Nothing
// when online.
import { WifiOff } from 'lucide-react-native'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { useOffline } from '../provider'

export function OfflineNote() {
  if (!useOffline().offline) return null
  return (
    <View className="flex-row items-center gap-2 rounded-md bg-muted p-3">
      <WifiOff color="#545e6b" size={18} />
      <Text className="flex-1 text-sm">{"You're offline. Showing what was saved on this device."}</Text>
    </View>
  )
}
