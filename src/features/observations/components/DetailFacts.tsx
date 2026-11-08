// The facts at the top of an observation's detail (MB-11 AC2): severity, COPE
// categories, where, who and when. Called by ObservationDetail.
import { View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { capturedAt, categoriesText, SEVERITY, type Observation } from '../format'

// `place` is the location's name, looked up by the screen when the observation
// itself doesn't carry it.
export function DetailFacts({ observation, place }: { observation: Observation; place: string | null }) {
  const severity = observation.severity && SEVERITY[observation.severity]
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        {severity && (
          <Badge variant={severity.tone}>
            <Text>{severity.label}</Text>
          </Badge>
        )}
        <Text className="text-base text-muted-foreground">{categoriesText(observation)}</Text>
      </View>
      {place && <Text className="text-base">{place}</Text>}
      <Text className="tabular-nums text-sm text-muted-foreground">
        {[observation.engineer, capturedAt(observation.recordedAt)].filter(Boolean).join(' · ')}
      </Text>
    </View>
  )
}
