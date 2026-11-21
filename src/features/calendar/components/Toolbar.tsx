// The calendar's controls (MB-19, web CP-60): the period with its arrows, Today, the
// Month / Week switch (wide windows only), and one scrolling row of filter chips: which
// dates, and which assessment type. Called by screens/Calendar.
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { Pressable, ScrollView, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import type { Show, View as Mode } from '../calendar'

const SHOWS: { value: Show; label: string }[] = [
  { value: '', label: 'All dates' },
  { value: 'surveys', label: 'Survey dates' },
  { value: 'due', label: 'Report due dates' },
]
const TYPES = ['', 'First survey', 'Resurvey', 'Follow-up']

type Props = {
  view: Mode
  label: string
  // Month / Week only where the grid is drawn; a phone has the month's list.
  canSwitch: boolean
  show: Show
  type: string
  onStep(by: number): void
  onToday(): void
  onView(view: Mode): void
  onShow(show: Show): void
  onType(type: string): void
}

// A 48pt chip; `on` marks the chosen one.
function Chip({ label, on, onPress }: { label: string; on: boolean; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={cn('h-12 justify-center rounded-md border px-3.5', on ? 'border-2 border-primary bg-secondary' : 'border-input bg-card active:bg-muted')}
    >
      <Text className="font-medium">{label}</Text>
    </Pressable>
  )
}

export function Toolbar({ view, label, canSwitch, show, type, onStep, onToday, onView, onShow, onType }: Props) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Pressable accessibilityRole="button" accessibilityLabel={`Previous ${view}`} onPress={() => onStep(-1)} className="h-12 w-12 items-center justify-center rounded-full active:bg-muted">
          <ChevronLeft color="#000f47" size={22} />
        </Pressable>
        <Text accessibilityRole="header" accessibilityLabel="Period shown" className="min-w-[150px] flex-1 text-center text-base font-bold text-primary">
          {label}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Next ${view}`} onPress={() => onStep(1)} className="h-12 w-12 items-center justify-center rounded-full active:bg-muted">
          <ChevronRight color="#000f47" size={22} />
        </Pressable>
        <Button variant="outline" onPress={onToday}>
          <Text>Today</Text>
        </Button>
        {canSwitch && (
          <View className="flex-row gap-1 rounded-full bg-muted p-1">
            {(['month', 'week'] as const).map((v) => (
              <Pressable
                key={v}
                accessibilityRole="button"
                accessibilityState={{ selected: view === v }}
                onPress={() => onView(v)}
                className={cn('h-10 justify-center rounded-full px-4', view === v && 'bg-card')}
              >
                <Text className="font-medium">{v === 'month' ? 'Month' : 'Week'}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
        {SHOWS.map((s) => (
          <Chip key={s.label} label={s.label} on={show === s.value} onPress={() => onShow(s.value)} />
        ))}
        <View className="mx-1 w-px bg-border" />
        {TYPES.map((t) => (
          <Chip key={t || 'any'} label={t || 'Any type'} on={type === t} onPress={() => onType(t)} />
        ))}
      </ScrollView>
    </View>
  )
}
