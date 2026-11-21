// Root layout (MB-01). Loads the styles, then shows sign-in or the
// assessment list depending on the session (src/features/auth/session.tsx).
// Stack.Protected hides a screen while its guard is false, so a signed-out
// engineer can't reach the list.
import '../../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ActivityIndicator, Dimensions, View } from 'react-native'
import { SessionProvider, useSession } from '@/features/auth/session'
import { CurrentLocationProvider } from '@/features/locations/current'
import { OfflineProvider } from '@/features/offline/provider'
import { isTablet, orientation } from '@/lib/device'
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
      // Tablets turn; phones stay portrait (MB-09). app.json allows every
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
        {/* Over the workspace, on the phone and the iPad alike (MB-11). */}
        <Stack.Screen
          name="assessment/[reference]/observation/[id]"
          options={{ title: 'Observation', headerBackButtonDisplayMode: 'minimal' }}
        />
        {/* Its own header (title, no back arrow): Cancel at the bottom asks first (MB-12). */}
        <Stack.Screen name="assessment/[reference]/observation/[id]/edit" options={{ title: 'Edit observation' }} />
        {/* Its own Cancel at the bottom asks nothing: nothing is lost but the typed text (MB-17). */}
        <Stack.Screen name="assessment/[reference]/observation/[id]/page-text" options={{ title: 'Edit text', headerBackButtonDisplayMode: 'minimal' }} />
        <Stack.Screen name="assessment/[reference]/locations" options={{ presentation: 'modal' }} />
        {/* A site walk: record it, then review what the AI proposed (MB-16). */}
        <Stack.Screen name="assessment/[reference]/site-walks" options={{ title: 'Site walks', headerBackButtonDisplayMode: 'minimal' }} />
        <Stack.Screen name="assessment/[reference]/scans" options={{ title: 'Scans', headerBackButtonDisplayMode: 'minimal' }} />
        {/* MarshBot's chat, opened from the Overview bar (MB-20). */}
        <Stack.Screen name="assessment/[reference]/assistant" options={{ title: 'MarshBot', headerBackButtonDisplayMode: 'minimal' }} />
        <Stack.Screen name="assessment/[reference]/site-walk-recording" options={{ title: 'Record a walk', headerBackButtonDisplayMode: 'minimal' }} />
        <Stack.Screen name="assessment/[reference]/site-walk-review" options={{ title: 'Review a walk', headerBackButtonDisplayMode: 'minimal' }} />
        {/* The chatbot's lasting facts about me (MB-15). */}
        <Stack.Screen name="preferences" options={{ presentation: 'modal', title: 'My preferences' }} />
        <Stack.Screen name="new-assessment" options={{ presentation: 'modal', title: 'New assessment' }} />
        {/* Where the site and its blocks are, with directions and Move here (MB-02). */}
        <Stack.Screen name="assessment/[reference]/site-pins" options={{ title: 'Site pins', headerBackButtonDisplayMode: 'minimal' }} />
        {/* Full screen on a phone; a centred sheet on a tablet (MB-09). No swipe
            to dismiss: closing goes through Discard? (MB-03 AC13). */}
        <Stack.Screen
          name="assessment/[reference]/capture"
          options={{
            presentation: isTablet(Dimensions.get('screen')) ? 'modal' : 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  )
}

export default function Layout() {
  return (
    // The swipe rows (MB-12) need this around the screens to read gestures.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        {/* Light icons on the navy header and sign-in page. */}
        <StatusBar style="light" />
        <CurrentLocationProvider>
          {/* Inside the location provider: an uploaded location replaces the
              queued one the engineer is at (MB-10). */}
          <OfflineProvider>
            <Screens />
          </OfflineProvider>
        </CurrentLocationProvider>
      </SessionProvider>
    </GestureHandlerRootView>
  )
}
