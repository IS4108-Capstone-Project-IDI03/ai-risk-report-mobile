// Sign-in screen (MB-01 AC1-AC4, AC6). Shown by src/app/_layout.tsx while
// signed out. Mirrors the web sign-in: Marsh navy page, brand line, white card.
// Shows the gateway's own error text, e.g. wrong password or lockout.
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { useSession } from '../session'

export default function SignIn() {
  const { signIn, notice } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    // The keyboard's return key bypasses the disabled button. A second login
    // request would count twice toward the gateway's 5-try lockout (AC3).
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-navy">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Scrolls so the button stays reachable above the keyboard on small phones. */}
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-4 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6 flex-row items-baseline gap-2 px-1">
            <Text className="text-xl font-semibold text-white">Marsh</Text>
            <Text className="text-base text-white/60">Site Capture</Text>
          </View>

          <Card className="gap-5">
            <CardHeader className="gap-2">
              <CardTitle className="text-3xl font-bold">Sign in</CardTitle>
              <CardDescription className="text-base">
                Use your Marsh work account to reach your assessments.
              </CardDescription>
            </CardHeader>

            <CardContent className="gap-4">
              <View className="gap-2">
                <Text className="font-medium">Work email</Text>
                <Input
                  accessibilityLabel="Work email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="username"
                  returnKeyType="next"
                />
              </View>
              <View className="gap-2">
                <Text className="font-medium">Password</Text>
                <Input
                  accessibilityLabel="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
              </View>

              {/* A fresh error from this screen replaces the notice that brought us here. */}
              {(error || notice) && (
                <View
                  className={error ? 'rounded-md bg-destructive/10 p-3' : 'rounded-md bg-info p-3'}
                  accessibilityLiveRegion="polite"
                >
                  <Text className={error ? 'text-destructive' : 'text-info-foreground'}>
                    {error ?? notice}
                  </Text>
                </View>
              )}

              <Button
                size="lg"
                accessibilityLabel="Sign in"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={submit}
                className="mt-1"
              >
                {busy ? <ActivityIndicator color="#ffffff" /> : <Text>Sign in</Text>}
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
