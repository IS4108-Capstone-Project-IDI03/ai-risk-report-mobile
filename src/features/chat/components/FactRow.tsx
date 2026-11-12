// One saved fact (MB-15 AC2, AC5): its text and the date it was added; tap it to edit. While it is
// being edited it is the fact's form instead, with Save, Cancel and Delete. Used by screens/Preferences.
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { formatDate } from '@/features/assessments/format'
import { cn } from '@/lib/utils'
import type { Fact } from '../api'
import { FactForm } from './FactForm'

type Props = {
  fact: Fact
  max: number
  editing: boolean
  // False with no signal, or while memory is off: shown, not changed.
  canEdit: boolean
  dimmed: boolean
  onEdit(): void
  onCancel(): void
  onSave(text: string): Promise<void>
  onDelete(): void
}

const short = (text: string) => (text.length > 40 ? `${text.slice(0, 40)}…` : text)

export function FactRow({ fact, max, editing, canEdit, dimmed, onEdit, onCancel, onSave, onDelete }: Props) {
  if (editing)
    return (
      <View className="rounded-lg border border-primary bg-card p-3">
        <FactForm
          initial={fact.text}
          max={max}
          boxLabel="Edit fact"
          submitLabel="Save fact"
          submitText="Save"
          onSubmit={onSave}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      </View>
    )
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit fact: ${short(fact.text)}`}
      disabled={!canEdit}
      onPress={onEdit}
      className={cn('min-h-14 justify-center gap-0.5 rounded-lg border border-border bg-card px-3 py-3', dimmed && 'opacity-50')}
    >
      <Text className="text-base">{fact.text}</Text>
      <Text className="text-sm text-muted-foreground">{`Added ${formatDate(fact.createdAt.slice(0, 10))}`}</Text>
    </Pressable>
  )
}
