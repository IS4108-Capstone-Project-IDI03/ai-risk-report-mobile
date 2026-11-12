// One checklist item (MB-05 AC2, AC7, AC8, AC12): its text, COPE categories and where it
// stands, as a badge with an icon and a word. Tapping opens it to show where it came
// from and to answer it. Used by screens/Checklist.
import { router } from 'expo-router'
import { Check, ChevronDown, ChevronUp, CircleSlash, Clock, Eye, TriangleAlert } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import type { Checklist, Item } from '../api'
import { RESULT, resultOf, type Pending } from '../format'
import { Citations } from './Citations'

const ICON = { confirmed: Check, differs: TriangleAlert, not_seen: Eye, not_applicable: CircleSlash }
const COLOUR = { success: '#2f7049', warning: '#8f5f13', neutral: '#545e6b' }

type Mark = 'not_seen' | 'not_applicable'
type Props = {
  item: Item
  checklist: Checklist
  reference: string
  onMark(item: Item, mark: Mark | null): Promise<void>
  // Opens the Confirm / Differs box for this item.
  onAnswer(item: Item, result: 'confirmed' | 'differs'): void
  // What waits to upload for it (made with no signal), and how to drop it.
  pending: Pending | null
  onDiscard(id: string): void
  onUnlink(id: string): void
}

export function ItemRow({ item, checklist, reference, onMark, onAnswer, pending, onDiscard, onUnlink }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // A waiting mark or answer shows in place of the gateway's: it is what the engineer did
  // last. One the gateway refused says so, since it never will upload.
  const waiting = pending && `${pending.result ? RESULT[pending.result].label : 'Mark removed'} · Waiting to upload`
  const result = pending
    ? pending.error
      ? { label: "Couldn't upload", tone: 'warning' as const }
      : { label: waiting!, tone: 'neutral' as const }
    : resultOf(item.check)
  const Icon = pending ? (pending.error ? TriangleAlert : Clock) : item.check ? ICON[item.check.result] : null
  // An observation answers it: its own answer says more than a mark, so the marks are
  // not offered (the gateway refuses them too).
  const observation = item.check?.observation

  // Choosing the mark an item already has clears it (AC8).
  async function mark(next: Mark) {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      await onMark(item, item.check?.result === next ? null : next)
    } catch (e) {
      setProblem(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View testID="checklist-item" className="border-b border-border bg-card">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        className="flex-row items-start gap-3 px-4 py-3"
      >
        <View className="flex-1 gap-1.5">
          <Text className="text-base">{item.text}</Text>
          <View className="flex-row flex-wrap items-center gap-2">
            {result && Icon && (
              <View testID="checklist-status">
                <Badge variant={result.tone}>
                  <Icon color={COLOUR[result.tone]} size={14} />
                  <Text>{result.label}</Text>
                </Badge>
              </View>
            )}
            {item.COPE_dimension.length > 0 && <Text className="text-sm text-muted-foreground">{item.COPE_dimension.join(' · ')}</Text>}
          </View>
        </View>
        {/* Says the row opens: its citations and its answers are inside. */}
        {open ? <ChevronUp color="#545e6b" size={20} /> : <ChevronDown color="#545e6b" size={20} />}
      </Pressable>
      {open && (
        <View className="gap-3 px-4 pb-4">
          <Citations item={item} checklist={checklist} />
          {pending ? (
            pending.error && (
              <View className="gap-2">
                {/* The failed-row pattern (design system v2): a red icon and the short error,
                    then the way out in grey. */}
                <View className="flex-row items-start gap-2">
                  <TriangleAlert color="#ad2e2d" size={16} style={{ marginTop: 2 }} />
                  <Text className="flex-1 text-sm text-destructive">{`Couldn't upload: ${pending.error}`}</Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  {pending.kind === 'observation' ? 'Save it without the checklist link, or discard it.' : 'Discard it.'}
                </Text>
                {/* A refused answer keeps its note and photo: only its link to the item is dropped. */}
                {pending.kind === 'observation' && (
                  <Button accessibilityLabel="Save without the checklist link" onPress={() => onUnlink(pending.id)}>
                    <Text>Save without the checklist link</Text>
                  </Button>
                )}
                <Button variant="outline" accessibilityLabel="Discard" onPress={() => onDiscard(pending.id)}>
                  <Text>Discard</Text>
                </Button>
              </View>
            )
          ) : observation ? (
            <Button
              variant="outline"
              accessibilityLabel="View observation"
              onPress={() => router.push({ pathname: '/assessment/[reference]/observation/[id]', params: { reference, id: observation.id } })}
            >
              <Text>View observation</Text>
            </Button>
          ) : (
            <View className="gap-2">
              <View className="flex-row gap-2">
                <Button accessibilityLabel="Confirm" className="flex-1" onPress={() => onAnswer(item, 'confirmed')}>
                  <Text>Confirm</Text>
                </Button>
                <Button variant="secondary" accessibilityLabel="Differs" className="flex-1" onPress={() => onAnswer(item, 'differs')}>
                  <Text>Differs</Text>
                </Button>
              </View>
              <View className="flex-row gap-2">
                <Button variant="outline" accessibilityLabel="Not seen" disabled={busy} className="flex-1" onPress={() => mark('not_seen')}>
                  <Text>Not seen</Text>
                </Button>
                <Button variant="outline" accessibilityLabel="Not applicable" disabled={busy} className="flex-1" onPress={() => mark('not_applicable')}>
                  <Text>Not applicable</Text>
                </Button>
              </View>
            </View>
          )}
          {problem && <Text className="text-sm text-destructive">{problem}</Text>}
        </View>
      )}
    </View>
  )
}
