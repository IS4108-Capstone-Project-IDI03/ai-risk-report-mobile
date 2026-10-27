// One card in the assessment list (MB-01 AC8). Used by screens/AssessmentList.
// Tapping it opens the assessment's workspace (MB-02 AC1). Shows how long
// until its report is due, or that it's overdue (MB-04 AC8).
import { router } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { dueNote } from '../filters'
import { formatDate, STATUS, type Assessment } from '../format'

export function AssessmentRow({ assessment }: { assessment: Assessment }) {
  const status = STATUS[assessment.status]
  const due = dueNote(assessment)
  return (
    <Pressable
      accessibilityRole="button"
      // Read aloud in full, since this label replaces the card's own text.
      accessibilityLabel={[assessment.client, assessment.site.name, assessment.reference, status.label, due?.text]
        .filter(Boolean)
        .join(', ')}
      onPress={() =>
        router.push({ pathname: '/assessment/[reference]', params: { reference: assessment.reference } })
      }
    >
      {({ pressed }) => (
        <Card className={pressed ? 'gap-2 bg-muted px-4 py-4' : 'gap-2 px-4 py-4'}>
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-lg font-semibold leading-6">{assessment.client}</Text>
            <Badge variant={status.tone}>
              <Text>{status.label}</Text>
            </Badge>
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-muted-foreground">{assessment.site.name}</Text>
            {/* The report's deadline (MB-04 AC8): red once overdue, amber within 3 days. */}
            {due?.tone === 'overdue' ? (
              <Badge variant="critical">
                <Text>{due.text}</Text>
              </Badge>
            ) : (
              due && (
                <Text className={due.tone === 'soon' ? 'text-sm font-medium text-warning-foreground' : 'text-sm text-muted-foreground'}>
                  {due.text}
                </Text>
              )
            )}
          </View>
          {/* References and dates in mono, as on the web. */}
          <View className="flex-row items-center gap-x-3 border-t border-border pt-2">
            <Text className="font-mono text-sm text-muted-foreground">{assessment.reference}</Text>
            <Text className="flex-1 font-mono text-sm text-muted-foreground">
              {formatDate(assessment.siteVisitDate)}
            </Text>
            <ChevronRight color="#545e6b" size={18} />
          </View>
        </Card>
      )}
    </Pressable>
  )
}
