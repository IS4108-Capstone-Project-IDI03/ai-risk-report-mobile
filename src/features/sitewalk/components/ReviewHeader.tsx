// The top of the review (MB-16 AC13, AC24, AC25): the walk's name with a Rename pencil, how its
// autosave is going, and what is left: "N to fix" (a button that opens the first observation that
// needs something) or "Ready to add". Used by screens/WalkReview.
import { Pencil } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SaveState } from '../useProposal'

const SAVED: Record<SaveState, string> = { saved: 'All changes saved', saving: 'Saving…', unsaved: 'Unsaved changes', failed: "Couldn't save. Your changes are still here." }

type Props = {
  name: string
  saveState: SaveState
  total: number
  left: number
  onFix(): void
  // Saves again, after a failed autosave: nothing else would, until the next edit.
  onRetry(): void
  // Throws the gateway's reason when the name is refused.
  onRename(name: string): Promise<void>
}

export function ReviewHeader({ name, saveState, total, left, onFix, onRetry, onRename }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  async function save() {
    if (!draft?.trim()) return
    try {
      await onRename(draft.trim())
      setDraft(null)
      setProblem(null)
    } catch (e) {
      setProblem(errorText(e))
    }
  }

  return (
    <View className="gap-1">
      {draft === null ? (
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-xl font-semibold">{name}</Text>
          <Button variant="outline" accessibilityLabel="Rename walk" onPress={() => setDraft(name)}>
            <Pencil color="#1a1f26" size={16} />
            <Text>Rename</Text>
          </Button>
        </View>
      ) : (
        <View className="gap-2">
          <Input accessibilityLabel="Walk name" value={draft} onChangeText={setDraft} maxLength={100} autoFocus />
          {problem && <Text className="text-sm text-destructive">{problem}</Text>}
          <View className="flex-row gap-2">
            <Button accessibilityLabel="Save name" disabled={!draft.trim()} onPress={save} className="flex-1"><Text>Save</Text></Button>
            <Button variant="outline" accessibilityLabel="Cancel rename" onPress={() => setDraft(null)} className="flex-1"><Text>Cancel</Text></Button>
          </View>
        </View>
      )}
      <Text className="text-sm text-muted-foreground">{SAVED[saveState]}</Text>
      {saveState === 'failed' && (
        <Button variant="outline" accessibilityLabel="Retry saving" onPress={onRetry} className="self-start">
          <Text>Retry saving</Text>
        </Button>
      )}
      {total === 0 ? (
        <Text className="text-sm text-muted-foreground">No observations.</Text>
      ) : left ? (
        // A button: the count leads straight to the first one to fix.
        <Pressable accessibilityRole="button" accessibilityLabel={`${left} to fix. Open the first`} onPress={onFix} className="min-h-12 justify-center">
          <Text className={cn('text-sm font-medium text-destructive')}>{`${left} to fix before you can add them.`}</Text>
        </Pressable>
      ) : (
        <Text className="text-sm text-muted-foreground">Ready to add.</Text>
      )}
    </View>
  )
}
