// One typed note in the recorder's list (MB-16 AC34): the text, whether it is sent, and Edit and Remove
// (words beside the icons, for a phone). Saving blank removes it. Used by screens/WalkRecording, which
// keeps the change on the phone first (pending.ts putNote).
import { Pencil, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'

type Props = { text: string; waiting: boolean; onSave(text: string): void; onRemove(): void }

export function NoteItem({ text, waiting, onSave, onRemove }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  if (draft !== null)
    return (
      <View className="gap-2 rounded-md border border-primary bg-card p-3">
        <Input accessibilityLabel="Edit note" value={draft} onChangeText={setDraft} multiline maxLength={2000} textAlignVertical="top" className="h-20 py-3" autoFocus />
        <View className="flex-row gap-2">
          <Button accessibilityLabel="Save note" disabled={!draft.trim()} onPress={() => { onSave(draft.trim()); setDraft(null) }} className="flex-1"><Text>Save note</Text></Button>
          <Button variant="outline" accessibilityLabel="Cancel edit" onPress={() => setDraft(null)} className="flex-1"><Text>Cancel</Text></Button>
        </View>
      </View>
    )
  return (
    <View className="gap-2 rounded-md border border-border bg-card p-3">
      <View className="flex-row justify-between gap-3">
        <Text className="flex-1">{text}</Text>
        <Text className="text-muted-foreground">{waiting ? 'Waiting to upload' : 'Sent'}</Text>
      </View>
      <View className="flex-row gap-2">
        <Button variant="outline" accessibilityLabel={`Edit note: ${text}`} onPress={() => setDraft(text)} className="flex-1">
          <Pencil color="#1a1f26" size={16} />
          <Text>Edit</Text>
        </Button>
        <Button variant="outline" accessibilityLabel={`Remove note: ${text}`} onPress={onRemove} className="flex-1">
          <Trash2 color="#ad2e2d" size={16} />
          <Text className="text-destructive">Remove</Text>
        </Button>
      </View>
    </View>
  )
}
