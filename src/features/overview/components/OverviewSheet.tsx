// The Overview opened from the band's Overview button (MB-20, web AS-06): a sheet that slides up with the stage
// line, the one Next step, then groups: To fix (red), Gaps (amber, with the checklist areas that
// need more), Reminders, and On the web (greyed: the phone cannot do them). Read only. A row or
// the Next step button closes the sheet and goes there through onGo. Called by screens/Workspace.
import { CircleCheck } from 'lucide-react-native'
import { View } from 'react-native'
import { BottomSheet } from '@/components/BottomSheet'
import { Text } from '@/components/ui/text'
import type { Observation } from '@/features/observations/format'
import { grouped, phoneNext, type Target } from '../format'
import type { SummaryItem } from '../api'
import type { SummaryState } from '../useSummary'
import { AreaBar } from './AreaBar'
import { GapRow } from './GapRow'
import { NextStep } from './NextStep'
import { StageLine } from './StageLine'
import { UncategorisedGap } from './UncategorisedGap'

function Group({ title, color, count, children }: { title: string; color: string; count: number; children: React.ReactNode }) {
  return (
    <View>
      <Text accessibilityRole="header" className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{`${title} · ${count}`}</Text>
      {children}
    </View>
  )
}

// `uncategorised`: the assessment's observations with no category, listed under that gap.
type Props = { state: SummaryState; uncategorised: Observation[]; onGo(target: Target): void; onClose(): void }

export function OverviewSheet({ state, uncategorised, onGo, onClose }: Props) {
  const { summary, problem } = state
  // Archived, or no signal and no saved copy: the sheet says why instead of listing.
  if (!summary)
    return (
      <BottomSheet testID="overview-sheet" title="Overview" onClose={onClose}>
        <View className="p-4 pb-8">
          <Text className={problem?.kind === 'archived' ? 'text-muted-foreground' : 'text-destructive'}>{problem?.text}</Text>
        </View>
      </BottomSheet>
    )
  const g = grouped(summary.items)
  // The uncategorised gap lists its observations (when the phone holds them); every other row is a plain GapRow.
  const rows = (items: SummaryItem[]) =>
    items.map((i) => (i.id === 'uncategorised' && uncategorised.length ? <UncategorisedGap key={i.id} item={i} observations={uncategorised} onGo={onGo} /> : <GapRow key={i.id} item={i} onGo={onGo} />))
  const open = g.toFix.length + g.gaps.length + g.reminders.length + g.onTheWeb.length + summary.areas.length
  return (
    <BottomSheet testID="overview-sheet" title="Overview" heightRatio={0.82} onClose={onClose}>
      <View className="gap-4 p-4 pb-8">
        <StageLine label={summary.stageLabel} index={summary.stageIndex} />
        <NextStep next={phoneNext(summary)} onGo={onGo} />
        {g.toFix.length > 0 && <Group title="To fix" color="#ad2e2d" count={g.toFix.length}>{rows(g.toFix)}</Group>}
        {(g.gaps.length > 0 || summary.areas.length > 0) && (
          <Group title="Gaps" color="#8f5f13" count={g.gaps.length + summary.areas.length}>
            {rows(g.gaps)}
            {summary.areas.map((a) => (
              <AreaBar key={a.area} area={a} onPress={() => onGo({ kind: 'checklist' })} />
            ))}
          </Group>
        )}
        {g.reminders.length > 0 && <Group title="Reminders" color="#2c5488" count={g.reminders.length}>{rows(g.reminders)}</Group>}
        {open === 0 && (
          <View className="flex-row items-center gap-2">
            <CircleCheck color="#2f7049" size={18} />
            <Text className="text-sm">Nothing needs you right now.</Text>
          </View>
        )}
        {g.onTheWeb.length > 0 && <Group title="On the web" color="#545e6b" count={g.onTheWeb.length}>{rows(g.onTheWeb)}</Group>}
      </View>
    </BottomSheet>
  )
}
