// Root layout (MB-01). Loads the fonts and styles, then shows sign-in or the
// assessment list depending on the session (src/features/auth/session.tsx).
// Stack.Protected hides a screen while its guard is false, so a signed-out
// engineer can't reach the list.
import '../../global.css'
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono'
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { SessionProvider, useSession } from '@/features/auth/session'
import { CurrentLocationProvider } from '@/features/locations/current'
import { orientation } from '@/lib/device'
import { colors, headerOptions } from '@/lib/nav'

function Screens() {
  const { status } = useSession()
  // Wait for the launch check, so a signed-in engineer never sees sign-in flash.
  if (status === 'checking') {
    return (
      <View className="flex-1 items-center justify-center bg-navy">
        <ActivityIndicator color="#ffffff" />
      </View>
    )
  }
  return (
    <Stack
      // Tablets turn; phones stay portrait (MB-08). app.json allows every
      // orientation, so this is what keeps a phone upright.
      screenOptions={{ ...headerOptions, contentStyle: { backgroundColor: colors.page }, orientation: orientation() }}
    >
      <Stack.Protected guard={status === 'signedIn'}>
        {/* The tabs draw their own headers (src/app/(tabs)/_layout.tsx). */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Pushed over the tabs; the back button shows only its arrow. */}
        <Stack.Screen
          name="assessment/[reference]/index"
          options={{ headerBackButtonDisplayMode: 'minimal' }}
        />
        <Stack.Screen name="assessment/[reference]/locations" options={{ presentation: 'modal' }} />
        {/* Full screen, no swipe to dismiss: closing goes through Discard? (MB-03 AC13). */}
        <Stack.Screen
          name="assessment/[reference]/capture"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  )
}

export default function Layout() {
  // Bundled fonts look the same on iOS and Android; the system fonts differ.
  const [loaded, error] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
  })
  // A font that fails to load falls back to the system font rather than
  // leaving the engineer on a blank screen.
  if (!loaded && !error) return null

  return (
    <SessionProvider>
      {/* Light icons on the navy header and sign-in page. */}
      <StatusBar style="light" />
      <CurrentLocationProvider>
        <Screens />
      </CurrentLocationProvider>
    </SessionProvider>
  )
}
