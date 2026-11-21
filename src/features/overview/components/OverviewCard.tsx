// The assessment's Overview card (MB-20, web AS-06), at the top of the workspace: the stage
// line, the one next step, the open items most urgent first (five, then "Show all"), the
// checklist areas that need more, and the three "At a glance" facts. Read only. A "Hide"
// button folds it away, for capturing on a small phone. Called by screens/Workspace; its data
// is useSummary's. A gateway link that the phone has opens through onGo.
import { ChevronDown, ChevronUp, CircleCheck } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import type { SummaryState } from '../useSummary'
import type { Target } from '../format'
import { AreaBar } from './AreaBar'
import { GapRow } from './GapRow'
import { Glance } from './Glance'
import { NextStep } from './NextStep'
import { StageLine } from './StageLine'

const SHOWN = 5

type Props = { state: SummaryState; onGo(target: Target): void }

export function OverviewCard({ state, onGo }: Props) {
  const { summary, problem } = state
  const [hidden, setHidden] = useState(false)
  const [all, setAll] = useState(false)
  // Someone else's assessment gets no card at all (403): it is for the assigned engineer.
  if (problem?.kind === 'not-mine') return null
  if (!summary && !problem) return null

  const items = summary ? (all ? summary.items : summary.items.slice(0, SHOWN)) : []
  return (
    <View testID="overview-card" className="rounded-lg border border-border bg-card">
      <View className="flex-row items-center justify-between pl-4 pr-1">
        <Text accessibilityRole="header" className="text-base font-bold">Overview</Text>
        {summary && (
          <Button variant="ghost" accessibilityLabel={hidden ? 'Show next step' : 'Hide next step'} onPress={() => setHidden(!hidden)}>
            {hidden ? <ChevronDown color="#2c5488" size={18} /> : <ChevronUp color="#2c5488" size={18} />}
            <Text className="text-primary">{hidden ? 'Show' : 'Hide'}</Text>
          </Button>
        )}
      </View>
      {problem && (
        <View className="px-4 pb-4">
          <Text className={problem.kind === 'archived' ? 'text-muted-foreground' : 'text-destructive'}>{problem.text}</Text>
        </View>
      )}
      {summary && !hidden && (
        <View className="gap-3 px-4 pb-4">
          <StageLine label={summary.stageLabel} index={summary.stageIndex} />
          <NextStep next={summary.next} onGo={onGo} />
          {items.length ? (
            <View>
              {items.map((i) => (
                <GapRow key={i.id} item={i} onGo={onGo} />
              ))}
              {summary.items.length > SHOWN && (
                <Button variant="ghost" onPress={() => setAll(!all)} className="self-start">
                  <Text className="text-primary">{all ? 'Show fewer' : `Show all ${summary.items.length}`}</Text>
                </Button>
              )}
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <CircleCheck color="#2f7049" size={18} />
              <Text className="text-sm">Nothing needs you right now.</Text>
            </View>
          )}
          {summary.areas.length > 0 && (
            <View>
              <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Checklist areas that need more</Text>
              {summary.areas.map((a) => (
                <AreaBar key={a.area} area={a} onPress={() => onGo({ kind: 'checklist' })} />
              ))}
            </View>
          )}
          <Glance facts={summary.glance} />
        </View>
      )}
    </View>
  )
}
