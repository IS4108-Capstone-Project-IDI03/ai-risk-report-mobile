// One date in the Reschedule sheet (MB-19): its label, the day (or "Not set"), and Clear
// for the dates that may be empty. Tapping the day opens the phone's own date picker
// (iOS: a calendar below the field; Android: its dialog), which closes on a pick.
// Called by RescheduleSheet. Days are YYYY-MM-DD, as the gateway sends them.
import DateTimePicker from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { FieldLabel } from '@/components/FieldLabel'
import { Text } from '@/components/ui/text'
import { formatDay, todayIso } from '../calendar'

// The picker works in Date objects. Noon, so a clock change can't move the day.
const toDate = (day: string) => new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), 12)

type Props = {
  label: string
  value: string
  // The earliest day offered (the survey start), and the day to open on when empty.
  min?: string
  fallback: string
  error?: string
  // A required date (New assessment's survey start): the web's red star, and no Clear.
  required?: boolean
  disabled: boolean
  onChange(day: string): void
}

export function DateField({ label, value, min, fallback, error, required, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <View className="gap-1">
      <FieldLabel required={required}>{label}</FieldLabel>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: value ? formatDay(value) : 'Not set' }}
          disabled={disabled}
          onPress={() => setOpen((o) => !o)}
          className="h-12 flex-1 justify-center rounded-[10px] border border-input bg-background px-3 active:bg-muted active:opacity-70"
        >
          <Text className={value ? '' : 'text-muted-foreground'}>{value ? formatDay(value) : 'Not set'}</Text>
        </Pressable>
        {value !== '' && !required && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            disabled={disabled}
            onPress={() => {
              setOpen(false)
              onChange('')
            }}
            className="h-12 justify-center px-2"
          >
            <Text className="font-semibold text-primary">Clear</Text>
          </Pressable>
        )}
      </View>
      {error && <Text className="text-sm text-destructive">{error}</Text>}
      {open && (
        <DateTimePicker
          testID="date-picker"
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          // Marsh navy for the picked day and the arrows (tailwind.config.js primary), not iOS blue.
          accentColor="#000f47"
          // The native calendar keeps its own width (about 320pt), whatever width it is given, so
          // it is centred here: the spare space splits left and right instead of all sitting on the right.
          style={{ alignSelf: 'center' }}
          value={toDate(min && (value || fallback) < min ? min : value || fallback)}
          minimumDate={min ? toDate(min) : undefined}
          onValueChange={(_, d) => {
            setOpen(false)
            onChange(todayIso(d))
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </View>
  )
}
