// One card in the assessment list (MB-01 AC8). Used by screens/AssessmentList.
// Not tappable yet: opening an assessment for capture comes in MB-02.
import { View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { formatDate, STATUS, type Assessment } from '../format'

export function AssessmentRow({ assessment }: { assessment: Assessment }) {
  const status = STATUS[assessment.status]
  return (
    <Card className="gap-2 px-4 py-4">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-lg font-semibold leading-6">{assessment.client}</Text>
        <Badge variant={status.tone}>
          <Text>{status.label}</Text>
        </Badge>
      </View>
      <Text className="text-muted-foreground">{assessment.site.name}</Text>
      {/* References and dates in mono, as on the web. */}
      <View className="flex-row flex-wrap gap-x-3 border-t border-border pt-2">
        <Text className="font-mono text-sm text-muted-foreground">{assessment.reference}</Text>
        <Text className="font-mono text-sm text-muted-foreground">
          {formatDate(assessment.siteVisitDate)}
        </Text>
      </View>
    </Card>
  )
}
