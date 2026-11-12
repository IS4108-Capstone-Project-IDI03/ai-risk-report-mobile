// The generate box (MB-05 AC5, AC6): the standards that apply to the site, all selected,
// to deselect before generating (a deselected standard is cited by no item). Generating
// is a paid AI call and takes a while, so it says it is working; a refusal shows the
// gateway's words and the box stays open. Opened by screens/Checklist.
import { useState } from 'react'
import { ActivityIndicator, Modal, ScrollView, Switch, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { generateChecklist, type ChecklistBody, type Standard } from '../api'
import { standardLabel } from '../format'

type Props = {
  reference: string
  standards: Standard[]
  onClose(): void
  // The new checklist, as the gateway sends it.
  onGenerated(body: ChecklistBody): void
}

export function GenerateSheet({ reference, standards, onClose, onGenerated }: Props) {
  const [selected, setSelected] = useState(() => new Set(standards.map((s) => s.id)))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function generate() {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      onGenerated(await generateChecklist(reference, [...selected]))
    } catch (e) {
      setProblem(errorText(e))
      setBusy(false)
    }
  }

  function toggle(id: string, on: boolean) {
    setSelected((now) => {
      const next = new Set(now)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={busy ? undefined : onClose}>
      <SafeAreaView testID="generate-sheet" className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
          <Text className="text-xl font-bold">Generate checklist</Text>
          <Button variant="ghost" accessibilityLabel="Close" disabled={busy} onPress={onClose}>
            <Text>Close</Text>
          </Button>
        </View>
        <ScrollView contentContainerClassName="gap-3 p-4">
          <Text className="text-muted-foreground">
            The checklist is built from these standards. Turn one off and no item will cite it.
          </Text>
          {standards.length === 0 && <Text>No standards in the knowledge base apply to this site. The checklist will use the report template only.</Text>}
          {standards.map((s) => (
            <View key={s.id} className="min-h-12 flex-row items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
              <Text className="flex-1">{standardLabel(s)}</Text>
              <Switch accessibilityLabel={standardLabel(s)} value={selected.has(s.id)} disabled={busy} onValueChange={(on) => toggle(s.id, on)} />
            </View>
          ))}
          {problem && (
            <View className="rounded-md bg-destructive/10 p-3">
              <Text className="text-destructive">{problem}</Text>
            </View>
          )}
        </ScrollView>
        <View className="border-t border-border bg-card px-4 pb-2 pt-2">
          {busy && (
            <View className="flex-row items-center justify-center gap-2 pb-2">
              <ActivityIndicator color="#000f47" />
              <Text className="text-sm text-muted-foreground">Generating. This can take a minute.</Text>
            </View>
          )}
          <Button size="lg" accessibilityLabel="Generate" disabled={busy} onPress={generate}>
            <Text className="text-lg">Generate</Text>
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  )
}
