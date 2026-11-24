// The four details a new site needs (each required, so each carries the star) (MB-21, web CP-23): name, address, jurisdiction (one of
// the web's eight, as chips) and facility type (one of the gateway's nine, as chips), and its optional Coordinates (AC13, the web's
// CP-26 field) with a map under it to place the pin by tap or drag (AC13a to AC13e, the web's click-on-a-map). Each shows the
// gateway's problem beside it. Called by screens/NewAssessment.
import { MapPin } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Linking, Pressable, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { FieldLabel } from '@/components/FieldLabel'
import type { NewSite } from '../api'
import { DENIED, pinHere } from '@/features/locations/position'
import { SiteMap } from '@/features/assessments/components/SiteMap'
import { FACILITY_TYPES, formatCoordinates, JURISDICTIONS, parseCoordinates, type FieldName } from '../format'

type Props = {
  site: NewSite
  // The Coordinates as typed (text, so a half-typed point is not lost).
  coordinates: string
  errors: Partial<Record<FieldName, string>>
  disabled: boolean
  onChange(next: NewSite): void
  onCoordinates(text: string): void
}

// `optional` leaves the star off; `hint` shows under the field while it has no problem.
function Field({ label, error, optional, hint, children }: { label: string; error?: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <View className="gap-1">
      <FieldLabel required={!optional}>{label}</FieldLabel>
      {children}
      {error ? <Text className="text-sm text-destructive">{error}</Text> : hint ? <Text className="text-sm text-muted-foreground">{hint}</Text> : null}
    </View>
  )
}

// Single-choice chips, 48pt high, the chosen one with a navy border.
function Chips({ options, value, disabled, onPick }: { options: { label: string; value: string }[]; value: string; disabled: boolean; onPick(value: string): void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityLabel={o.label}
          accessibilityState={{ selected: value === o.value }}
          disabled={disabled}
          onPress={() => onPick(o.value)}
          className={cn('h-12 justify-center rounded-md border px-3 active:opacity-60', value === o.value ? 'border-2 border-primary bg-secondary' : 'border-input bg-card')}
        >
          <Text className="text-sm font-semibold">{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function NewSiteFields({ site, coordinates, errors, disabled, onChange, onCoordinates }: Props) {
  const set = (patch: Partial<NewSite>) => onChange({ ...site, ...patch })
  // Pin where I am: the phone's GPS (the MB-02 helper) fills the Coordinates. When it is off or finds nothing it
  // says why here, and the form stays as it was: the point is optional, so Create still works.
  const [pinning, setPinning] = useState(false)
  const [pinProblem, setPinProblem] = useState<string | null>(null)
  async function pinWhereIAm() {
    setPinning(true)
    setPinProblem(null)
    const result = await pinHere()
    if ('pinned' in result) onCoordinates(formatCoordinates(result.pinned))
    else setPinProblem('denied' in result ? result.denied : result.failed)
    setPinning(false)
  }
  // The map reads and writes the Coordinates text, so the field and the pin can't disagree (AC13, decision 9).
  // A half-typed or wrong point shows no pin: Create still names it (MB-21 AC13).
  const point = parseCoordinates(coordinates)
  const place = (p: { lat: number; lng: number }) => {
    setPinProblem(null)
    onCoordinates(formatCoordinates(p))
  }
  return (
    <View className="gap-4 rounded-md border border-border bg-card p-4">
      <Field label="Site name" error={errors.name}>
        <Input accessibilityLabel="Site name" value={site.name} editable={!disabled} onChangeText={(name) => set({ name })} />
      </Field>
      <Field label="Address" error={errors.address}>
        <Input accessibilityLabel="Address" value={site.address} editable={!disabled} onChangeText={(address) => set({ address })} />
      </Field>
      <Field label="Coordinates" optional error={errors.coordinates ?? pinProblem ?? undefined} hint="Optional. For example 1.2966, 103.8520.">
        <Input
          accessibilityLabel="Coordinates"
          value={coordinates}
          editable={!disabled}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          onChangeText={(text) => {
            setPinProblem(null)
            onCoordinates(text)
          }}
        />
        <Button variant="outline" accessibilityLabel="Pin where I am" disabled={disabled || pinning} onPress={pinWhereIAm}>
          {pinning ? <ActivityIndicator color="#000f47" /> : <MapPin color="#2c5488" size={18} />}
          <Text>{pinning ? 'Finding your position…' : 'Pin where I am'}</Text>
        </Button>
        {pinProblem === DENIED && (
          <Button variant="outline" accessibilityLabel="Open Settings" onPress={() => Linking.openSettings()}>
            <Text>Open Settings</Text>
          </Button>
        )}
        {/* A fixed 280pt strip, not full height, so a one-finger drag outside it still scrolls the form (AC13e). */}
        <View className="overflow-hidden rounded-md border border-input">
          <SiteMap
            pins={point ? [{ row: { key: 'site', name: 'Site', point, block: false }, label: 'S' }] : []}
            selected={null}
            canMove={!disabled}
            focus={null}
            draft={null}
            onSelect={() => {}}
            onPlace={(p) => !disabled && place(p)}
            onMove={(_, p) => place(p)}
          />
        </View>
        <Text className="text-sm text-muted-foreground">Tap the map to place the pin.</Text>
      </Field>
      <Field label="Jurisdiction" error={errors.jurisdiction}>
        <Chips options={JURISDICTIONS} value={site.jurisdiction} disabled={disabled} onPick={(jurisdiction) => set({ jurisdiction })} />
      </Field>
      <Field label="Facility type" error={errors.facilityType}>
        <Chips options={FACILITY_TYPES.map((t) => ({ label: t, value: t }))} value={site.facilityType} disabled={disabled} onPick={(facilityType) => set({ facilityType })} />
      </Field>
    </View>
  )
}
