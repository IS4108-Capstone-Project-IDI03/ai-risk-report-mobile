// Home's "Capturing now" card (MB-07 AC1): the latest assessment being
// captured, above the list. The whole card is one big button back into its
// workspace, so any tap on it works with gloves on.
// Used by screens/AssessmentList.
import { ChevronRight } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Eyebrow } from '@/components/Eyebrow'
import { Badge } from '@/components/ui/badge'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { dueNote } from '../filters'
import type { Assessment } from '../format'

type Props = { assessment: Assessment; onOpen(reference: string): void }

export function CapturingNowCard({ assessment, onOpen }: Props) {
  const due = dueNote(assessment)
  return (
    <View testID="capturing-now" className="gap-2">
      <Eyebrow>Capturing now</Eyebrow>
      <Pressable
        accessibilityRole="button"
        // Read aloud in full, since this label replaces the card's own text.
        accessibilityLabel={['Continue capturing', assessment.site.name, assessment.client, assessment.reference, due?.text]
          .filter(Boolean)
          .join(', ')}
        onPress={() => onOpen(assessment.reference)}
        className="gap-3 rounded-lg border border-border bg-card p-4 active:bg-muted"
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-lg font-semibold leading-6">{assessment.site.name}</Text>
            <Text className="text-muted-foreground">{assessment.client}</Text>
          </View>
          {/* The report's deadline, as on the list's rows (MB-04 AC8). */}
          {due?.tone === 'overdue' ? (
            <Badge variant="critical">
              <Text>{due.text}</Text>
            </Badge>
          ) : (
            due && (
              <Text className={cn('text-sm font-semibold', due.tone === 'soon' ? 'text-warning-foreground' : 'text-muted-foreground')}>
                {due.text}
              </Text>
            )
          )}
        </View>
        <Text className="font-mono text-sm text-muted-foreground">{assessment.reference}</Text>
        {/* Looks like the screen's primary button; the card around it takes the tap. */}
        <View className="h-12 flex-row items-center justify-center gap-2 rounded-md bg-primary">
          <Text className="font-semibold text-primary-foreground">Continue capturing</Text>
          <ChevronRight color="#ffffff" size={18} />
        </View>
      </Pressable>
    </View>
  )
}
