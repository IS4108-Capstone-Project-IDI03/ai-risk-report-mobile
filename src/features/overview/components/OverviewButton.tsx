// The Overview as one full-width bar at the top of the phone's workspace (MB-20, web AS-06). It is the
// web phone view's assistant bar in native clothes: the stage, eight progress segments, one chip (red
// for things to fix, amber for gaps, green when clear), the report's due note and a chevron. The whole
// bar is the button; it opens OverviewSheet. The iPad keeps the card (OverviewCard).
// Changed 20 Nov (Miya): was a small pill in the navy band. Called by screens/Workspace.
import { ChevronRight } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { counts } from '../format'
import type { SummaryState } from '../useSummary'

// `due` is the Home card's note for this assessment (dueNote in assessments/filters), or null.
type Props = { state: SummaryState; due: { text: string; tone: 'overdue' | 'soon' | 'later' } | null; onOpen(): void }

// Eight segments: stages done green, this one navy, the rest grey. The stage is also written, so
// colour is never the only cue. The same green as the sheet's "nothing open" tick.
export function Segments({ index }: { index: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="flex-row gap-1">
      {Array.from({ length: 8 }, (_, i) => (
        <View
          key={i}
          className={cn('h-1.5 flex-1 rounded-full', i === index ? 'bg-primary' : i > index && 'bg-border')}
          style={i < index ? { backgroundColor: '#2f7049' } : undefined}
        />
      ))}
    </View>
  )
}

export function OverviewButton({ state, due, onOpen }: Props) {
  const { summary, problem } = state
  // Someone else's assessment (403) gets none; nothing yet to say while it loads.
  if (problem?.kind === 'not-mine' || (!summary && !problem)) return null
  const { toFix, gaps } = summary ? counts(summary) : { toFix: 0, gaps: 0 }
  const label = !summary ? 'Overview' : `Overview, ${toFix ? `${toFix} to fix, ` : ''}${gaps} ${gaps === 1 ? 'gap' : 'gaps'}`
  const chip = toFix
    ? { tone: 'critical' as const, text: `${toFix} to fix` }
    : gaps
      ? { tone: 'warning' as const, text: `${gaps} ${gaps === 1 ? 'gap' : 'gaps'}` }
      : { tone: 'success' as const, text: 'All clear' }
  return (
    // min-h-14 (56px) keeps a generous touch target even with no summary to show (offline, no copy; archived).
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onOpen}
      className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted"
    >
      <View className="flex-1 gap-2">
        {summary ? (
          <>
            <View className="flex-row items-center justify-between gap-3">
              <Text className="shrink font-semibold">{`${summary.stageLabel} · stage ${summary.stageIndex + 1} of 8`}</Text>
              <Badge variant={chip.tone}>
                <Text>{chip.text}</Text>
              </Badge>
            </View>
            <Segments index={summary.stageIndex} />
            {/* "Report" says what is due: "Overdue" alone could read as the whole assessment. */}
            {due && <Text className={cn('text-sm', due.tone === 'overdue' ? 'font-medium text-destructive' : 'text-muted-foreground')}>{`Report ${due.text.charAt(0).toLowerCase()}${due.text.slice(1)}`}</Text>}
          </>
        ) : (
          <Text className="font-semibold">Overview</Text>
        )}
      </View>
      <ChevronRight color="#545e6b" size={20} />
    </Pressable>
  )
}
