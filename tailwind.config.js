// Tailwind theme for Site Capture (MB-01). NativeWind turns these classes into
// React Native styles. Colours are the web app's tokens, copied as exact hex from
// ai-risk-report-generator/client/src/design-system/tokens/colors.css; the names
// (primary, muted, card ...) are the ones React Native Reusables components use.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    // Custom fonts on a phone need one family per weight: a fontWeight on its own
    // makes iOS fall back to the system font and Android fake a bold. So the
    // weight classes (font-medium, font-semibold ...) pick the IBM Plex family
    // of that weight instead, and the same text looks the same on both.
    fontWeight: {},
    fontFamily: {
      normal: ['IBMPlexSans_400Regular'],
      medium: ['IBMPlexSans_500Medium'],
      semibold: ['IBMPlexSans_600SemiBold'],
      bold: ['IBMPlexSans_700Bold'],
      mono: ['IBMPlexMono_400Regular'],
    },
    extend: {
      colors: {
        background: '#f7f9fc', // graphite-50, the page
        foreground: '#1a1f26', // graphite-900
        card: { DEFAULT: '#ffffff', foreground: '#1a1f26' },
        primary: { DEFAULT: '#2c5488', foreground: '#ffffff' }, // ink-600
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
      borderRadius: { md: '5px', lg: '8px' }, // web radius-md and radius-lg
    },
  },
  plugins: [],
}
