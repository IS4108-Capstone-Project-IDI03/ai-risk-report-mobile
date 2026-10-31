// Phone or tablet (MB-08). Called by src/app/_layout.tsx, which lets tablets
// turn and keeps phones in portrait.
import { Dimensions } from 'react-native'

// A tablet's shortest side is 600pt or more: Android's sw600dp line, and the
// smallest iPad (mini) is 744pt. The device's size, not the window's, so an
// iPad in Split View or Stage Manager still counts as a tablet.
export const isTablet = ({ width, height }: { width: number; height: number }) => Math.min(width, height) >= 600

// For Expo Router's `orientation` screen option. 'default' follows the device.
export const orientation = () => (isTablet(Dimensions.get('screen')) ? 'default' : 'portrait')
