// What the AI's suggestion looks like on an observation's screen (MB-23 AC1-AC3, AC10): for the category
// and the severity, "Suggesting" while it reads, "Not sure" with Confirm and Change, or a red prompt to
// choose; and one "Suggestion failed" line with Try again. Words match the web's ObservationDetails.
// Called by screens/ObservationDetail, which owns the requests. Draws nothing when nothing is suggested.
import { View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { fieldStateOf, type Field } from '../rowState'
import type { Observation } from '../format'
import { TryAgain } from './TryAgain'

export type SuggestionActions = {
  confirm(field: Field): void
  change(field: Field): void
  retry(): void
  // Greyed while a request is out, or with no signal (then the words say why).
  disabled: boolean
  offline: boolean
}

const FIELDS: Field[] = ['category', 'severity']

// `actions` is undefined for an observation still waiting to upload (MB-10): it has no suggestion yet.
export function SuggestionLines({ observation, actions }: { observation: Observation; actions?: SuggestionActions }) {
  if (!actions) return null
  const lines = FIELDS.map((field) => ({ field, ...fieldStateOf(observation, field) }))
  // Shown whenever the suggestion failed, even with older suggested values filled in: without it the
  // observation stays out of drafting with no way back (AC3).
  const failed = observation.suggestion?.status === 'failed'
  if (!failed && !lines.some((l) => l.suggesting || l.failed || l.notSure)) return null

  return (
    <View className="gap-3">
      {lines.map(({ field, suggesting, failed: empty, notSure }) => {
        if (suggesting)
          return (
            <View key={field} className="flex-row">
              <Badge variant="info">
                <Text>{`Suggesting a ${field}`}</Text>
              </Badge>
            </View>
          )
        if (empty) return <Text key={field} className="text-base text-destructive">{`Choose a ${field}`}</Text>
        if (!notSure) return null
        return (
          <View key={field} className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-base capitalize">{field}</Text>
              <Badge variant="warning">
                <Text>Not sure</Text>
              </Badge>
            </View>
            <View className="flex-row gap-3">
              <Button variant="outline" accessibilityLabel={`Confirm ${field}`} disabled={actions.disabled} onPress={() => actions.confirm(field)}>
                <Text>Confirm</Text>
              </Button>
              <Button variant="ghost" accessibilityLabel={`Change ${field}`} disabled={actions.disabled} onPress={() => actions.change(field)}>
                <Text>Change</Text>
              </Button>
            </View>
          </View>
        )
      })}
      {lines.some((l) => l.notSure) && actions.offline && <Text className="text-sm text-muted-foreground">Connect to confirm.</Text>}
      {failed && (
        <View className="gap-2">
          <Text className="text-base text-destructive">Suggestion failed</Text>
          <TryAgain label="suggestion" retry={{ run: actions.retry, disabled: actions.disabled, offline: actions.offline }} />
        </View>
      )}
    </View>
  )
}
