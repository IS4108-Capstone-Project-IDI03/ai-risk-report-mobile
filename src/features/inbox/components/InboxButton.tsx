// The Inbox button at the top right of Home's header (MB-22): a tray icon alone, with the To do count in a
// red badge on it when there is one (read out as "Inbox, 3 to do"). Opens the Inbox screen. Called by
// src/app/(tabs)/_layout.tsx. Calls useInboxCount.
import { router } from 'expo-router'
import { Inbox } from 'lucide-react-native'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { useInboxCount } from '../useInboxCount'

export function InboxButton() {
  const count = useInboxCount()
  return (
    // 48pt square, so the icon alone is still an easy target.
    <Button variant="header" className="mr-1 h-12 w-12 px-0" accessibilityLabel={count > 0 ? `Inbox, ${count} to do` : 'Inbox'} onPress={() => router.push('/inbox')}>
      <Inbox color="#ffffff" size={24} />
      {count > 0 && (
        <View className="absolute right-0.5 top-1 h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1">
          <Text className="text-xs font-bold text-white">{count}</Text>
        </View>
      )}
    </Button>
  )
}
