// "Another visit" asks for a day (MB-20): the phone's own date picker (the calendar's DateField), then Confirm sends
// the reply with it; Cancel sends nothing. Confirm is greyed until a day is picked, so a reply never goes without its
// date. Called by screens/Assistant.
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { todayIso } from '@/features/calendar/calendar'
import { DateField } from '@/features/calendar/components/DateField'

type Props = { sending: boolean; onConfirm(day: string): void; onCancel(): void }

export function DateStep({ sending, onConfirm, onCancel }: Props) {
  const [day, setDay] = useState('')
  const none = !day || sending
  return (
    <View className="gap-3">
      <DateField label="Day of your next visit" value={day} min={todayIso()} fallback={todayIso()} disabled={sending} onChange={setDay} />
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm"
          disabled={none}
          onPress={() => onConfirm(day)}
          className={`min-h-12 flex-1 items-center justify-center rounded-full bg-primary px-4 active:opacity-80 ${none ? 'opacity-50' : ''}`}
        >
          <Text className="font-semibold text-primary-foreground">Confirm</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" disabled={sending} onPress={onCancel} className="min-h-12 items-center justify-center rounded-full border border-primary px-4 active:bg-secondary">
          <Text className="font-semibold text-primary">Cancel</Text>
        </Pressable>
      </View>
    </View>
  )
}
