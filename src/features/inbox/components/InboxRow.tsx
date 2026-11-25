// One Inbox row (MB-22): the tick circle, two lines of words, and at the right the report due date
// (To do only). The whole middle is the open target; the tick is a separate button beside it, so neither is
// inside the other. A To do row is swiped to show Remove, as an observation is swiped to Delete (Miya, 25 Nov:
// it was on Done rows before). Called by screens/Inbox.
import { Check } from 'lucide-react-native'
import { useState } from 'react'
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native'
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
  // True while the tick (or untick) is playing: the circle shows where the row is going.
  const [flipped, setFlipped] = useState(false)
  const [scale] = useState(() => new Animated.Value(1))
  const [fade] = useState(() => new Animated.Value(1))
  const ticked = item.done !== flipped

  // The web's timing (client/src/features/inbox): the circle plays for 620 ms, then the row fades for 180 ms.
  // shortcut: the call goes after the animation, so leaving the screen within 0.8 s can lose the tick.
  async function toggle() {
    if (flipped) return
    if (await AccessibilityInfo.isReduceMotionEnabled()) return onToggle(item)
    setFlipped(true)
    const to = (value: Animated.Value, toValue: number, duration: number) => Animated.timing(value, { toValue, duration, useNativeDriver: true })
    Animated.sequence([to(scale, 1.3, 130), to(scale, 1, 130), Animated.delay(360), to(fade, 0, 180)]).start(() => {
      onToggle(item)
      // A row still here (the call was refused) comes back; a frame later, so a leaving row doesn't flash.
      requestAnimationFrame(() => {
        setFlipped(false)
        fade.setValue(1)
      })
    })
  }
  return (
    // The fade is outside the swipe row: its Remove button sits behind the row all the time, and
    // fading only the row would show it through.
    <Animated.View testID="inbox-fade" needsOffscreenAlphaCompositing style={{ opacity: fade }}>
      {/* Only a To do row can be swiped, and not offline: a dismiss is a server state, so nothing is queued. */}
      <SwipeDelete plain buttonLabel="Remove" accessibilityLabel={`Remove: ${both.join(' ')}`} onDelete={!item.done && !offline ? () => onRemove(item) : undefined}>
        <View className="min-h-[72px] flex-row items-center border-b border-border bg-card pl-1 pr-3">
          {/* The circle: a 48pt touch target around a 28pt circle, filled with a tick when Done. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.done ? 'Move back to To do' : 'Mark done'}: ${both.join(' ')}`}
            accessibilityState={{ disabled: offline }}
            disabled={offline}
            onPress={toggle}
            className="h-12 w-12 items-center justify-center active:opacity-60"
          >
            <Animated.View style={{ transform: [{ scale }] }}>
              <View testID={ticked ? 'inbox-ticked' : undefined} className={cn('h-7 w-7 items-center justify-center rounded-full border-2 border-primary', ticked && 'bg-primary', offline && 'opacity-40')}>
                {ticked && <Check color="#ffffff" size={16} strokeWidth={3} />}
              </View>
            </Animated.View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={both.join(', ')} onPress={() => onOpen(item)} className="flex-1 justify-center py-3 active:opacity-60">
            <Text testID="inbox-task" className="font-semibold">{w.task}</Text>
            {!!w.detail && <Text testID="inbox-detail" className={cn('text-sm', w.tone === 'red' ? 'text-destructive' : 'text-muted-foreground')}>{w.detail}</Text>}
          </Pressable>
          {!item.done && !!w.due && <Text className={cn('pl-2 text-sm', late ? 'font-semibold text-destructive' : 'text-muted-foreground')}>Due {formatDay(w.due)}</Text>}
        </View>
      </SwipeDelete>
    </Animated.View>
  )
}
