// Reschedule and Set dates (MB-19, web CP-60): an assessment's survey start, survey end
// and report due date, saved together through the web's Edit details route. Save dates
// is greyed until something changes. A bad date is named beside its field and nothing
// is sent (web RescheduleDialog.tsx). Shown by screens/Calendar inside its one sheet. Calls DateField.
import { useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { ApiError, errorText } from '@/lib/api'
import { formatDay, type CalendarItem } from '../calendar'
import { reschedule, type Dates } from '../api'
import { DateField } from './DateField'

type Field = keyof Dates

type Props = { item: CalendarItem; today: string; onClose(): void; onSaved(): void }

export function RescheduleSheet({ item, today, onClose, onSaved }: Props) {
  const saved: Dates = { start: item.start ?? '', end: item.end ?? '', due: item.due ?? '' }
  const [form, setForm] = useState(saved)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // An end on the start day is no end (the API sends it as ''), so it is no change either.
  const end = (d: Dates) => (d.end === d.start ? '' : d.end)
  const unchanged = form.start === saved.start && form.due === saved.due && end(form) === end(saved)
  const set = (key: Field) => (day: string) => {
    setForm((f) => ({ ...f, [key]: day }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }
  const before = `Pick a day on or after ${form.start && formatDay(form.start)}, the survey start.`

  async function save() {
    // 1. Check here first, so a wrong date never reaches the gateway.
    const found: Partial<Record<Field, string>> = {}
    if (form.end && !form.start) found.start = 'Add the survey start.'
    else if (form.end && form.end < form.start) found.end = before
    if (form.due && form.start && form.due < form.start) found.due = before
    setErrors(found)
    if (Object.keys(found).length) return
    // 2. Save. A refusal (403 not yours, 409 archived, 400 a bad date) keeps the sheet open.
    setBusy(true)
    setProblem(null)
    try {
      await reschedule(item.reference, item.type, form)
      onSaved()
    } catch (e) {
      const fields = e instanceof ApiError ? e.fields : {}
      setErrors({ start: fields.siteVisitDate, end: fields.siteVisitEndDate, due: fields.reportDueDate })
      // A named field says its own problem; the box only points at it.
      setProblem(Object.keys(fields).length ? 'Fix the dates marked below, then save again.' : errorText(e))
      setBusy(false)
    }
  }

  return (
    <SafeAreaView testID="reschedule-sheet" className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
          <Text className="flex-1 text-lg font-bold">{`Reschedule ${item.site}`}</Text>
          <Button variant="ghost" accessibilityLabel="Close" disabled={busy} onPress={onClose}>
            <Text>Close</Text>
          </Button>
        </View>
        <ScrollView contentContainerClassName="gap-4 p-4">
          {problem && (
            <View className="rounded-md bg-destructive/10 p-3">
              <Text className="font-semibold text-destructive">Dates not saved</Text>
              <Text className="text-destructive">{problem}</Text>
            </View>
          )}
          <DateField label="Survey start" value={form.start} fallback={today} error={errors.start} disabled={busy} onChange={set('start')} />
          <DateField label="Survey end" value={form.end} min={form.start || undefined} fallback={today} error={errors.end} disabled={busy} onChange={set('end')} />
          <DateField label="Report due" value={form.due} min={form.start || undefined} fallback={today} error={errors.due} disabled={busy} onChange={set('due')} />
        </ScrollView>
        <View className="flex-row gap-2 border-t border-border bg-card px-4 pb-2 pt-3">
          <Button variant="outline" className="flex-1" disabled={busy} onPress={onClose}>
            <Text>Cancel</Text>
          </Button>
          <Button className="flex-1" disabled={unchanged || busy} onPress={save}>
            {busy ? <ActivityIndicator color="#ffffff" /> : <Text>Save dates</Text>}
          </Button>
        </View>
    </SafeAreaView>
  )
}
