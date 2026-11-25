// One row of a MarshBot card (MB-20): an icon tile, the title and one status line, and at the end a button, a status
// or a tick. The whole row opens its link, as on the web. A link-only ending (`open`) is a short "Open" pill: the web
// draws a round arrow and keeps the gateway's long label ("Open in Observations") as a hover tooltip, which a phone
// has not, so here it is the button's spoken name and not text that squeezes the title. A button or link that points to
// Generate, Review or Export is greyed and says so (the phone can't do them). A button with an action (Try Again) opens
// its observation, where the phone's own Try again is: one paid call per tap, chosen there, never from a chat button.
// Called by TasksCard and RowsCard.
import { ChevronRight, CircleCheck, Loader } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { GatewayIcon } from '@/features/overview/icons'
import { targetOf, WEB_ONLY, type Target } from '@/features/overview/format'
import { ROW_TONE } from '../format'
import type { CardRow } from '../types'

type Props = { row: CardRow; onGo(target: Target): void }

export function Row({ row, onGo }: Props) {
  const tone = ROW_TONE[row.tone] ?? ROW_TONE.neutral
  const { end } = row
  // Only a button or a link points anywhere; a status or a tick is just drawn.
  const label = end.type === 'button' || end.type === 'open' ? end.label : null
  const target = end.type === 'button' || end.type === 'open' ? targetOf(end.link, row.id) : null
  const web = target?.kind === 'web'
  const go = target && !web ? () => onGo(target) : undefined
  return (
    // `accessible={false}`: the row is only a bigger tap area; the end button is the one a screen reader finds.
    <Pressable accessible={false} disabled={!go} onPress={go} className="min-h-[60px] flex-row items-center gap-3 border-t border-border py-2 active:bg-muted">
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: tone.bg }}>
        <GatewayIcon name={row.icon} color={tone.fg} size={18} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-semibold">{row.title}</Text>
        {row.detail && <Text className={row.bad ? 'text-sm font-medium text-destructive' : 'text-sm text-muted-foreground'}>{row.detail}</Text>}
        {web && <Text className="text-sm text-muted-foreground">{WEB_ONLY}</Text>}
      </View>
      {target && label && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          disabled={web}
          onPress={go}
          className={`min-h-12 shrink-0 flex-row items-center justify-center gap-0.5 rounded-full bg-secondary pl-4 pr-3 active:opacity-70 ${web ? 'opacity-50' : ''}`}
        >
          <Text className="font-semibold text-primary">{end.type === 'open' ? 'Open' : label}</Text>
          {end.type === 'open' && <ChevronRight color="#000f47" size={18} />}
        </Pressable>
      )}
      {end.type === 'status' && (
        <View className="shrink-0 flex-row items-center gap-1.5">
          {end.status === 'done' ? <CircleCheck color="#2f7049" size={18} /> : <Loader color="#545e6b" size={18} />}
          <Text className="text-sm text-muted-foreground">{end.label}</Text>
        </View>
      )}
      {end.type === 'tick' && <CircleCheck color="#2f7049" size={20} />}
    </Pressable>
  )
}
