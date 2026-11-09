// Chatbot tab (MB-06): ask the knowledge base and read cited answers. Each
// answer streams from the gateway's POST /api/chat (a paid model call), and its
// citations open their source passage. Replaces MB-01's placeholder.
// MB-14: the two-line button at the header's left opens my saved chats, as ChatGPT's does. On a
// phone the chat, header and all, slides aside to show the list under it; on a wide iPad the
// list is a column beside the chat (shown at first). So the header is drawn here, not by the
// tab bar, to move with the chat.
import { Tabs } from 'expo-router'
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
import { Starters } from '../components/Starters'
import { useConversation } from '../useConversation'

// The navy bar's height under the status bar.
const HEADER = 56

export default function Chat() {
  const { turns, busy, openId, send, stop, retry, reset, open, forget } = useConversation()
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
    setProblem(null)
    open(id).then(
      () => !split && setListOpen(false),
      (e) => setProblem(errorText(e)),
    )
  }

  // New chat from the list: the starter questions, and the list closes on a phone.
  function newChat() {
    reset()
    if (!split) setListOpen(false)
  }

  function ask(question: string) {
    if (names.size === 0) loadNames()
    atBottom.current = true
    send(question)
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
        <Text className="text-lg font-semibold text-white">Chatbot</Text>
        {turns.length > 0 ? (
          <Button variant="header" accessibilityLabel="New chat" onPress={reset} className="px-3">
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
      {problem && <Text className="px-4 pb-2 text-destructive">{problem}</Text>}
      <Composer busy={busy} onSend={ask} onStop={stop} />
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
              <ChatList activeId={openId} onOpen={openChat} onNewChat={newChat} onDeleted={forget} />
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
        list={<ChatList activeId={openId} onOpen={openChat} onNewChat={newChat} onDeleted={forget} />}
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
