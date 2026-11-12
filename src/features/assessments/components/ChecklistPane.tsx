// The checklist's side of the workspace on a wide iPad (MB-05 AC20, AC21): a 380pt pane (440pt on the widest)
// beside the observations with a Collapse button, which shrinks it to a slim bar showing
// the progress (tap it to open again) so the observations can have the width. Used by
// screens/Workspace, which decides when the pane is wide enough.
import { ChevronsLeft, ChevronsRight } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

type Props = {
  collapsed: boolean
  // True on the widest panes, where the checklist gets 440pt instead of 380pt.
  wide: boolean
  onToggle(): void
  // "12/48", once there is a checklist.
  progress: string | null
  children: ReactNode
}

export function ChecklistPane({ wide, collapsed, onToggle, progress, children }: Props) {
  if (collapsed) {
    return (
      <View className="w-20 items-center gap-1 border-l border-border bg-card py-3">
        <Button variant="ghost" accessibilityLabel="Expand checklist" onPress={onToggle} className="h-16 w-16 flex-col gap-0">
          <ChevronsLeft color="#1a1f26" size={22} />
          {progress && <Text className="tabular-nums text-xs text-muted-foreground">{progress}</Text>}
        </Button>
      </View>
    )
  }
  return (
    <View testID="checklist-pane" className={cn('border-l border-border bg-card', wide ? 'w-[440px]' : 'w-[380px]')}>
      <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-1">
        <Text className="font-semibold">{progress ? `Checklist · ${progress}` : 'Checklist'}</Text>
        <Button variant="ghost" accessibilityLabel="Collapse checklist" onPress={onToggle}>
          <ChevronsRight color="#1a1f26" size={22} />
        </Button>
      </View>
      {children}
    </View>
  )
}
