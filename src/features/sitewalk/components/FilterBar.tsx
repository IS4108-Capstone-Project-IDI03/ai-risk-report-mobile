// The review's filters (MB-16 AC23): Category, Severity, Type and Status, each a chip that opens its
// choices, plus Clear filters and "Showing N of M". Same four as the web's Observations tab. Used by
// WalkReview; the matching is proposal.ts matchesFilters.
import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { COPE } from '@/features/capture/draft'
import { SEVERITY } from '@/features/observations/format'
import { filtersSet, NO_FILTERS, STATUSES, TYPES, UNCATEGORISED, type Filters } from '../proposal'
import { Choice } from './Choice'
import { Sheet } from './Sheet'

const MENUS: { key: keyof Filters; name: string; all: string; choices: { value: string; label: string }[] }[] = [
  { key: 'cat', name: 'Category', all: 'All categories', choices: [...COPE, UNCATEGORISED].map((c) => ({ value: c, label: c })) },
  { key: 'sev', name: 'Severity', all: 'All severities', choices: Object.keys(SEVERITY).map((s) => ({ value: s, label: SEVERITY[s as keyof typeof SEVERITY].label })) },
  { key: 'type', name: 'Type', all: 'All types', choices: TYPES.map((t) => ({ value: t, label: t })) },
  { key: 'status', name: 'Status', all: 'All statuses', choices: STATUSES.map((s) => ({ value: s, label: s })) },
]

type Props = { filters: Filters; onChange(f: Filters): void; shown: number; total: number }

export function FilterBar({ filters, onChange, shown, total }: Props) {
  const [open, setOpen] = useState<(typeof MENUS)[number] | null>(null)
  const label = (m: (typeof MENUS)[number]) => m.choices.find((c) => c.value === filters[m.key])?.label ?? m.name
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {MENUS.map((m) => (
          <Button key={m.key} variant={filters[m.key] ? 'secondary' : 'outline'} accessibilityLabel={`Filter by ${m.name.toLowerCase()}`} onPress={() => setOpen(m)}>
            <Text>{label(m)}</Text>
          </Button>
        ))}
        {filtersSet(filters) > 0 && (
          <Button variant="ghost" accessibilityLabel="Clear filters" onPress={() => onChange(NO_FILTERS)}>
            <Text className="text-primary">Clear filters</Text>
          </Button>
        )}
      </View>
      {filtersSet(filters) > 0 && <Text className="text-sm text-muted-foreground">{`Showing ${shown} of ${total}`}</Text>}
      {open && (
        <Sheet title={open.name} testID="filter-sheet" onClose={() => setOpen(null)}>
          {[{ value: '', label: open.all }, ...open.choices].map((c) => (
            <Choice
              key={c.value}
              label={c.label}
              on={filters[open.key] === c.value}
              onPress={() => {
                onChange({ ...filters, [open.key]: c.value })
                setOpen(null)
              }}
            />
          ))}
        </Sheet>
      )}
    </View>
  )
}
