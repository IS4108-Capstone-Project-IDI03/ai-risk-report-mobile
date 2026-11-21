// The four details a new site needs (each required, so each carries the star) (MB-21, web CP-23): name, address, jurisdiction (two letters,
// e.g. SG) and facility type (one of the gateway's nine, as chips). Each shows the gateway's
// problem beside it. Called by screens/NewAssessment.
import { Pressable, View } from 'react-native'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { FieldLabel } from './FieldLabel'
import type { NewSite } from '../api'
import { FACILITY_TYPES, type FieldName } from '../format'

type Props = { site: NewSite; errors: Partial<Record<FieldName, string>>; disabled: boolean; onChange(next: NewSite): void }

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View className="gap-1">
      <FieldLabel required>{label}</FieldLabel>
      {children}
      {error && <Text className="text-sm text-destructive">{error}</Text>}
    </View>
  )
}

export function NewSiteFields({ site, errors, disabled, onChange }: Props) {
  const set = (patch: Partial<NewSite>) => onChange({ ...site, ...patch })
  return (
    <View className="gap-4 rounded-md border border-border bg-card p-4">
      <Field label="Site name" error={errors.name}>
        <Input accessibilityLabel="Site name" value={site.name} editable={!disabled} onChangeText={(name) => set({ name })} />
      </Field>
      <Field label="Address" error={errors.address}>
        <Input accessibilityLabel="Address" value={site.address} editable={!disabled} onChangeText={(address) => set({ address })} />
      </Field>
      <Field label="Jurisdiction (two letters, for example SG)" error={errors.jurisdiction}>
        <Input
          accessibilityLabel="Jurisdiction"
          value={site.jurisdiction}
          editable={!disabled}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={2}
          onChangeText={(jurisdiction) => set({ jurisdiction: jurisdiction.toUpperCase() })}
        />
      </Field>
      <Field label="Facility type" error={errors.facilityType}>
        <View className="flex-row flex-wrap gap-2">
          {FACILITY_TYPES.map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityLabel={t}
              accessibilityState={{ selected: site.facilityType === t }}
              disabled={disabled}
              onPress={() => set({ facilityType: t })}
              className={cn('h-12 justify-center rounded-md border px-3 active:opacity-60', site.facilityType === t ? 'border-2 border-primary bg-secondary' : 'border-input bg-card')}
            >
              <Text className="text-sm font-semibold">{t}</Text>
            </Pressable>
          ))}
        </View>
      </Field>
    </View>
  )
}
