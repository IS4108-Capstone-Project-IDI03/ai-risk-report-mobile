// My preferences (MB-15): the engineer's lasting facts for the knowledge assistant, with a switch to
// use them in chats. Opened by My preferences in the chats list (route /preferences, a modal). Calls
// getMemory (kept on the phone, so it opens offline, read-only) and the fact calls in ../api. Mirrors
// the web's PreferencesPanel (CB-05); nothing here is a paid call.
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Switch, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { write } from '@/lib/store'
import { cn, readable } from '@/lib/utils'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { useOffline } from '@/features/offline/provider'
import { addFact, getMemory, MEMORY_CACHE_KEY, removeFact, saveFact, setMemoryEnabled, type Memory } from '../api'
import { FactForm } from '../components/FactForm'
import { FactRow } from '../components/FactRow'

export default function Preferences() {
  const { offline } = useOffline()
  const [memory, setMemory] = useState<Memory | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Goes up to load again (Try again).
  const [tries, setTries] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Why the switch or a delete didn't work; add and edit show theirs under their own box.
  const [problem, setProblem] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    let live = true
    getMemory().then(
      (m) => {
        if (!live) return
        setMemory(m)
        setLoadError(null)
      },
      (e) => live && setLoadError(errorText(e)),
    )
    return () => {
      live = false
    }
  }, [tries])

  // Each change shows what the gateway returned, and is kept on the phone so the offline copy is
  // current. It works on the list as it is when the reply arrives, so two requests can't bring back
  // a deleted fact.
  function change(update: (m: Memory) => Memory) {
    setMemory((m) => {
      if (!m) return m
      const next = update(m)
      write(MEMORY_CACHE_KEY, next)
      return next
    })
  }

  async function turn(on: boolean) {
    setSwitching(true)
    setProblem(null)
    try {
      const saved = await setMemoryEnabled(on)
      change((m) => ({ ...m, enabled: saved.enabled }))
    } catch (e) {
      setProblem(errorText(e))
    } finally {
      setSwitching(false)
    }
  }

  function confirmDelete(id: string) {
    Alert.alert('Delete this fact?', 'The assistant stops using it. This can’t be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFact(id)
            change((m) => ({ ...m, facts: m.facts.filter((f) => f.id !== id) }))
            setEditingId(null)
          } catch (e) {
            setProblem(errorText(e))
          }
        },
      },
    ])
  }

  if (loadError && !memory)
    return (
      <View testID="preferences" className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-center text-muted-foreground">{loadError}</Text>
        <Button variant="outline" accessibilityLabel="Try again" onPress={() => setTries((n) => n + 1)}>
          <Text>Try again</Text>
        </Button>
      </View>
    )
  if (!memory)
    return (
      <View testID="preferences" className="flex-1 items-center justify-center">
        <ActivityIndicator color="#000f47" />
      </View>
    )

  const { facts, maxFacts, maxChars, enabled } = memory
  const canChange = !offline

  return (
    <ScrollView testID="preferences" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <View className={cn('gap-4', readable)}>
        <OfflineNote />
        <Text className="text-muted-foreground">Lasting facts about your work. The assistant takes them into account in every chat.</Text>
        <View className="flex-row items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <Text className="flex-1 text-base font-medium">Use my preferences in chats</Text>
          <Switch
            accessibilityLabel="Use my preferences in chats"
            value={enabled}
            disabled={!canChange || switching}
            onValueChange={turn}
            trackColor={{ true: '#000f47' }}
          />
        </View>
        {problem && (
          <View className="rounded-md bg-destructive/10 p-3">
            <Text className="text-destructive">{problem}</Text>
          </View>
        )}
        <Text className="text-sm text-muted-foreground">Your list is kept when this is off.</Text>
        <Text className="text-sm text-muted-foreground">
          Do not type client names or site details. A fact steers an answer; it is never cited as evidence.
        </Text>
        {offline && <Text className="font-medium">Connect to change your preferences.</Text>}
        {canChange && enabled && (
          facts.length >= maxFacts ? (
            <View className="rounded-md bg-secondary p-3">
              <Text>{`You have ${maxFacts} facts. Delete one to add another.`}</Text>
            </View>
          ) : (
            <FactForm
              max={maxChars}
              boxLabel="Add a fact"
              submitLabel="Add fact"
              submitText="Add fact"
              onSubmit={async (text) => {
                const added = await addFact(text)
                change((m) => ({ ...m, facts: [...m.facts, added] }))
              }}
            />
          )
        )}
        <Text className="text-lg font-semibold">{`${facts.length} of ${maxFacts} facts`}</Text>
        {facts.length === 0 ? (
          <View className="items-center gap-1 py-4">
            <Text className="font-medium">No facts yet</Text>
            <Text className="text-center text-muted-foreground">For example: I mostly survey Singapore offices.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {facts.map((fact) => (
              <FactRow
                key={fact.id}
                fact={fact}
                max={maxChars}
                editing={editingId === fact.id}
                canEdit={canChange && enabled}
                dimmed={!enabled}
                onEdit={() => setEditingId(fact.id)}
                onCancel={() => setEditingId(null)}
                onSave={async (text) => {
                  const saved = await saveFact(fact.id, text)
                  change((m) => ({ ...m, facts: m.facts.map((f) => (f.id === fact.id ? saved : f)) }))
                  setEditingId(null)
                }}
                onDelete={() => confirmDelete(fact.id)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
