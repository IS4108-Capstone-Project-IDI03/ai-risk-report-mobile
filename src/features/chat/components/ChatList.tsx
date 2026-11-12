// My saved chats (MB-14 AC3-AC9), drawn as the web's navy sidebar: a title, a search field, one
// plain row per chat (name and date), and New chat at the bottom, in thumb reach. Tap a row to
// open it; the "…" at its end (or a press and hold) opens Rename and Delete, which screen
// readers are also offered as actions.
// Used by screens/Chat, as a drawer under the chat on a phone and a column beside it on a wide
// iPad. Calls listThreads (the plain list is kept on the phone, so it opens offline),
// renameThread and deleteThread.
import { Ellipsis, Plus, Search, SlidersHorizontal } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { formatDate } from '@/features/assessments/format'
import { errorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import { deleteThread, listThreads, renameThread, type Thread } from '../api'

type Props = {
  // The chat on screen, marked in the list.
  activeId?: string | null
  onOpen(id: string): void
  onNewChat(): void
  // Opens My preferences (MB-15 AC1).
  onPreferences(): void
  // After a delete, so the chat screen can start over if it was the open one.
  onDeleted?(id: string): void
}

const SOFT = '#b9c4d6' // the web sidebar's quiet text on navy

export function ChatList({ activeId, onOpen, onNewChat, onPreferences, onDeleted }: Props) {
  const [threads, setThreads] = useState<Thread[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Renaming: which chat and the name typed so far.
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null)
  // Only the newest read counts, so a slow reply to an old search can't replace a newer one.
  const newest = useRef(0)
  // The status bar sits above the top of the drawer; this keeps the title clear of it.
  const insets = useSafeAreaInsets()

  const load = useCallback((q: string) => {
    const mine = ++newest.current
    listThreads(q).then(
      ({ threads: all }) => {
        if (mine !== newest.current) return
        setThreads(all)
        setError(null)
      },
      (e) => mine === newest.current && setError(errorText(e)),
    )
  }, [])
  useEffect(() => load(query), [load, query])

  async function saveName() {
    if (!renaming?.title.trim()) return
    try {
      const saved = await renameThread(renaming.id, renaming.title.trim())
      setThreads((all) => all?.map((t) => (t.id === saved.id ? { ...t, title: saved.title } : t)) ?? all)
      setRenaming(null)
      setError(null)
    } catch (e) {
      setError(errorText(e))
    }
  }

  function confirmDelete(t: Thread) {
    Alert.alert('Delete this chat?', `“${t.title}” and its answers are removed from your chats.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteThread(t.id)
            setThreads((all) => all?.filter((x) => x.id !== t.id) ?? all)
            onDeleted?.(t.id)
          } catch (e) {
            setError(errorText(e))
            load(query)
          }
        },
      },
    ])
  }

  // Press and hold: the native menu of what can be done to a chat.
  function actions(t: Thread) {
    Alert.alert(t.title, undefined, [
      { text: 'Rename', onPress: () => setRenaming({ id: t.id, title: t.title }) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(t) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <View testID="chat-list" className="flex-1 bg-navy" style={{ paddingTop: insets.top }}>
      <Text className="px-5 pb-3 pt-3 text-2xl font-bold text-white">Chats</Text>
      <View className="mx-4 mb-2 h-12 flex-row items-center gap-2 rounded-xl bg-white/10 px-3">
        <Search color={SOFT} size={18} />
        <TextInput
          accessibilityLabel="Search chats"
          value={query}
          onChangeText={setQuery}
          placeholder="Search chats"
          placeholderTextColor={SOFT}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          className="h-12 flex-1 text-base text-white"
        />
      </View>
      {error && (
        <View className="mx-4 mb-2 rounded-lg bg-destructive/20 p-3">
          <Text className="text-white">{error}</Text>
        </View>
      )}
      <FlatList
        data={threads ?? []}
        keyExtractor={(t) => t.id}
        contentContainerClassName="px-2 pb-4"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          threads ? <Text className="px-3 py-6 text-center" style={{ color: SOFT }}>{query.trim() ? 'No chats match.' : 'No chats yet.'}</Text> : undefined
        }
        renderItem={({ item }) =>
          renaming?.id === item.id ? (
            <View className="m-1 gap-2 rounded-xl bg-white/10 p-3">
              <TextInput
                accessibilityLabel="Chat name"
                value={renaming.title}
                onChangeText={(title) => setRenaming({ id: item.id, title })}
                maxLength={120}
                autoFocus
                className="h-12 rounded-lg bg-white px-3 text-base text-foreground"
              />
              <View className="flex-row gap-2">
                <Button accessibilityLabel="Save name" className="flex-1 bg-white" disabled={!renaming.title.trim()} onPress={saveName}>
                  <Text className="text-primary">Save</Text>
                </Button>
                <Button variant="header" accessibilityLabel="Cancel rename" className="flex-1 border border-white/30" onPress={() => setRenaming(null)}>
                  <Text>Cancel</Text>
                </Button>
              </View>
            </View>
          ) : (
            <View className={cn('min-h-14 flex-row items-center rounded-xl', item.id === activeId && 'bg-white/15')}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}
                accessibilityActions={[{ name: 'rename', label: 'Rename' }, { name: 'delete', label: 'Delete' }]}
                onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'rename' ? setRenaming({ id: item.id, title: item.title }) : confirmDelete(item))}
                onPress={() => onOpen(item.id)}
                onLongPress={() => actions(item)}
                className="min-h-14 flex-1 justify-center rounded-xl px-3 py-2 active:bg-white/10"
              >
                <Text testID="chat-title" className="text-base font-medium text-white" numberOfLines={2}>{item.title}</Text>
                <Text className="text-sm" style={{ color: SOFT }}>{formatDate(item.createdAt.slice(0, 10))}</Text>
              </Pressable>
              {/* The same menu as press and hold, for those who don't know to hold. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`More for ${item.title}`}
                onPress={() => actions(item)}
                className="h-12 w-12 items-center justify-center rounded-full active:bg-white/10"
              >
                <Ellipsis color={SOFT} size={22} />
              </Pressable>
            </View>
          )
        }
      />
      {/* In thumb reach, as the app's other main actions. */}
      <View className="gap-1 px-4 pb-4 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My preferences"
          onPress={onPreferences}
          className="min-h-12 flex-row items-center gap-3 rounded-xl px-3 active:bg-white/10"
        >
          <SlidersHorizontal color={SOFT} size={18} />
          <Text className="text-base text-white">My preferences</Text>
        </Pressable>
        <Button accessibilityLabel="Start a new chat" className="bg-white" onPress={onNewChat}>
          <Plus color="#000f47" size={20} />
          <Text className="text-primary">New chat</Text>
        </Button>
      </View>
    </View>
  )
}
