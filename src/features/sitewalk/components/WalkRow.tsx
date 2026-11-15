// One walk on the Site walks screen (MB-16 AC2, AC4, AC38): its name, when it started, its status,
// up to four photos and what its proposal holds, and what can be done to it: Try again when it failed,
// Rename, Discard. Used by screens/SiteWalks.
import { Mic, Pencil, RotateCcw, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Image, View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { errorText } from '@/lib/api'
import { capturedAt, mediaUri } from '@/features/observations/format'
import type { SiteWalk } from '../api'
import { WALK_STATUS, working } from '../format'
import { incompleteCount } from '../proposal'

type Props = {
  walk: SiteWalk
  busy: boolean
  // Opens the recorder, for a walk still being recorded.
  onOpen(): void
  // Opens the review, for a walk that is ready.
  onReview(): void
  onRetry(): void
  onRename(name: string): Promise<void>
  onDiscard(): void
}

// Photos shown before "+N".
const MAX_THUMBS = 4
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function WalkRow({ walk, busy, onOpen, onReview, onRetry, onRename, onDiscard }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const title = walk.name ?? 'Site walk'
  const status = WALK_STATUS[walk.status]
  const p = walk.proposal
  const thumbs = walk.photos.slice(0, MAX_THUMBS)
  // What is left, as the review says it: a ready walk with nothing to add, something to fix, or all set.
  const left = walk.status === 'ready' && p ? (p.observations.length ? incompleteCount(p) : null) : undefined

  async function save() {
    if (!renaming?.trim()) return
    try {
      await onRename(renaming.trim())
      setRenaming(null)
      setError(null)
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <View testID={`walk-${walk.id}`} className="gap-3 rounded-lg border border-border bg-card p-4">
      {renaming === null ? (
        <View className="gap-1">
          <Text className="text-base font-semibold">{title}</Text>
          <Text className="text-sm text-muted-foreground">{capturedAt(walk.createdAt)}</Text>
        </View>
      ) : (
        <View className="gap-2">
          <Input accessibilityLabel="Walk name" value={renaming} onChangeText={setRenaming} maxLength={100} autoFocus />
          {error && <Text className="text-sm text-destructive">{error}</Text>}
          <View className="flex-row gap-2">
            <Button accessibilityLabel="Save name" disabled={!renaming.trim()} onPress={save} className="flex-1">
              <Text>Save</Text>
            </Button>
            <Button variant="outline" accessibilityLabel="Cancel rename" onPress={() => setRenaming(null)} className="flex-1">
              <Text>Cancel</Text>
            </Button>
          </View>
        </View>
      )}
      <View className="flex-row items-center gap-2">
        <Badge variant={status.tone}>
          <Text>{status.label}</Text>
        </Badge>
        {working(walk.status) && <ActivityIndicator color="#2c5488" size="small" />}
      </View>
      {p && <Text className="text-sm text-muted-foreground">{`${plural(p.locations.length, 'location')} · ${plural(p.observations.length, 'observation')}`}</Text>}
      {walk.status === 'ready' && p && (
        <Text className={left ? 'text-sm font-medium text-destructive' : 'text-sm text-muted-foreground'}>
          {left === null ? 'No observations' : left ? `${left} to fix` : 'Ready to add'}
        </Text>
      )}
      {thumbs.length > 0 && (
        <View className="flex-row items-center gap-2">
          {thumbs.map((t) => (
            <Image key={t.id} testID={`walk-photo-${t.id}`} source={{ uri: mediaUri(t.url) }} accessibilityLabel="Photo from the walk" className="h-12 w-12 rounded-md bg-muted" />
          ))}
          {walk.photos.length > thumbs.length && <Text className="text-sm text-muted-foreground">{`+${walk.photos.length - thumbs.length}`}</Text>}
        </View>
      )}
      {walk.status === 'failed' && walk.error && <Text className="text-destructive">{walk.error}</Text>}
      {/* The one next step is a full-width button; Rename and Discard are an equal pair under it. */}
      <View className="gap-2">
        {walk.status === 'recording' && (
          <Button size="lg" accessibilityLabel={`Continue recording: ${title}`} onPress={onOpen}>
            <Mic color="#ffffff" size={18} />
            <Text>Continue recording</Text>
          </Button>
        )}
        {walk.status === 'ready' && (
          <Button size="lg" accessibilityLabel={`Review: ${title}`} onPress={onReview}>
            <Text>Review</Text>
          </Button>
        )}
        {walk.status === 'failed' && (
          <Button size="lg" accessibilityLabel={`Try again: ${title}`} disabled={busy} onPress={onRetry}>
            <RotateCcw color="#ffffff" size={18} />
            <Text>Try again</Text>
          </Button>
        )}
        <View className="flex-row gap-2">
          {renaming === null && (
            <Button variant="outline" accessibilityLabel={`Rename ${title}`} disabled={busy} onPress={() => setRenaming(walk.name ?? '')} className="flex-1">
              <Pencil color="#1a1f26" size={16} />
              <Text>Rename</Text>
            </Button>
          )}
          <Button variant="outline" accessibilityLabel={`Discard ${title}`} disabled={busy} onPress={onDiscard} className="flex-1">
            <Trash2 color="#ad2e2d" size={16} />
            <Text className="text-destructive">Discard</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}
