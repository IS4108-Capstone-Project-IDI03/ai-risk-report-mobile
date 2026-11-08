// Tailwind theme for Site Capture (MB-01). NativeWind turns these classes into
// React Native styles. Colours are the web app's tokens, copied as exact hex from
// ai-risk-report-generator/client/src/design-system/tokens/colors.css; the names
// (primary, muted, card ...) are the ones React Native Reusables components use.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    // The system font, as the web's design system v2 (one font, no second family):
    // San Francisco on iOS, Roboto on Android. Weight classes (font-medium ...)
    // are plain font weights; numbers that line up use `tabular-nums`.
    extend: {
      colors: {
        background: '#f7f9fc', // graphite-50, the page
        foreground: '#1a1f26', // graphite-900
        card: { DEFAULT: '#ffffff', foreground: '#1a1f26' },
        primary: { DEFAULT: '#000f47', foreground: '#ffffff' }, // Marsh navy: actions and titles (design system v2)
        secondary: { DEFAULT: '#e9f2fe', foreground: '#22406c' }, // ink-50 / ink-700, the tonal button
        muted: { DEFAULT: '#eef1f6', foreground: '#545e6b' }, // graphite-100 / 600
        accent: { DEFAULT: '#e9f2fe', foreground: '#22406c' },
        destructive: { DEFAULT: '#ad2e2d', foreground: '#ffffff' }, // red-600
        border: '#e0e5ec', // graphite-200
        input: '#ccd3dd', // graphite-300
        ring: '#3f6ea7', // ink-500
        navy: '#000f47', // Marsh navy: surfaces carrying the wordmark
        // Status chips, the web Badge tones (fg on bg).
        info: { DEFAULT: '#e9f2fe', foreground: '#2c5488' },
        success: { DEFAULT: '#e2f6ea', foreground: '#2f7049' },
        warning: { DEFAULT: '#fdf1d8', foreground: '#8f5f13' },
        // Severity: critical red, high oxblood (moderate and low reuse warning and success).
        critical: { DEFAULT: '#fdeae8', foreground: '#ad2e2d' },
        high: { DEFAULT: '#fdeae7', foreground: '#9e3e3b' },
      },
      // Cards 16, buttons and pills fully round, as the web's design system v2
      // (fields 10 is set on Input). 48px touch targets stay: the web's 40px
      // fields are too small for gloves.
      borderRadius: { sm: '8px', md: '12px', lg: '16px', xl: '20px' },
    },
  },
  plugins: [],
}
