// One card in the assessment list (MB-01 AC8). Used by screens/AssessmentList.
// Tapping it opens the assessment's workspace (MB-02 AC1). Shows how long
// until its report is due, or that it's overdue (MB-04 AC8). MB-07: the rows
// join into one rounded card, so `first` and `last` round its ends. MB-09:
// `onOpen` opens it (Home pushes the workspace, or shows it beside the list in
// the split view), and `chosen` marks the one shown there.
import { ChevronRight } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { dueNote } from '../filters'
import { formatDate, STATUS, type Assessment } from '../format'

type Props = { assessment: Assessment; first: boolean; last: boolean; chosen?: boolean; onOpen(reference: string): void }

export function AssessmentRow({ assessment, first, last, chosen = false, onOpen }: Props) {
  const status = STATUS[assessment.status]
  const due = dueNote(assessment)
  return (
    <Pressable
      accessibilityRole="button"
      // Read aloud in full, since this label replaces the card's own text.
      accessibilityLabel={[assessment.client, assessment.site.name, assessment.reference, status.label, due?.text]
        .filter(Boolean)
        .join(', ')}
      accessibilityState={{ selected: chosen }}
      onPress={() => onOpen(assessment.reference)}
      className={cn(
        'flex-row items-center gap-3 border-x border-b border-border bg-card px-4 py-3.5 active:bg-muted',
        first && 'rounded-t-lg border-t',
        last && 'rounded-b-lg',
        // As the picker's chosen location: ink-50 with an ink rule on the left.
        chosen && 'border-l-4 border-l-primary bg-secondary',
      )}
    >
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold leading-6">{assessment.site.name}</Text>
        <Text className="text-sm text-muted-foreground">{assessment.client}</Text>
        {/* References in mono, as on the web. */}
        <View className="mt-1 flex-row flex-wrap items-center gap-2">
          <Badge variant={status.tone}>
            <Text>{status.label}</Text>
          </Badge>
          <Text className="tabular-nums text-sm text-muted-foreground">{assessment.reference}</Text>
          <Text className="tabular-nums text-sm text-muted-foreground">{formatDate(assessment.siteVisitDate)}</Text>
        </View>
      </View>
      {/* The report's deadline (MB-04 AC8): red once overdue, amber within 3 days. */}
      {due && (
        <Text
          className={cn(
            'text-sm font-semibold',
            due.tone === 'overdue' ? 'text-destructive' : due.tone === 'soon' ? 'text-warning-foreground' : 'text-muted-foreground',
          )}
        >
          {due.text}
        </Text>
      )}
      <ChevronRight color="#545e6b" size={18} />
    </Pressable>
  )
}
