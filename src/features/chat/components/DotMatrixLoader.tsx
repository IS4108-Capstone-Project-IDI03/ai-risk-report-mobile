// The web chat's waiting loader (MB-06 AC2), shown from asking until the search
// step begins: OpenUI's DotMatrixLoader, compact (react-ui's
// components/DotMatrixLoader/DotMatrixLoader.js). A 4×4 grid of grey dots, 24px;
// a bright head with a fading trail runs clockwise round the outer ring and
// anticlockwise round the inner one, a lap every 1.4s, over dots at 14%.
// The web repaints each frame in JS; here one looping value drives every dot's
// opacity through a precomputed curve, so it runs on the native thread.
import { useEffect, useState } from 'react'
import { Animated, Easing, View } from 'react-native'

const GRID = 4
const SIZE = 24
const REVOLUTION_MS = 1400
const MIN_OPACITY = 0.14
const TRAIL_LENGTH = 0.28 // of the ring, as on the web
const STEPS = 56 // samples per lap for each dot's opacity curve

// A ring's cells clockwise from its top-left corner, as the web's createClockwiseRing.
function ring(inset: number) {
  const start = inset
  const end = GRID - inset - 1
  const cells: [number, number][] = []
  for (let col = start; col <= end; col++) cells.push([start, col])
  for (let row = start + 1; row <= end; row++) cells.push([row, end])
  for (let col = end - 1; col >= start; col--) cells.push([end, col])
  for (let row = end - 1; row > start; row--) cells.push([row, start])
  return cells
}

// One dot's brightness with the ring's head at `head` (the web's paintRing):
// a trail fading behind the head, and a soft fade-in just ahead of it.
function opacity(index: number, head: number, length: number) {
  const distance = (head - index + length) % length
  const trail = Math.exp(-distance / (length * TRAIL_LENGTH))
  const ahead = (index - head + length) % length
  const lead = ahead < 1 ? 1 - ahead : 0
  const intensity = Math.max(trail, lead * lead * (3 - 2 * lead))
  return MIN_OPACITY + (1 - MIN_OPACITY) * intensity
}

// For each cell, its opacity over one lap: outer ring clockwise, inner anticlockwise.
const CURVES = new Map<string, number[]>()
for (const [cells, clockwise] of [
  [ring(0), true],
  [ring(1), false],
] as const) {
  cells.forEach(([row, col], i) => {
    const curve = Array.from({ length: STEPS + 1 }, (_, s) => {
      const progress = s / STEPS
      return opacity(i, (clockwise ? progress : 1 - progress) * cells.length, cells.length)
    })
    CURVES.set(`${row}-${col}`, curve)
  })
}
const INPUT = Array.from({ length: STEPS + 1 }, (_, s) => s / STEPS)

export function DotMatrixLoader() {
  const [progress] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const lap = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: REVOLUTION_MS, easing: Easing.linear, useNativeDriver: true }),
    )
    lap.start()
    return () => lap.stop()
  }, [progress])

  const dot = SIZE / GRID
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityLiveRegion="polite"
      style={{ width: SIZE, height: SIZE, flexDirection: 'row', flexWrap: 'wrap' }}
    >
      {Array.from({ length: GRID * GRID }, (_, n) => {
        const key = `${Math.floor(n / GRID)}-${n % GRID}`
        return (
          <View key={key} style={{ width: dot, height: dot, alignItems: 'center', justifyContent: 'center' }}>
            {/* 68% of its cell, round, in the web theme's secondary text grey. */}
            <Animated.View
              style={{
                width: dot * 0.68,
                height: dot * 0.68,
                borderRadius: dot,
                backgroundColor: '#545e6b',
                opacity: progress.interpolate({ inputRange: INPUT, outputRange: CURVES.get(key)! }),
              }}
            />
          </View>
        )
      })}
    </View>
  )
}
