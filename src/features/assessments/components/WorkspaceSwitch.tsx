// The workspace's switch, "Observations | Checklist" (MB-05 AC1), with the checklist's
// progress on it ("12/48") once there is one. Used by screens/Workspace, which keeps the
// location bar and New observation on screen under either side, so an engineer captures
// and ticks without leaving.
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

export type Side = 'observations' | 'checklist'

type Props = { side: Side; onChange(side: Side): void; progress: { done: number; total: number } | null }

export function WorkspaceSwitch({ side, onChange, progress }: Props) {
  return (
    <View className="h-12 flex-row rounded-full bg-muted p-1">
      <Segment label="Observations" on={side === 'observations'} onPress={() => onChange('observations')} />
      <Segment label="Checklist" on={side === 'checklist'} onPress={() => onChange('checklist')} extra={progress && `${progress.done}/${progress.total}`} />
    </View>
  )
}

function Segment({ label, on, onPress, extra }: { label: string; on: boolean; onPress(): void; extra?: string | null }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={cn('flex-1 flex-row items-center justify-center gap-2 rounded-full', on && 'bg-card shadow-sm shadow-black/10')}
    >
      <Text className={cn('font-semibold', on ? 'text-foreground' : 'text-muted-foreground')}>{label}</Text>
      {extra ? <Text className="tabular-nums text-sm text-muted-foreground">{extra}</Text> : null}
    </Pressable>
  )
}
