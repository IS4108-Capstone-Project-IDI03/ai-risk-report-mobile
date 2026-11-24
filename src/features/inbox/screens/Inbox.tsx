// The Inbox (MB-22, web F-10): the work that needs this engineer, as To do and Done lists. Opened from
// Home's header (src/app/inbox.tsx). Calls useInbox for the rows and what a person does to them, and
// draws InboxRow. Online it reads the gateway; offline it shows the last copy, read only.
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { todayIso } from '@/features/calendar/calendar'
import { OfflineNote } from '@/features/offline/components/OfflineNote'
import { cn } from '@/lib/utils'
import { InboxRow } from '../components/InboxRow'
import { useInbox } from '../useInbox'

export default function Inbox() {
  const r = useInbox()
  const today = todayIso()
  const tabs = [
    { key: 'todo' as const, label: 'To do', count: r.todo },
    { key: 'done' as const, label: 'Done', count: 0 },
  ]
  return (
    <SafeAreaView testID="inbox" edges={['bottom']} className="flex-1 bg-background">
      <View className="flex-row border-b border-border bg-card">
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            accessibilityRole="button"
            accessibilityLabel={t.count > 0 ? `${t.label}, ${t.count}` : t.label}
            accessibilityState={{ selected: r.tab === t.key }}
            onPress={() => r.setTab(t.key)}
            className={cn('h-12 flex-1 flex-row items-center justify-center gap-1 border-b-2 active:opacity-60', r.tab === t.key ? 'border-primary' : 'border-transparent')}
          >
            <Text className={cn('font-semibold', r.tab !== t.key && 'text-muted-foreground')}>{t.label}</Text>
            {t.count > 0 && <Text className="font-semibold text-destructive">{t.count}</Text>}
          </Pressable>
        ))}
      </View>
      {r.offline && (
        <View className="gap-2 px-4 pt-3">
          <OfflineNote />
          <Text className="text-sm text-muted-foreground">Connect to change your Inbox.</Text>
        </View>
      )}
      {r.problem && <Text className="px-4 pt-3 text-destructive">{r.problem}</Text>}
      {!r.loaded ? (
        r.error ? (
          <View className="items-start gap-3 p-4">
            <Text className="text-destructive">{r.error}</Text>
            <Button variant="outline" onPress={r.refresh}>
              <Text>Try again</Text>
            </Button>
          </View>
        ) : (
          <ActivityIndicator className="mt-8" />
        )
      ) : (
        <FlatList
          testID="inbox-list"
          data={r.items}
          // A page is 20 rows; without this the list draws 10 first.
          initialNumToRender={20}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <InboxRow item={item} today={today} offline={r.offline} onOpen={r.open} onToggle={r.toggle} onRemove={r.remove} />}
          refreshControl={<RefreshControl refreshing={r.refreshing} onRefresh={r.refresh} />}
          ListEmptyComponent={<Text className="p-6 text-center text-muted-foreground">{r.tab === 'todo' ? 'All done. Nothing needs you.' : 'Nothing done yet.'}</Text>}
          ListFooterComponent={
            r.hasMore && !r.offline ? (
              <Button variant="ghost" className="m-3" disabled={r.loadingMore} onPress={r.loadMore}>
                <Text>{r.loadingMore ? 'Loading…' : 'Load more'}</Text>
              </Button>
            ) : undefined
          }
        />
      )}
    </SafeAreaView>
  )
}
