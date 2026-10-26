// Metro (Expo's bundler) with NativeWind reading global.css. inlineRem: 16 makes
// 1rem = 16px, the size React Native Reusables' classes are written for.
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './global.css', inlineRem: 16 })
