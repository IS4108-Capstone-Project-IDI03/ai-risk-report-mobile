// New assessment (MB-21, web CP-01 and CP-23): start an assessment from the phone for a client
// and one of its sites (or a new site), with a visit type and optional dates. Opened from Home's
// header button (src/app/new-assessment.tsx). Calls api.ts (the one POST), then opens the new
// assessment's workspace. Online only: a new assessment's reference comes from the gateway.
import { router } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { ApiError, errorText } from '@/lib/api'
import { formatDay, todayIso } from '@/features/calendar/calendar'
import { DateField } from '@/features/calendar/components/DateField'
import { easeLayout } from '@/lib/motion'
import { useOffline } from '@/features/offline/provider'
import { createAssessment, type Client, type NewSite, type VisitType } from '../api'
import { ClientPicker } from '../components/ClientPicker'
import { NewSiteFields } from '../components/NewSiteFields'
import { NEW_SITE, SitePicker } from '../components/SitePicker'
import { FieldLabel } from '../components/FieldLabel'
import { TypeChips } from '../components/TypeChips'
import { mapFields, OFFLINE_CREATE, type FieldName } from '../format'
import { useClients, useClientSites } from '../useLists'

type Errors = Partial<Record<FieldName, string>>
const BLANK_SITE: NewSite = { name: '', address: '', jurisdiction: 'SG', facilityType: '' }

function Section({ title, required, children }: { title: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <FieldLabel header required={required}>{title}</FieldLabel>
      {children}
    </View>
  )
}

export default function NewAssessment() {
  const { offline } = useOffline()
  const today = todayIso()
  const clients = useClients()
  const [client, setClient] = useState<Client | null>(null)
  const [picking, setPicking] = useState(false)
  const sites = useClientSites(client?.id ?? null)
  // A listed site's id, or NEW_SITE; with the new site's own four details.
  const [choice, setChoice] = useState<string | null>(null)
  const [site, setSite] = useState<NewSite>(BLANK_SITE)
  const [type, setType] = useState<VisitType | null>(null)
  const [dates, setDates] = useState({ start: '', end: '', due: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Set at once on a press (state is a render late), so a quick second tap sends nothing: a second
  // request would make a second assessment.
  const sending = useRef(false)

  const listed = sites.items?.find((s) => s.id === choice)
  // A new site, or a listed one with no visit yet, starts with a First survey (gateway rule).
  const firstOnly = choice === NEW_SITE || (!!listed && !listed.latest)
  const newSiteReady = !!site.name.trim() && !!site.address.trim() && site.jurisdiction.length === 2 && !!site.facilityType
  const ready = !!client && !!choice && !!type && (choice !== NEW_SITE || newSiteReady)

  const clear = (key: FieldName) => setErrors((e) => ({ ...e, [key]: undefined }))
  function chooseSite(id: string) {
    // The visit type and dates (and a new site's fields) slide in rather than jump.
    easeLayout()
    setChoice(id)
    clear('site')
    const only = id === NEW_SITE || !sites.items?.find((s) => s.id === id)?.latest
    if (only) setType('First survey')
  }
  const setDate = (key: 'start' | 'end' | 'due') => (day: string) => {
    setDates((d) => ({ ...d, [key]: day }))
    clear(key)
  }
  const before = `Pick a day on or after ${dates.start && formatDay(dates.start)}, the survey start.`

  async function create() {
    if (sending.current || !ready || !client || !type || !choice) return
    // 1. Check the dates here, so a wrong one never reaches the gateway.
    const found: Errors = {}
    if (dates.end && !dates.start) found.start = 'Add the survey start.'
    else if (dates.end && dates.end < dates.start) found.end = before
    if (dates.due && dates.start && dates.due < dates.start) found.due = before
    setErrors(found)
    if (Object.keys(found).length) return
    // 2. Send. A refusal keeps the form open and filled in, with each problem beside its field.
    sending.current = true
    setBusy(true)
    setProblem(null)
    try {
      const made = await createAssessment({
        clientId: client.id,
        site: choice === NEW_SITE ? { ...site, name: site.name.trim(), address: site.address.trim() } : { id: choice },
        visitType: type,
        ...dates,
      })
      // 3. Open it (web CP-01 AC6). Replace, so Back goes to Home, not to this form.
      router.replace({ pathname: '/assessment/[reference]', params: { reference: made.assessments[0].reference } })
    } catch (e) {
      const { mine, unknown } = mapFields(e instanceof ApiError ? e.fields : {})
      setErrors(mine)
      setProblem(Object.keys(mine).length && !unknown ? 'Fix the fields marked below, then create again.' : errorText(e))
      sending.current = false
      setBusy(false)
    }
  }

  // Choosing a client takes the form's place (not a pop-up: see ClientPicker).
  if (picking && clients.items)
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <ClientPicker
          clients={clients.items}
          onClose={() => setPicking(false)}
          onPick={(c) => {
            setPicking(false)
            if (c.id === client?.id) return
            easeLayout()
            // Another client: its own sites, so what was chosen of the last one goes.
            setClient(c)
            setChoice(null)
            setType(null)
            setErrors({})
          }}
        />
      </SafeAreaView>
    )

  return (
    <SafeAreaView testID="new-assessment" edges={['bottom']} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 p-4" keyboardShouldPersistTaps="handled">
        <Text className="text-sm text-muted-foreground">Fields marked * are required.</Text>
        {problem && (
          <View className="rounded-md bg-destructive/10 p-3">
            <Text className="font-semibold text-destructive">Assessment not created</Text>
            <Text className="text-destructive">{problem}</Text>
          </View>
        )}
        <Section title="Client" required>
          {clients.error ? (
            <Text className="text-destructive">{clients.error}</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={client ? `Client, ${client.name}. Change` : 'Choose a client'}
              disabled={!clients.items || busy}
              onPress={() => setPicking(true)}
              className="h-12 flex-row items-center justify-between rounded-[10px] border border-input bg-background px-3 active:bg-muted active:opacity-70"
            >
              <Text className={client ? '' : 'text-muted-foreground'}>{client ? client.name : clients.items ? 'Choose a client' : 'Loading clients…'}</Text>
              <ChevronRight color="#545e6b" size={18} />
            </Pressable>
          )}
          {errors.client && <Text className="text-sm text-destructive">{errors.client}</Text>}
        </Section>

        {client && (
          <Section title="Site" required>
            {sites.error ? (
              <Text className="text-destructive">{sites.error}</Text>
            ) : !sites.items ? (
              <Text className="text-muted-foreground">Loading sites…</Text>
            ) : (
              <SitePicker sites={sites.items} chosen={choice} onChoose={chooseSite} />
            )}
            {errors.site && <Text className="text-sm text-destructive">{errors.site}</Text>}
            {choice === NEW_SITE && <NewSiteFields site={site} errors={errors} disabled={busy} onChange={setSite} />}
          </Section>
        )}

        {choice && (
          <>
            <Section title="Visit type" required>
              <TypeChips value={type} firstOnly={firstOnly} error={errors.visitType} onChange={(t) => { setType(t); clear('visitType') }} />
            </Section>
            <Section title="Dates">
              <DateField label="Survey start" value={dates.start} fallback={today} error={errors.start} disabled={busy} onChange={setDate('start')} />
              <DateField label="Survey end" value={dates.end} min={dates.start || undefined} fallback={today} error={errors.end} disabled={busy} onChange={setDate('end')} />
              <DateField label="Report due" value={dates.due} min={dates.start || undefined} fallback={today} error={errors.due} disabled={busy} onChange={setDate('due')} />
            </Section>
          </>
        )}
      </ScrollView>
      <View className="gap-2 border-t border-border bg-card px-4 pb-2 pt-3">
        {offline && <Text className="text-sm text-muted-foreground">{OFFLINE_CREATE}</Text>}
        <View className="flex-row gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onPress={() => router.back()}>
            <Text>Cancel</Text>
          </Button>
          <Button className="flex-[1.6]" disabled={!ready || busy || offline} onPress={create}>
            {busy ? <ActivityIndicator color="#ffffff" /> : <Text>Create assessment</Text>}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  )
}
