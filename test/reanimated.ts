// Jest's stand-in for src/lib/reanimated.ts (package.json `jest.moduleNameMapper`).
// Reanimated needs the phone's UI thread, which Jest doesn't have. The chats panel (MB-14)
// only has to render here, so this is a plain View and values that don't animate.
import { View } from 'react-native'

export const Animated = { View }
export const Easing = { out: (f: unknown) => f, cubic: (x: number) => x }
export const useSharedValue = (value: number) => ({ value, get: () => value, set: () => {} })
export const useAnimatedStyle = () => ({})
export const withTiming = (value: number) => value
