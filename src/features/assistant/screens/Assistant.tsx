// MarshBot's chat for one assessment (MB-20, web AS-06): the screen the Overview bar opens. A status line and the
// stage on top, the conversation (bubbles and cards), and MarshBot's reply buttons pinned at the bottom, in thumb reach.
// Opening it reads GET .../assistant, which on the real gateway records an "open" and can start paid AI steps.
// Called by src/app/assessment/[reference]/assistant. Calls useThread (api.ts).
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, View, type ScrollViewInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { useOffline } from '@/features/offline/provider'
import { targetOf, type Target } from '@/features/overview/format'
import { Bubble } from '../components/Bubble'
import { DateStep } from '../components/DateStep'
import { Replies } from '../components/Replies'
import { StatusLine, SummaryButton } from '../components/StatusLine'
import { useThread } from '../useThread'
import type { Reply } from '../types'

// Counts the workspace asks made from this screen (see toWorkspace).
let asked = 0

export default function Assistant() {
  const { reference } = useLocalSearchParams<{ reference: string }>()
  const insets = useSafeAreaInsets()
  const { offline } = useOffline()
  const { thread, problem, loading, sending, replyError, stalled, reply } = useThread(reference)
  // The "Another visit" reply waiting for its day, if any.
  const [picking, setPicking] = useState<Reply | null>(null)
  const scroll = useRef<ScrollViewInstance>(null)

  // Back to the workspace on a side of its switch (or with the Overview sheet open): the workspace is already under
  // this screen, so dismissTo goes back to it and hands it the choice as a param.
  // `at` is a counter, so every ask is a new one even in the same millisecond (the workspace reacts to it changing).
  const toWorkspace = (params: { side?: 'checklist' | 'observations'; overview?: '1' }) =>
    router.dismissTo({ pathname: '/assessment/[reference]', params: { reference, at: String(++asked), ...params } })

  // Where a link goes: the same places as the Overview's links. A link to a web-only tab never reaches here (greyed).
  function go(target: Target) {
    if (target.kind === 'checklist') toWorkspace({ side: 'checklist' })
    else if (target.kind === 'observations' || target.kind === 'uncategorised') toWorkspace({ side: 'observations' })
    else if (target.kind === 'observation') router.push({ pathname: '/assessment/[reference]/observation/[id]', params: { reference, id: target.id } })
    else if (target.kind === 'walks') router.push({ pathname: '/assessment/[reference]/site-walks', params: { reference } })
  }

  // A reply with a link (e.g. "Add observations") only opens it, as on the web (client MarshBotOverview.tsx). Sending it
  // would fail: the gateway's replySchema (replies.service.ts) has no id for it, so POST /replies answers "Invalid option".
  // Every other reply is sent, and the screen shows the thread that comes back.
  async function send(r: Reply, date?: string) {
    if (r.link) return go(targetOf(r.link))
    if (await reply(r, date)) setPicking(null)
  }

  const mine = thread?.viewer === 'engineer'
  const replies = mine ? thread.replies : []

  return (
    <View testID="assistant" className="flex-1 bg-background">
      {thread ? (
        <StatusLine thread={thread} onSummary={() => toWorkspace({ overview: '1' })} />
      ) : (
        !loading && (
          <View className="items-end border-b border-border bg-card px-4">
            <SummaryButton onPress={() => toWorkspace({ overview: '1' })} />
          </View>
        )
      )}
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
        // Follow the conversation to its newest turn as it grows.
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        <OfflineNote />
        {loading && <ActivityIndicator accessibilityLabel="Loading" />}
        {problem && <Text className={problem.kind === 'archived' ? 'text-muted-foreground' : 'text-destructive'}>{problem.text}</Text>}
        {thread?.session.turns.map((t) => (
          <Bubble key={t.id} turn={t} onGo={go} />
        ))}
        {thread?.thinking && (
          <View testID="thinking" className="flex-row items-center gap-2">
            {/* No spinner once the chat has stopped reading again: it would promise work the phone isn't watching. */}
            {!stalled && <ActivityIndicator />}
            <Text className="text-sm text-muted-foreground">{stalled ? 'Still working. Check back soon.' : 'MarshBot is writing'}</Text>
          </View>
        )}
      </ScrollView>
      {(replies.length > 0 || replyError) && (
        <View className="gap-2 border-t border-border bg-background px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          {replyError && <Text className="text-sm text-destructive">{replyError}</Text>}
          {picking ? (
            <DateStep sending={sending} onConfirm={(day) => send(picking, day)} onCancel={() => setPicking(null)} />
          ) : (
            <>
              <Replies replies={replies} disabled={sending || offline} onPick={(r) => (r.picksDate ? setPicking(r) : send(r))} />
              {offline && <Text className="text-sm text-muted-foreground">Connect to reply.</Text>}
            </>
          )}
        </View>
      )}
    </View>
  )
}
