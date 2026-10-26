// Header and tab bar styles for the root stack and the tabs (MB-01). Navigation
// styles can't take Tailwind classes, so these repeat tailwind.config.js.
export const colors = {
  navy: '#000f47',
  page: '#f7f9fc',
  primary: '#2c5488', // ink-600, the selected tab
  muted: '#545e6b', // graphite-600, the other tabs
  border: '#e0e5ec',
}

// Navy header with a white title, as the web app's navy sidebar carries the wordmark.
export const headerOptions = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: '#ffffff',
  headerTitleStyle: { fontFamily: 'IBMPlexSans_600SemiBold' },
  headerShadowVisible: false,
}
