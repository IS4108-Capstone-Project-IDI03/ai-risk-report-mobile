// The workspace's LOCATION block (MB-02 AC2, AC8): where the engineer says
// they are, tappable to change, or a prompt to choose one before capturing.
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
      <View className="gap-3 rounded-lg border border-primary bg-secondary p-4">
        <View className="gap-1">
          <Text className="text-lg font-semibold text-secondary-foreground">Choose where you are</Text>
          <Text className="text-secondary-foreground">
            Observations are filed by location. Choose one before capturing.
          </Text>
        </View>
        <Button size="lg" accessibilityLabel="Choose location" onPress={onChange}>
          <MapPin color="#ffffff" size={20} />
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
      className="min-h-16 flex-row items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 active:bg-muted"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
        <MapPin color="#2c5488" size={20} />
      </View>
      <Text className="flex-1 text-base font-semibold">{locationLabel(location)}</Text>
      <Text className="text-sm font-medium text-primary">Change</Text>
      <ChevronRight color="#2c5488" size={20} />
    </Pressable>
  )
}
