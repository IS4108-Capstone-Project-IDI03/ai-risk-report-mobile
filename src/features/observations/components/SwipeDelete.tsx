// A swipe row (MB-12 AC7): swiping the observation card left slides it over to show a
// red Delete button that sits behind it. Used by the workspace list; with no `onDelete`
// (a waiting or offline row) it can't be swiped and has no button. The row closes again
// on a tap, so a "Keep" in the confirmation leaves the list as it was.
// The button stays laid out behind the card at all times, because the swipe row measures
// how far to slide from it. This wrapper carries the list's side margin and the first and
// last card's rounded corners and clips to them, so the red never shows past a corner.
import { Trash2 } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

type Props = { onDelete?: () => void; first: boolean; last: boolean; children: ReactNode }

export function SwipeDelete({ onDelete, first, last, children }: Props) {
  return (
    <View className={cn('mx-4 overflow-hidden', first && 'rounded-t-lg', last && 'rounded-b-lg')}>
      {/* A new row when swiping switches on or off (e.g. the signal drops), so one left
          slid open closes instead of staying offset over an empty gap. */}
      <ReanimatedSwipeable
        key={onDelete ? 'swipe' : 'still'}
        enabled={!!onDelete}
        overshootRight={false}
        renderRightActions={(_progress, _translation, swipeable) =>
          onDelete && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete observation"
              onPress={() => {
                swipeable.close()
                onDelete()
              }}
              className="w-24 items-center justify-center gap-1 bg-destructive"
            >
              <Trash2 color="#ffffff" size={20} />
              <Text className="text-sm font-semibold text-destructive-foreground">Delete</Text>
            </Pressable>
          )
        }
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  )
}
