// A walk already added to the assessment, read-only (MB-16 AC40; beyond the web, which only says
// "Everything from this walk is on the assessment."). Shown by WalkReview in place of the review when the
// walk's status is "created". Nothing here edits or saves: the gateway locks a created walk.
import { ScrollView, View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { capturedAt, SEVERITY } from '@/features/observations/format'
import { cn, readable } from '@/lib/utils'
import type { Proposal, SiteWalk } from '../api'
import { ObservationMedia } from '../components/ObservationMedia'
import { ALL, sectionsAt } from '../proposal'

export function WalkAdded({ walk, proposal }: { walk: SiteWalk; proposal: Proposal }) {
  return (
    <ScrollView testID="walk-added" contentContainerClassName="gap-4 p-4 pb-10">
      <View className={cn('gap-4', readable)}>
        <View className="gap-1">
          <Text className="text-xl font-semibold">{walk.name ?? 'Site walk'}</Text>
          <Text className="text-sm text-muted-foreground">{capturedAt(walk.createdAt)}</Text>
          <Badge variant="success" className="mt-1 self-start">
            <Text>Added to the assessment</Text>
          </Badge>
        </View>
        {/* The observations as they were added, by location, like the review's list. */}
        {sectionsAt(proposal, ALL).map((s) => (
          <View key={s.ref} className="gap-2">
            <Text className="text-sm font-semibold uppercase text-muted-foreground">{s.title}</Text>
            {s.items.map((o) => (
              <View key={o.ref} testID={`added-${o.ref}`} className="gap-3 rounded-lg border border-border bg-card p-3">
                <Text className="text-base">{o.note}</Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  {o.severity && (
                    <Badge variant={SEVERITY[o.severity].tone}>
                      <Text>{SEVERITY[o.severity].label}</Text>
                    </Badge>
                  )}
                  {o.copeDimension && <Text className="text-sm text-muted-foreground">{o.copeDimension}</Text>}
                </View>
                <ObservationMedia observation={o} walk={walk} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
