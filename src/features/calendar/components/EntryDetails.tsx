// An entry's details (MB-19, web CP-60): a bottom sheet as tall as its content (not a full-height
// page: a few lines do not need one) with the assessment's site, client, reference, type, status,
// survey days, report due date and site contacts, and two buttons: Open assessment and Reschedule.
// Reschedule is greyed, with its reason, for someone else's assessment and with no signal. Shown by
// screens/Calendar; Reschedule closes it and opens RescheduleSheet, a full-height form.
import { View } from 'react-native'
import { BottomSheet } from '@/components/BottomSheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { STATUS } from '@/features/assessments/format'
import { assessmentType, canReschedule, dueOf, formatDay, formatSpan, type CalendarItem } from '../calendar'
import { DUE_COLOR, NOT_MINE, OFFLINE_RESCHEDULE } from '../format'

type Props = {
  item: CalendarItem
  today: string
  meId: string
  offline: boolean
  onOpen(): void
  onReschedule(): void
  onClose(): void
}

// A labelled fact. Two sit side by side (`half`) so the sheet stays short.
function Row({ label, half, children }: { label: string; half?: boolean; children: React.ReactNode }) {
  return (
    <View className={half ? 'flex-1 gap-0.5 py-2' : 'gap-0.5 border-t border-border py-2'}>
      <Text className="text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">{label}</Text>
      {children}
    </View>
  )
}

export function EntryDetails({ item, today, meId, offline, onOpen, onReschedule, onClose }: Props) {
  const mine = canReschedule(item, meId)
  const due = dueOf(item, today)
  const status = STATUS[item.status]
  // Why Reschedule is greyed, if it is.
  const reason = !mine ? NOT_MINE : offline ? OFFLINE_RESCHEDULE : null
  return (
    <BottomSheet testID="entry-details" title={item.site} heightRatio={0.75} onClose={onClose}>
        <View className="px-4 pb-4">
          <Text className="pt-3 text-muted-foreground">{item.client}</Text>
          <Text className="pb-3 text-sm tabular-nums text-muted-foreground">{item.reference}</Text>
          <View className="flex-row gap-4 border-t border-border">
            <Row half label="Assessment type">
              <Text>{assessmentType(item.type)}</Text>
            </Row>
            <Row half label="Status">
              <View className="flex-row">
                <Badge variant={status.tone}>
                  <Text>{status.label}</Text>
                </Badge>
              </View>
            </Row>
          </View>
          <View className="flex-row gap-4 border-t border-border">
            <Row half label="Survey">
              <Text>{item.start ? formatSpan(item.start, item.end) : 'No survey date'}</Text>
            </Row>
            <Row half label="Report due">
              {item.due ? (
                <Text>
                  {formatDay(item.due)}
                  {due && <Text style={{ color: DUE_COLOR[due.state] }}>{`\n${due.note}`}</Text>}
                </Text>
              ) : (
                <Text>Not set</Text>
              )}
            </Row>
          </View>
          {!mine && item.engineer && (
            <Row label="Engineer">
              <Text>{item.engineer.name}</Text>
            </Row>
          )}
          <Row label="Site contacts">
            {item.contacts.length ? (
              item.contacts.map((c) => (
                <Text key={c.name}>{c.role ? `${c.name} · ${c.role}` : c.name}</Text>
              ))
            ) : (
              <Text className="text-muted-foreground">None added</Text>
            )}
          </Row>
        <View className="gap-2 border-t border-border pb-2 pt-3">
          {reason && <Text className="text-sm text-muted-foreground">{reason}</Text>}
          <View className="flex-row gap-2">
            <Button className="flex-1" onPress={onOpen}>
              <Text>Open assessment</Text>
            </Button>
            <Button variant="outline" className="flex-1" disabled={!!reason} onPress={onReschedule}>
              <Text>Reschedule</Text>
            </Button>
          </View>
        </View>
        </View>
    </BottomSheet>
  )
}
