// The chats list as a drawer on a phone (MB-14), as ChatGPT's: the list sits underneath on the
// left, and opening it pushes the chat aside to the right (its edge rounds and shadows) rather
// than covering it. The pushed chat greys and blurs a little. Tap it, or swipe it back to
// the left, to close. Everything
// animates on the UI thread (Reanimated), so it stays smooth while the chat behind is busy.
// Used by screens/Chat.
import { BlurView } from 'expo-blur'
import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import { Animated, Easing, useAnimatedStyle, useSharedValue, withTiming } from '@/lib/reanimated'

// A soft stop, as native sheets do. Made when used, not when this file loads.
const ease = () => Easing.out(Easing.cubic)

type Props = { open: boolean; onClose(): void; list: ReactNode; children: ReactNode }

export function ChatsPanel({ open, onClose, list, children }: Props) {
  // The list takes 85% of the screen, up to 360pt; the chat slides over by that much.
  const width = Math.min(useWindowDimensions().width * 0.85, 360)
  // 0 closed, 1 open; a drag moves it between.
  const progress = useSharedValue(0)
  // The list is there while open and for the moment it slides shut, so it isn't loaded when closed.
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  useEffect(() => {
    progress.set(withTiming(open ? 1 : 0, { duration: 260, easing: ease() }))
    if (open) return
    const gone = setTimeout(() => setMounted(false), 280)
    return () => clearTimeout(gone)
  }, [open, progress])

  const pan = usePanGesture({
    // Only a clearly sideways drag counts, so scrolling the chat still works.
    activeOffsetX: [-12, 12],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      progress.set(Math.min(1, Math.max(0, 1 + e.translationX / width)))
    },
    // Shut past a third of the way, or on a quick flick left; else spring back.
    onDeactivate: (e) => {
      if (e.translationX < -width / 3 || e.velocityX < -600) scheduleOnRN(onClose)
      else progress.set(withTiming(1, { duration: 200, easing: ease() }))
    },
  })

  // The chat moves right and its top-left corner rounds; the shadow fades in with it.
  const chat = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * width }],
    borderTopLeftRadius: progress.get() * 24,
    shadowOpacity: progress.get() * 0.25,
  }))

  // The grey and the blur fade in and out with the slide.
  const veil = useAnimatedStyle(() => ({ opacity: progress.get() }))

  return (
    <View className="flex-1 bg-navy">
      {mounted && (
        <View testID="chats-panel" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width }}>
          {list}
        </View>
      )}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[{ flex: 1, backgroundColor: '#f7f9fc', overflow: 'hidden', shadowColor: '#000', shadowRadius: 14 }, chat]}
        >
          {children}
          {/* The chat can't be used while the list is open: a tap anywhere on it closes the list. */}
          {mounted && (
            <Pressable accessibilityRole="button" accessibilityLabel="Close chats veil" onPress={onClose} style={StyleSheet.absoluteFill}>
              <Animated.View style={[StyleSheet.absoluteFill, veil, { backgroundColor: 'rgba(40, 48, 66, 0.14)' }]}>
                <BlurView intensity={3} tint="default" style={StyleSheet.absoluteFill} />
              </Animated.View>
            </Pressable>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
