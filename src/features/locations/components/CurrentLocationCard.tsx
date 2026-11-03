// The workspace's location row (MB-02 AC2, AC8): where the engineer says they
// are, tappable to change, or a prompt to choose one before capturing. Sits in
// the workspace's bottom bar, right above New observation (MB-07 AC5, AC6).
// Used by the assessments Workspace screen; opens the location picker.
import { ChevronRight, MapPin } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { locationLabel, type Location } from '../locations'

type Props = { location: Location | undefined; onChange(): void }

export function CurrentLocationCard({ location, onChange }: Props) {
  if (!location) {
    return (
      <View className="min-h-14 flex-row items-center gap-3 py-1">
        <MapPin color="#2c5488" size={20} />
        <View className="flex-1">
          <Text className="font-semibold">Choose where you are</Text>
          <Text className="text-sm text-muted-foreground">Observations are filed by location.</Text>
        </View>
        <Button variant="secondary" accessibilityLabel="Choose location" onPress={onChange} className="px-4">
          <Text>Choose location</Text>
        </Button>
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Location, ${locationLabel(location)}. Change`}
      onPress={onChange}
      className="-mx-2 min-h-14 flex-row items-center gap-3 rounded-md px-2 active:bg-muted"
    >
      <MapPin color="#2c5488" size={20} />
      <View className="flex-1">
        <Text className="text-xs text-muted-foreground">You are at</Text>
        <Text className="text-base font-semibold">{locationLabel(location)}</Text>
      </View>
      <Text className="font-semibold text-primary">Change</Text>
      <ChevronRight color="#2c5488" size={20} />
    </Pressable>
  )
}
