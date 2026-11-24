// One Inbox row (MB-22): the tick circle, two lines of words, and at the right the report due date
// (To do only). The whole middle is the open target; the tick is a separate button beside it, so neither is
// inside the other. A Done row is swiped to show Remove, as an observation is swiped to Delete (Miya, 24 Nov:
// it was a button on the row before). Called by screens/Inbox.
import { Check } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { formatDay } from '@/features/calendar/calendar'
import { SwipeDelete } from '@/features/observations/components/SwipeDelete'
import { cn } from '@/lib/utils'
import type { Notification } from '../api'
import { rowOf } from '../row'

type Props = { item: Notification; today: string; offline: boolean; onOpen(n: Notification): void; onToggle(n: Notification): void; onRemove(n: Notification): void }

export function InboxRow({ item, today, offline, onOpen, onToggle, onRemove }: Props) {
  const w = rowOf(item)
  const both = [w.task, w.detail].filter(Boolean)
  // A report that is already late is red, as on Home.
  const late = !item.done && !!w.due && w.due < today
  return (
    // Only a Done row can be swiped, and not offline: a dismiss is a server state, so nothing is queued.
    <SwipeDelete plain buttonLabel="Remove" accessibilityLabel={`Remove: ${both.join(' ')}`} onDelete={item.done && !offline ? () => onRemove(item) : undefined}>
      <View className="min-h-[72px] flex-row items-center border-b border-border bg-card pl-1 pr-3">
        {/* The circle: a 48pt touch target around a 28pt circle, filled with a tick when Done. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.done ? 'Move back to To do' : 'Mark done'}: ${both.join(' ')}`}
          accessibilityState={{ disabled: offline }}
          disabled={offline}
          onPress={() => onToggle(item)}
          className="h-12 w-12 items-center justify-center active:opacity-60"
        >
          <View className={cn('h-7 w-7 items-center justify-center rounded-full border-2 border-primary', item.done && 'bg-primary', offline && 'opacity-40')}>
            {item.done && <Check color="#ffffff" size={16} strokeWidth={3} />}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={both.join(', ')} onPress={() => onOpen(item)} className="flex-1 justify-center py-3 active:opacity-60">
          <Text testID="inbox-task" className="font-semibold">{w.task}</Text>
          {!!w.detail && <Text testID="inbox-detail" className={cn('text-sm', w.tone === 'red' ? 'text-destructive' : 'text-muted-foreground')}>{w.detail}</Text>}
        </Pressable>
        {!item.done && !!w.due && <Text className={cn('pl-2 text-sm', late ? 'font-semibold text-destructive' : 'text-muted-foreground')}>Due {formatDay(w.due)}</Text>}
      </View>
    </SwipeDelete>
  )
}
