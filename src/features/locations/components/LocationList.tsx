// The picker's list of locations (MB-02 AC7-AC9): building groups, level
// subheadings, one 56px row per location with a check on the chosen one.
// Used by screens/LocationPicker.
import { Check } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { groupLocations, type Location } from '../locations'

type Props = {
  locations: Location[]
  chosenId: string | undefined
  onChoose(location: Location): void
}

export function LocationList({ locations, chosenId, onChoose }: Props) {
  if (!locations.length) {
    return (
      <Text className="px-4 py-8 text-center text-muted-foreground">
        No locations listed for this assessment yet.
      </Text>
    )
  }
  return (
    <View className="gap-6">
      {groupLocations(locations).map((group) => (
        <View key={group.key} className="gap-2">
          <Text className="px-1 text-lg font-semibold">{group.title}</Text>
          {group.levels.map((level) => (
            <View key={level.title ?? 'none'} className="gap-1">
              {level.title && (
                <Text className="px-1 text-sm font-medium text-muted-foreground">{level.title}</Text>
              )}
              <View className="overflow-hidden rounded-lg border border-border bg-card">
                {level.locations.map((l, i) => {
                  const chosen = l.id === chosenId
                  return (
                    <Pressable
                      key={l.id}
                      accessibilityRole="button"
                      accessibilityLabel={l.name}
                      accessibilityState={{ selected: chosen }}
                      onPress={() => onChoose(l)}
                      className={cn(
                        'min-h-14 flex-row items-center justify-between px-4 active:bg-muted',
                        i > 0 && 'border-t border-border',
                        chosen && 'bg-secondary',
                      )}
                    >
                      <Text
                        testID="location-name"
                        className={cn('flex-1 text-base', chosen && 'font-semibold text-secondary-foreground')}
                      >
                        {l.name}
                      </Text>
                      {chosen && <Check color="#2c5488" size={22} />}
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
