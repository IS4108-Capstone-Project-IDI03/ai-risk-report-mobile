// A short ease for a pane that opens or closes (MB-09 AC7, MB-05 AC21). Call it just
// before the state change: React Native then animates the layout move instead of
// snapping. 260 ms, as the web design system's "sidebar collapse eases" (design-system-v2
// motion table). Skipped when the person asked their phone to reduce motion.
import { AccessibilityInfo, LayoutAnimation } from 'react-native'

let reduce = false
AccessibilityInfo.isReduceMotionEnabled().then((on) => (reduce = on))

export function easeLayout() {
  if (!reduce) LayoutAnimation.configureNext({ duration: 260, update: { type: 'easeInEaseOut' } })
}
