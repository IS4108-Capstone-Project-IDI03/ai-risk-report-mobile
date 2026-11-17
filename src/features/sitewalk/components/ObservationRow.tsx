// One proposed observation in the review list (MB-16 AC13): its note, severity and category, and
// what it still needs. A tap opens the editor. Used by screens/WalkReview.
import { Pressable, View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { SEVERITY } from '@/features/observations/format'
import type { ProposedObservation } from '../api'
import { missingFields } from '../proposal'

export function ObservationRow({ observation: o, onOpen }: { observation: ProposedObservation; onOpen(): void }) {
  const missing = missingFields(o)
  return (
    <Pressable
      testID={`proposed-${o.ref}`}
      accessibilityRole="button"
      accessibilityLabel={`Edit observation: ${o.note || 'No note'}`}
      onPress={onOpen}
      className="min-h-12 gap-2 rounded-lg border border-border bg-card p-3 active:bg-muted"
    >
      <Text numberOfLines={3} className="text-base">
        {o.note || 'No note yet'}
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        {o.severity && (
          <Badge variant={SEVERITY[o.severity].tone}>
            <Text>{SEVERITY[o.severity].label}</Text>
          </Badge>
        )}
        {o.copeDimension && <Text className="text-sm text-muted-foreground">{o.copeDimension}</Text>}
        {o.photoIds.length > 0 && <Text className="text-sm text-muted-foreground">{`${o.photoIds.length} ${o.photoIds.length === 1 ? 'photo' : 'photos'}`}</Text>}
      </View>
      {missing.length > 0 && <Text className="text-sm font-medium text-destructive">{`Needs ${missing.join(', ')}`}</Text>}
    </Pressable>
  )
}
