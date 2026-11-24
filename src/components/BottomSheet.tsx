// A sheet that slides up over the bottom of a screen (MB-19 calendar day sheet, MB-20 Overview): a
// dimmed backdrop, a title with Close, and scrolling content. It is a plain view, not a Modal, so
// another Modal (an entry's details) can open over it and the sheet is still there when it closes.
// Called by features/calendar/screens/Calendar and features/overview/components/OverviewSheet.
import { useEffect, useState } from 'react'
import { Animated, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

// `heightRatio`: the most of the screen's height it may take (the calendar's day sheet 0.6, the Overview 0.82).
type Props = { title: string; testID: string; heightRatio?: number; onClose(): void; children: React.ReactNode }

export function BottomSheet({ title, testID, heightRatio = 0.6, onClose, children }: Props) {
  const { height } = useWindowDimensions()
  // Starts below the screen and slides up on first show.
  const [y] = useState(() => new Animated.Value(height))
  useEffect(() => {
    Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: true }).start()
  }, [y])
  // Slides down, then tells the screen, so it never just vanishes.
  const close = () => Animated.timing(y, { toValue: height, duration: 180, useNativeDriver: true }).start(({ finished }) => finished && onClose())

  return (
    <View testID={testID} className="absolute inset-0" pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={close} className="flex-1 bg-black/30" />
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: height * heightRatio, alignItems: 'center', transform: [{ translateY: y }] }}>
        {/* Full width on a phone; no wider than 560pt on an iPad. */}
        <View className="w-full max-w-[560px] rounded-t-2xl border-t border-border bg-card">
          <View className="items-center pt-2">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>
          <View className="flex-row items-center justify-between px-4">
            <Text accessibilityRole="header" className="flex-1 py-3 text-base font-bold">{title}</Text>
            <Button variant="ghost" accessibilityLabel="Close" onPress={close}>
              <Text className="text-primary">Close</Text>
            </Button>
          </View>
          <ScrollView className="border-t border-border">{children}</ScrollView>
        </View>
      </Animated.View>
    </View>
  )
}
