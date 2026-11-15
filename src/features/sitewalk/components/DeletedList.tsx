// The deleted observations of a proposal (MB-16 AC29): each readable (note, place, severity,
// category, its files) with Restore. The review's filters apply. Create all leaves these out unless
// restored. Shown by screens/WalkReview in place of the list.
import { View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { SEVERITY } from '@/features/observations/format'
import type { Proposal, SiteWalk } from '../api'
import { matchesFilters, placeName, type Filters } from '../proposal'
import { ObservationMedia } from './ObservationMedia'

type Props = { proposal: Proposal; walk: SiteWalk; filters: Filters; onRestore(ref: string): void }

export function DeletedList({ proposal: p, walk, filters, onRestore }: Props) {
  const items = (p.removed ?? []).filter((o) => matchesFilters(o, filters, walk.media))
  return (
    <View testID="deleted-screen" className="gap-3">
      {items.length === 0 && <Text className="text-muted-foreground">{p.removed?.length ? 'No deleted observations match these filters.' : 'Nothing deleted.'}</Text>}
      {items.map((o) => (
        <View key={o.ref} className="gap-3 rounded-lg border border-border bg-muted p-3">
          <Text className="text-base">{o.note || 'No note'}</Text>
          <Text className="text-sm text-muted-foreground">{placeName(p, o.locationRef)}</Text>
          <View className="flex-row flex-wrap items-center gap-2">
            {o.severity && <Badge variant={SEVERITY[o.severity].tone}><Text>{SEVERITY[o.severity].label}</Text></Badge>}
            {o.copeDimension && <Text className="text-sm text-muted-foreground">{o.copeDimension}</Text>}
          </View>
          <ObservationMedia observation={o} walk={walk} />
          <Button variant="outline" accessibilityLabel={`Restore: ${o.note || 'No note'}`} onPress={() => onRestore(o.ref)}>
            <Text>Restore</Text>
          </Button>
        </View>
      ))}
    </View>
  )
}
