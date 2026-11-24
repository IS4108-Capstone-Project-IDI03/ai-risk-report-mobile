// The two lists that sit beside the grid, or above the phone's day list (MB-19, web
// CP-60): Late reports, oldest first with how late, and No survey date, each with a
// count. A row opens EntryDetails; an unscheduled row also has Set dates, for the
// assigned engineer. Called by screens/Calendar. Calls EntryRow.
import { CalendarPlus } from 'lucide-react-native'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { canReschedule, dueOf, formatDay, type CalendarItem } from '../calendar'
import { EntryRow } from './EntryRow'

type Props = {
  late: CalendarItem[]
  unscheduled: CalendarItem[]
  // Filters are on, so an empty list says "match".
  filtered: boolean
  today: string
  meId: string
  // Set dates is greyed with no signal.
  offline: boolean
  onPress(item: CalendarItem): void
  onSetDates(item: CalendarItem): void
}

function Card({ title, count, alarm, children }: { title: string; count: number; alarm?: boolean; children: React.ReactNode }) {
  return (
    <View className="overflow-hidden rounded-lg border border-border bg-card">
      <View className="flex-row items-center gap-2 px-4 pb-1 pt-3">
        <Text accessibilityRole="header" className="text-base font-bold">{title}</Text>
        <View className={alarm ? 'rounded-full bg-destructive/10 px-2' : 'rounded-full bg-secondary px-2'}>
          <Text className={alarm ? 'text-sm font-semibold text-destructive' : 'text-sm font-semibold text-secondary-foreground'}>{count}</Text>
        </View>
      </View>
      {children}
    </View>
  )
}

export function SideLists({ late, unscheduled, filtered, today, meId, offline, onPress, onSetDates }: Props) {
  return (
    <View className="gap-4">
      <Card title="Late reports" count={late.length} alarm={late.length > 0}>
        {late.length ? (
          late.map((item) => (
            <EntryRow key={item.reference} item={item} kind="due" today={today} meId={meId} right={`${dueOf(item, today)?.note}\n${formatDay(item.due!)}`} onPress={onPress} />
          ))
        ) : (
          <Text className="px-4 pb-3 text-sm text-muted-foreground">{filtered ? 'No late reports match.' : 'No reports are late.'}</Text>
        )}
      </Card>
      <Card title="No survey date" count={unscheduled.length}>
        {unscheduled.length ? (
          unscheduled.map((item) => (
            <View key={item.reference} className="flex-row items-center">
              <View className="flex-1">
                <EntryRow item={item} kind="survey" today={today} meId={meId} onPress={onPress} />
              </View>
              {canReschedule(item, meId) && (
                <Button variant="ghost" disabled={offline} accessibilityLabel={`Set dates for ${item.site}`} onPress={() => onSetDates(item)}>
                  <CalendarPlus color="#2c5488" size={18} />
                  <Text className="text-primary">Set dates</Text>
                </Button>
              )}
            </View>
          ))
        ) : (
          <Text className="px-4 pb-3 text-sm text-muted-foreground">{filtered ? 'None without a survey date match.' : 'Every assessment has a survey date.'}</Text>
        )}
      </Card>
    </View>
  )
}
