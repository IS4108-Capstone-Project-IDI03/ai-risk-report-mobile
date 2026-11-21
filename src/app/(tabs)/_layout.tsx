// Bottom tabs shown once signed in (MB-01): Home (assessments, with New assessment, MB-21), Calendar (MB-19),
// Chatbot and Profile. Each tab has the navy header; the tab bar is white with the
// selected tab in ink blue, as the web app marks its active nav item.
import { router, Tabs } from 'expo-router'
import { CalendarDays, House, MessageCircle, Plus, UserRound } from 'lucide-react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
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
          // Start an assessment (MB-21): a plus with its word, in the navy header.
          headerRight: () => (
            <Button variant="header" accessibilityLabel="New assessment" onPress={() => router.push('/new-assessment')} className="mr-2">
              <Plus color="#ffffff" size={18} />
              <Text>New</Text>
            </Button>
          ),
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
