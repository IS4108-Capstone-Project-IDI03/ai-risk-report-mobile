// A new client's two details (MB-21 AC2a to AC2d, web CP-23's client card): Client name (required) and
// Division (optional). When the name is one the gateway already has, it says so and offers that client
// (the web switches to it on a matching name). Called by screens/NewAssessment.
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { FieldLabel } from '@/components/FieldLabel'
import type { Client } from '../api'

type Props = {
  name: string
  division: string
  // The listed client with this name, if there is one.
  match: Client | undefined
  // The gateway's problem with the name, if it refused one.
  error?: string
  disabled: boolean
  onName(text: string): void
  onDivision(text: string): void
  onUse(client: Client): void
}

export function NewClientFields({ name, division, match, error, disabled, onName, onDivision, onUse }: Props) {
  return (
    <View className="gap-4 rounded-md border border-border bg-card p-4">
      <View className="gap-1">
        <FieldLabel required>Client name</FieldLabel>
        <Input accessibilityLabel="Client name" value={name} editable={!disabled} onChangeText={onName} />
        {match ? (
          <View className="gap-2">
            <Text className="text-sm text-destructive">{`${match.name} is already a client.`}</Text>
            <Button variant="outline" accessibilityLabel={`Use ${match.name}`} onPress={() => onUse(match)}>
              <Text>{`Use ${match.name}`}</Text>
            </Button>
          </View>
        ) : error ? (
          <Text className="text-sm text-destructive">{error}</Text>
        ) : null}
      </View>
      <View className="gap-1">
        <FieldLabel>Division</FieldLabel>
        <Input accessibilityLabel="Division" value={division} editable={!disabled} onChangeText={onDivision} />
      </View>
    </View>
  )
}
