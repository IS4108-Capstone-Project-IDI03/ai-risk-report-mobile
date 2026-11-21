// Choosing a client (MB-21, web CP-17/CP-23): a search box and the gateway's clients, each with
// its division and how many sites it has. Tapping one chooses it. There is no way to add a client
// here (Out of scope). It takes the form's place on the screen rather than opening a pop-up
// sheet: the form is itself a modal screen, and iOS cannot show a second modal over it (the
// first simulator try-out found the sheet never appeared). Called by screens/NewAssessment.
import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import type { Client } from '../api'

type Props = { clients: Client[]; onPick(client: Client): void; onClose(): void }

export function ClientPicker({ clients, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients
  return (
    <View testID="client-picker" className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-2">
        <Text accessibilityRole="header" className="text-lg font-semibold">Choose a client</Text>
        <Button variant="ghost" accessibilityLabel="Close" onPress={onClose}>
          <Text className="text-primary">Close</Text>
        </Button>
      </View>
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <Input accessibilityLabel="Search clients" placeholder="Search clients" value={query} onChangeText={setQuery} autoCorrect={false} />
      {shown.length ? (
        shown.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`${c.name}${c.division ? `, ${c.division}` : ''}, ${c.sites} ${c.sites === 1 ? 'site' : 'sites'}`}
            onPress={() => onPick(c)}
            className="min-h-[60px] justify-center rounded-md border border-border bg-card px-4 py-2 active:bg-muted"
          >
            <Text className="font-semibold">{c.name}</Text>
            <Text className="text-sm text-muted-foreground">{[c.division, `${c.sites} ${c.sites === 1 ? 'site' : 'sites'}`].filter(Boolean).join(' · ')}</Text>
          </Pressable>
        ))
      ) : (
        <View className="py-6">
          <Text className="text-center text-muted-foreground">{clients.length ? 'No client matches. Check the spelling.' : 'No clients yet. Add the client on the web first.'}</Text>
        </View>
      )}
      </ScrollView>
    </View>
  )
}
