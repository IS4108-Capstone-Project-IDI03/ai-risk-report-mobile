// "Show deleted" under the workspace list (MB-12 AC22-AC26): the observations deleted at
// the chosen location, each with who deleted it and when, and a Restore button, laid out
// like the removed photos and voice notes on the edit screen. Nothing is asked for until
// it is opened; then it is read again whenever the list above reloads (`watch`), so a
// delete shows up. Called by the workspace, which reloads its list when one is restored.
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { listDeleted, restoreObservation } from '../api'
import { capturedAt, observationTitle, type Observation } from '../format'

type Props = { reference: string; locationId: string; offline: boolean; watch: unknown; onRestored(): void }

export function DeletedSection({ reference, locationId, offline, watch, onRestored }: Props) {
  const [open, setOpen] = useState(false)
  // null until the first read.
  const [items, setItems] = useState<Observation[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  // The one being restored, so a double tap sends one request.
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    if (!open || offline) return
    let live = true
    listDeleted(reference).then(
      (all) => {
        if (!live) return
        // Newest deletion first, and only this location's, as the list above is.
        setItems(all.filter((o) => o.location?.id === locationId).sort((a, b) => b.deleted!.at.localeCompare(a.deleted!.at)))
      },
      (e: unknown) => live && setProblem(errorText(e)),
    )
    return () => {
      live = false
    }
  }, [open, offline, reference, locationId, watch])

  // Either way the list above is read again, which also reads the deleted ones again: a
  // restore refused because it was already restored on the web then drops off this list,
  // and the message stays until the next try (AC24, AC25).
  async function restore(o: Observation) {
    if (restoring) return
    setRestoring(o.id)
    setProblem(null)
    try {
      await restoreObservation(o.id)
      setItems((all) => all && all.filter((x) => x.id !== o.id))
    } catch (e) {
      setProblem(errorText(e))
    } finally {
      setRestoring(null)
      onRestored()
    }
  }

  return (
    <View className="gap-3">
      <Button
        variant="outline"
        accessibilityLabel={open ? 'Hide deleted' : 'Show deleted'}
        disabled={offline}
        onPress={() => {
          setOpen(!open)
          setProblem(null)
        }}
      >
        <Text>{open ? 'Hide deleted' : 'Show deleted'}</Text>
        {open ? <ChevronUp color="#1a1f26" size={18} /> : <ChevronDown color="#1a1f26" size={18} />}
      </Button>
      {offline && <Text className="text-sm text-muted-foreground">Connect to see deleted.</Text>}
      {open && !offline && items?.length === 0 && <Text className="text-muted-foreground">Nothing deleted here.</Text>}
      {open &&
        !offline &&
        items?.map((o) => (
          <View key={o.id} className="flex-row items-center gap-3 rounded-md border border-border bg-card p-2">
            <Text className="flex-1 font-medium" numberOfLines={2}>
              {`${observationTitle(o)} · Deleted by ${o.deleted!.by.name}, ${capturedAt(o.deleted!.at)}`}
            </Text>
            <Button variant="outline" accessibilityLabel="Restore observation" disabled={!!restoring} onPress={() => restore(o)}>
              <RotateCcw color="#1a1f26" size={16} />
              <Text>Restore</Text>
            </Button>
          </View>
        ))}
      {open && !offline && problem && <Text className="text-destructive">{problem}</Text>}
    </View>
  )
}
