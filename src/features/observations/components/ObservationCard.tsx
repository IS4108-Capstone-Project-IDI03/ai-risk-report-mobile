// One captured observation in the workspace (MB-02 AC4): what it says or
// holds, its COPE categories, severity and capture time. Read-only for now.
import { View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { capturedAt, categoriesText, observationTitle, SEVERITY, type Observation } from '../format'

export function ObservationCard({ observation }: { observation: Observation }) {
  const severity = observation.severity && SEVERITY[observation.severity]
  return (
    <Card testID="observation-card" className="gap-2 px-4 py-3">
      <Text className="text-base font-medium" numberOfLines={2}>
        {observationTitle(observation)}
      </Text>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-sm text-muted-foreground" numberOfLines={1}>
          {categoriesText(observation)}
        </Text>
        {severity && (
          <Badge variant={severity.tone}>
            <Text>{severity.label}</Text>
          </Badge>
        )}
        <Text className="font-mono text-sm text-muted-foreground">{capturedAt(observation.recordedAt)}</Text>
      </View>
    </Card>
  )
}
