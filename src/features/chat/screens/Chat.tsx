// Chatbot tab (MB-06): ask the knowledge base and read cited answers. Each
// answer streams from the gateway's POST /api/chat (a paid model call), and its
// citations open their source passage. Replaces MB-01's placeholder.
import { Tabs } from 'expo-router'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, ScrollView, View, type ScrollViewInstance } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { documentNames } from '../api'
import { AnswerView } from '../components/AnswerView'
import { type OpenCitation } from '../components/CitationMarker'
import { CitationSheet } from '../components/CitationSheet'
import { Composer } from '../components/Composer'
import { Starters } from '../components/Starters'
import { useConversation } from '../useConversation'

export default function Chat() {
  const { turns, busy, send, stop, retry, reset } = useConversation()
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [citation, setCitation] = useState<OpenCitation | null>(null)
  const scroll = useRef<ScrollViewInstance>(null)
  // The keyboard lifts the composer by its height less what's above this screen.
  const headerHeight = useHeaderHeight()

  // Whether the engineer is reading at the bottom: only then does the view
  // follow a streaming answer, so scrolling up to reread isn't fought.
  const atBottom = useRef(true)

  // Document names for citations. Without them a citation still opens, saying
  // "Source document". A failed load is tried again with the next question.
  const loadNames = useCallback(() => {
    documentNames().then(setNames, () => {})
  }, [])
  useEffect(() => {
    loadNames()
  }, [loadNames])

  function ask(question: string) {
    if (names.size === 0) loadNames()
    atBottom.current = true
    send(question)
  }

  return (
    <>
      {/* New chat in the navy header, once there's a conversation: the way back
          to the starter questions (the web's sidebar has the same). */}
      <Tabs.Screen
        options={{
          headerRight: turns.length
            ? () => (
                <Button variant="ghost" accessibilityLabel="New chat" onPress={reset} className="px-3">
                  <Text className="text-white">New chat</Text>
                </Button>
              )
            : undefined,
        }}
      />
    <KeyboardAvoidingView
      className="flex-1"
      // Padding on Android too: edge-to-edge (Expo 58) no longer resizes the window for the keyboard.
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        ref={scroll}
        contentContainerClassName="gap-3 p-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // Follow the answer as it's written, unless the engineer scrolled up.
        onContentSizeChange={() => atBottom.current && scroll.current?.scrollToEnd({ animated: true })}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
          atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 48
        }}
        scrollEventThrottle={100}
      >
        {turns.length === 0 ? (
          <Starters onAsk={ask} />
        ) : (
          turns.map((t) =>
            t.role === 'user' ? (
              // A quiet bubble in Marsh light blue, as on the web (chat.css, ink-50).
              <View key={t.id} testID="my-message" className="max-w-[85%] self-end rounded-xl bg-secondary px-3.5 py-2.5">
                <Text className="text-base leading-6">{t.text}</Text>
              </View>
            ) : (
              <AnswerView
                key={t.id}
                turn={t}
                names={names}
                onAsk={ask}
                onOpenCitation={setCitation}
                onRetry={retry}
                canRetry={t === turns[turns.length - 1]}
              />
            ),
          )
        )}
      </ScrollView>
      <Composer busy={busy} onSend={ask} onStop={stop} />
      <CitationSheet citation={citation} names={names} onClose={() => setCitation(null)} />
    </KeyboardAvoidingView>
    </>
  )
}
