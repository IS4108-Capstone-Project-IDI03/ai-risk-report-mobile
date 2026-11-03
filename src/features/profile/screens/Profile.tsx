// Profile tab (MB-01 AC7): who is signed in, and Sign out. The name and role
// come from the session (GET /api/auth/me or the login reply).
import { LogOut } from 'lucide-react-native'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { useSession } from '@/features/auth/session'

// The gateway's role ids (server/src/models/user.model.ts) as the web app words them.
const ROLE: Record<string, string> = {
  risk_engineer: 'Risk engineer',
  knowledge_admin: 'Knowledge admin',
}

// "Ava Tan" → "AT", for the avatar circle.
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export default function Profile() {
  const { user, signOut } = useSession()
  if (!user) return null

  return (
    <View className="flex-1 gap-4 p-4">
      <Card className="flex-row items-center gap-4 px-4 py-4">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-navy">
          <Text className="text-lg font-semibold text-white">{initials(user.name)}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-semibold">{user.name}</Text>
          <Text className="text-muted-foreground">{ROLE[user.role] ?? user.role}</Text>
        </View>
      </Card>

      <Button variant="outline" size="lg" accessibilityLabel="Sign out" onPress={signOut}>
        <LogOut color="#1a1f26" size={20} />
        <Text>Sign out</Text>
      </Button>
    </View>
  )
}
