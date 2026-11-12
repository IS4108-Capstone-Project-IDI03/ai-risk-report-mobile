// The picker's Add location view (MB-02 AC10-AC12). Building, level and location,
// each with tap-to-fill chips (48px, for gloves) so the engineer rarely types a
// building or level twice. MB-02 AC13: an optional Pin where I am, from the phone's GPS.
// Used by screens/LocationPicker, which saves it.
import { MapPin } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Linking, Pressable, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { LEVEL_SUGGESTIONS, suggestions, type Location } from '../locations'
import { DENIED, pinHere, type Pinned } from '../position'

export type NewLocation = { building: string; floor: string; name: string; coordinates?: { lat: number; lng: number } | null }

type Props = {
  locations: Location[]
  onSave(details: NewLocation): Promise<void>
}

export function AddLocationForm({ locations, onSave }: Props) {
  const [building, setBuilding] = useState('')
  const [floor, setFloor] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | Error | null>(null)
  // The GPS pin: what was read, a read in progress, and why one didn't work.
  const [pin, setPin] = useState<Pinned | null>(null)
  const [pinning, setPinning] = useState(false)
  const [pinProblem, setPinProblem] = useState<string | null>(null)
  const hasBuilding = Boolean(building.trim())

  // Clearing the building clears the level too: only a location in a
  // building has a level (AC12), and the gateway refuses one without.
  function changeBuilding(value: string) {
    setBuilding(value)
    if (!value.trim()) setFloor('')
  }

  // Reads the phone's position once per tap (AC13, AC16). A refusal or no fix is said under
  // the button and never blocks Save: the pin is optional (AC15).
  async function pinWhereIAm() {
    if (pinning) return
    setPinning(true)
    setPinProblem(null)
    const result = await pinHere()
    if ('pinned' in result) setPin(result.pinned)
    else setPinProblem('denied' in result ? result.denied : result.failed)
    setPinning(false)
  }

  async function save() {
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onSave({ building, floor, name, coordinates: pin && { lat: pin.lat, lng: pin.lng } })
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      setBusy(false)
    }
  }

  // A field's own problem from the gateway's `fields` shows under that field.
  // Anything else shows above Save, so no problem goes unshown.
  const fields = error instanceof ApiError ? error.fields : {}
  const shownUnderField = ['building', 'floor', 'name', 'coordinates'].some((key) => fields[key])
  const general = error && !shownUnderField ? error.message : null

  return (
    <View className="gap-5">
      <Field
        label="Building"
        hint="Optional. Leave blank for a place outside any building."
        value={building}
        onChange={changeBuilding}
        chips={suggestions(locations.map((l) => l.building))}
        error={fields.building}
      />
      <Field
        label="Level"
        hint={hasBuilding ? 'Optional. Leave blank for the whole building.' : 'Add a building first.'}
        value={floor}
        onChange={setFloor}
        editable={hasBuilding}
        chips={hasBuilding ? suggestions(locations.map((l) => l.floor), LEVEL_SUGGESTIONS) : []}
        error={fields.floor}
      />
      {/* "Location", as on the web's form. The gateway's field is still `name`. */}
      <Field label="Location" value={name} onChange={setName} error={fields.name} onSubmit={save} />

      {/* Optional (the web's Coordinates field): the phone's position, read when tapped. */}
      <View className="gap-2">
        <Text className="font-medium">Position</Text>
        {pin ? (
          <View className="flex-row items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
            <View className="flex-1">
              <Text className="font-medium tabular-nums">{`${pin.lat}, ${pin.lng}`}</Text>
              {pin.accuracy != null && <Text className="text-sm text-muted-foreground">{`About ${Math.round(pin.accuracy)} m`}</Text>}
            </View>
            <Button variant="outline" accessibilityLabel="Clear pin" onPress={() => setPin(null)}>
              <Text>Clear</Text>
            </Button>
          </View>
        ) : (
          <Button variant="outline" accessibilityLabel="Pin where I am" disabled={pinning} onPress={pinWhereIAm}>
            {pinning ? <ActivityIndicator color="#000f47" /> : <MapPin color="#2c5488" size={18} />}
            <Text>{pinning ? 'Finding your position…' : 'Pin where I am'}</Text>
          </Button>
        )}
        {fields.coordinates ? (
          <Text className="text-sm text-destructive">{fields.coordinates}</Text>
        ) : pinProblem ? (
          <Text className="text-sm text-destructive">{pinProblem}</Text>
        ) : (
          <Text className="text-sm text-muted-foreground">Optional. Saves where this place is on site.</Text>
        )}
        {pinProblem === DENIED && (
          <Button variant="outline" accessibilityLabel="Open Settings" onPress={() => Linking.openSettings()}>
            <Text>Open Settings</Text>
          </Button>
        )}
      </View>

      {general && (
        <View className="rounded-md bg-destructive/10 p-3">
          <Text className="text-destructive">{general}</Text>
        </View>
      )}
      <Button
        size="lg"
        accessibilityLabel="Save location"
        accessibilityState={{ disabled: busy || !name.trim() }}
        disabled={busy || !name.trim()}
        onPress={save}
      >
        {busy ? <ActivityIndicator color="#ffffff" /> : <Text>Save location</Text>}
      </Button>
    </View>
  )
}

type FieldProps = {
  label: string
  hint?: string
  value: string
  onChange(value: string): void
  editable?: boolean
  chips?: string[]
  error?: string
  onSubmit?(): void
}

// One labelled input with its error and tap-to-fill chips underneath.
function Field({ label, hint, value, onChange, editable = true, chips = [], error, onSubmit }: FieldProps) {
  return (
    <View className="gap-2">
      <Text className={cn('font-medium', !editable && 'text-muted-foreground')}>{label}</Text>
      <Input
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={editable}
        autoCapitalize="words"
        returnKeyType={onSubmit ? 'done' : 'next'}
        onSubmitEditing={onSubmit}
        className={cn(error && 'border-destructive')}
      />
      {error ? (
        <Text className="text-sm text-destructive">{error}</Text>
      ) : (
        hint && <Text className="text-sm text-muted-foreground">{hint}</Text>
      )}
      {chips.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {chips.map((chip) => (
            <Pressable
              key={chip}
              accessibilityRole="button"
              accessibilityLabel={`Use ${chip}`}
              onPress={() => onChange(chip)}
              className={cn(
                'h-12 justify-center rounded-full border px-4 active:bg-muted',
                value === chip ? 'border-primary bg-secondary' : 'border-input bg-card',
              )}
            >
              <Text className={cn('text-sm', value === chip && 'font-medium text-secondary-foreground')}>
                {chip}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}
