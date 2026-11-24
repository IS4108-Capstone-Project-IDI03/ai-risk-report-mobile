// Bottom tabs shown once signed in (MB-01): Home (assessments, with the Inbox icon, MB-22; New assessment, MB-21, is a round button on Home), Calendar (MB-19),
// Chatbot and Profile. Each tab has the navy header; the tab bar is white with the
// selected tab in ink blue, as the web app marks its active nav item.
import { Tabs } from 'expo-router'
import { CalendarDays, House, MessageCircle, UserRound } from 'lucide-react-native'
import { InboxButton } from '@/features/inbox/components/InboxButton'
import { colors, headerOptions } from '@/lib/nav'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        ...headerOptions,
        sceneStyle: { backgroundColor: colors.page },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontWeight: '500', fontSize: 12 },
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Assessments',
          tabBarLabel: 'Home',
          // The Inbox (MB-22): an icon alone at the top right. New assessment (MB-21) is the round button on Home.
          headerRight: () => <InboxButton />,
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chatbot',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
