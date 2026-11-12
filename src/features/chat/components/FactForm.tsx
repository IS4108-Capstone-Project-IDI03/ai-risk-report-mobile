// The box for one fact (MB-15 AC3, AC5, AC6): the text, "N of 200 characters", and its buttons.
// Add uses it with one button; editing a fact uses it with Save, Cancel and Delete. A refusal shows
// under the box and what was typed stays. Used by screens/Preferences and FactRow.
import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { cn } from '@/lib/utils'

type Props = {
  initial?: string
  max: number
  // The names a screen reader and the tests find them by.
  boxLabel: string
  submitLabel: string
  submitText: string
  onSubmit(text: string): Promise<void>
  onCancel?: () => void
  onDelete?: () => void
}

export function FactForm({ initial = '', max, boxLabel, submitLabel, submitText, onSubmit, onCancel, onDelete }: Props) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy || !text.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(text)
      // An add clears the box; an edit's row closes this form.
      setText(initial)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="gap-2">
      <Input
        accessibilityLabel={boxLabel}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={max}
        textAlignVertical="top"
        className={cn('h-24 py-3', error && 'border-destructive')}
      />
      <Text className="text-sm text-muted-foreground">{`${text.length} of ${max} characters`}</Text>
      {error && <Text className="text-sm text-destructive">{error}</Text>}
      <View className="flex-row items-center gap-2">
        <Button accessibilityLabel={submitLabel} disabled={busy || !text.trim()} onPress={submit}>
          {busy ? <ActivityIndicator color="#ffffff" /> : <Text>{submitText}</Text>}
        </Button>
        {onCancel && (
          <Button variant="outline" accessibilityLabel="Cancel edit" disabled={busy} onPress={onCancel}>
            <Text>Cancel</Text>
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" accessibilityLabel="Delete fact" disabled={busy} onPress={onDelete} className="ml-auto">
            <Text className="text-destructive">Delete</Text>
          </Button>
        )}
      </View>
    </View>
  )
}
