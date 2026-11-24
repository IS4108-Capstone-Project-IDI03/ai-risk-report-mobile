// Phone or tablet (MB-09), and whether the window is wide enough for the split
// view (MB-09). Called by src/app/_layout.tsx, which lets tablets turn and keeps
// phones in portrait, and by Home, which splits on a wide window.
import { Dimensions, useWindowDimensions } from 'react-native'

// A tablet's shortest side is 600pt or more: Android's sw600dp line, and the
// smallest iPad (mini) is 744pt. The device's size, not the window's, so an
// iPad in Split View or Stage Manager still counts as a tablet.
export const isTablet = ({ width, height }: { width: number; height: number }) => Math.min(width, height) >= 600

// For Expo Router's `orientation` screen option. 'default' follows the device.
export const orientation = () => (isTablet(Dimensions.get('screen')) ? 'default' : 'portrait')

// The window, not the device: an iPad in Split View or Stage Manager can be
// narrow, and then gets the single column. 900pt: any iPad in landscape, and a
// 13-inch in portrait.
export const useSplitView = () => useWindowDimensions().width >= 900

// The Calendar (MB-19): a month grid from 700pt of window, a day list below it, and
// the two side lists beside the grid from 1080pt. The window, not the device, so an
// iPad in Split View gets the list. Web: 768 CSS px and 1080 px of content.
export const useCalendarGrid = () => useWindowDimensions().width >= 700
export const useCalendarSideLists = () => useWindowDimensions().width >= 1080
