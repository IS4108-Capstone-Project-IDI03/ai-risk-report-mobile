// Chatbot tab (MB-06): ask the knowledge base and read cited answers. Each
// answer streams from the gateway's POST /api/chat (a paid model call), and its
// citations open their source passage. Replaces MB-01's placeholder.
// MB-14: the two-line button at the header's left opens my saved chats, as ChatGPT's does. On a
// phone the chat, header and all, slides aside to show the list under it; on a wide iPad the
// list is a column beside the chat (shown at first). So the header is drawn here, not by the
// tab bar, to move with the chat.
import { router, Tabs, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { useSplitView } from '@/lib/device'
import { errorText } from '@/lib/api'
import { ChatList } from '../components/ChatList'
import { ChatsPanel } from '../components/ChatsPanel'
import { Text } from '@/components/ui/text'
import { documentNames } from '../api'
import { AnswerView } from '../components/AnswerView'
import { type OpenCitation } from '../components/CitationMarker'
import { CitationSheet } from '../components/CitationSheet'
import { Composer } from '../components/Composer'
import { MyMessage } from '../components/MyMessage'
import { Starters } from '../components/Starters'
import type { Taken } from '../useAttachments'
import { useConversation } from '../useConversation'
import { stopReading } from '../useReadAloud'

// The navy bar's height under the status bar.
const HEADER = 56

export default function Chat() {
  const { turns, busy, openId, pdfsHeld, send, stop, retry, reset, open, forget } = useConversation()
  const split = useSplitView()
  // The chats list: shown from the start on a wide iPad, a panel that slides over the chat on a phone.
  const [listOpen, setListOpen] = useState(split)
  const [problem, setProblem] = useState<string | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [citation, setCitation] = useState<OpenCitation | null>(null)
  const scroll = useRef<ScrollViewInstance>(null)
  // The keyboard lifts the composer by its height less what's above it: the status bar and header.
  const insets = useSafeAreaInsets()
  const headerHeight = insets.top + HEADER

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

  // A chat picked in the list: it opens, and the panel closes on a phone.
  function openChat(id: string) {
    stopReading()
    setProblem(null)
    open(id).then(
      () => !split && setListOpen(false),
      (e) => setProblem(errorText(e)),
    )
  }

  // New chat from the list: the starter questions, and the list closes on a phone.
  function newChat() {
    startOver()
    if (!split) setListOpen(false)
  }

  // The answer being read belongs to the chat on screen, so it stops with it (AC7).
  function startOver() {
    stopReading()
    reset()
  }

  // My preferences opens over the chat; on a phone the list slides away first.
  function openPreferences() {
    if (!split) setListOpen(false)
    router.push('/preferences')
  }

  // An answer being read aloud stops when I leave the chat tab, or ask something new (MB-25).
  useFocusEffect(useCallback(() => stopReading, []))

  function ask(question: string, taken?: Taken) {
    stopReading()
    if (names.size === 0) loadNames()
    atBottom.current = true
    send(question, taken)
  }

  // The navy bar: the two-line button at the left (ChatGPT's mark, the lower bar shorter),
  // the title, and New chat at the right once there's a conversation, the way back to the
  // starter questions (the web's sidebar has the same).
  const header = (
    <View className="bg-navy" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-2" style={{ height: HEADER }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listOpen ? 'Close chats' : 'Open chats'}
          onPress={() => setListOpen((on) => !on)}
          className="h-12 w-12 items-center justify-center"
        >
          <View className="gap-1.5">
            <View className="h-0.5 w-6 rounded-full bg-white" />
            <View className="h-0.5 w-3.5 rounded-full bg-white" />
          </View>
        </Pressable>
        {/* Pinned to the middle of the bar: with "New chat" on the right the two sides differ in width,
            and justify-between would push the title off-centre. pointerEvents none keeps taps on the buttons. */}
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <Text className="text-lg font-semibold text-white">Chatbot</Text>
        </View>
        {turns.length > 0 ? (
          <Button variant="header" accessibilityLabel="New chat" onPress={startOver} className="px-3">
            <Text>New chat</Text>
          </Button>
        ) : (
          <View className="w-12" />
        )}
      </View>
    </View>
  )

  const chat = (
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
              <MyMessage key={t.id} turn={t} />
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
      {problem && <Text className="px-4 pb-2 text-destructive">{problem}</Text>}
      <Composer busy={busy} pdfsHeld={pdfsHeld} onSend={ask} onStop={stop} />
      <CitationSheet citation={citation} names={names} onClose={() => setCitation(null)} />
    </KeyboardAvoidingView>
  )

  return (
    <>
      {/* The tab bar's own header is off: this screen draws one that moves with the chat. */}
      <Tabs.Screen options={{ headerShown: false }} />
    {split ? (
      // Wide iPad: the list is a column beside the chat, open at first.
      <View className="flex-1">
        {header}
        <View className="flex-1 flex-row">
          {listOpen && (
            <View className="w-[320px]">
              <ChatList activeId={openId} onOpen={openChat} onNewChat={newChat} onPreferences={openPreferences} onDeleted={forget} />
            </View>
          )}
          {chat}
        </View>
      </View>
    ) : (
      // Phone: the list is a drawer under the chat, which slides aside to show it.
      <ChatsPanel
        open={listOpen}
        onClose={() => setListOpen(false)}
        list={<ChatList activeId={openId} onOpen={openChat} onNewChat={newChat} onPreferences={openPreferences} onDeleted={forget} />}
      >
        <View className="flex-1">
          {header}
          {chat}
        </View>
      </ChatsPanel>
    )}
    </>
  )
}
