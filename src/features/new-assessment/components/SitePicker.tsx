// Choosing the client's site (MB-21, web CP-17 AC4): its listed sites as single-choice rows
// (name, address and the latest visit when there is one), and Add a new site at the end. The
// chosen row has a navy border and a tick. Called by screens/NewAssessment.
import { Check, Plus } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { formatDate } from '@/features/assessments/format'
import type { ClientSite } from '../api'

// The picked row: a listed site's id, or 'new'.
type Props = { sites: ClientSite[]; chosen: string | null; onChoose(id: string): void }

export const NEW_SITE = 'new'

function Row({ on, label, onPress, children }: { on: boolean; label: string; onPress(): void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={cn('min-h-[60px] flex-row items-center gap-3 rounded-md border px-4 py-2 active:opacity-60', on ? 'border-2 border-primary bg-secondary' : 'border-border bg-card')}
    >
      <View className="flex-1">{children}</View>
      {on && <Check color="#000f47" size={18} />}
    </Pressable>
  )
}

export function SitePicker({ sites, chosen, onChoose }: Props) {
  return (
    <View className="gap-2">
      {sites.map((s) => (
        <Row key={s.id} on={chosen === s.id} label={`${s.name}${s.address ? `, ${s.address}` : ''}`} onPress={() => onChoose(s.id)}>
          <Text className="font-semibold">{s.name}</Text>
          {s.address ? <Text numberOfLines={1} className="text-sm text-muted-foreground">{s.address}</Text> : null}
          <Text className="text-sm text-muted-foreground">{s.latest ? `Last visit ${formatDate(s.latest.siteVisitDate)}` : 'No visit yet'}</Text>
        </Row>
      ))}
      <Row on={chosen === NEW_SITE} label="Add a new site" onPress={() => onChoose(NEW_SITE)}>
        <View className="flex-row items-center gap-2">
          <Plus color="#2c5488" size={18} />
          <Text className="font-semibold text-primary">Add a new site</Text>
        </View>
      </Row>
    </View>
  )
}
