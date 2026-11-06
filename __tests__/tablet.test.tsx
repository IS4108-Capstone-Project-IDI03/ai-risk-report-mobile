// MB-09: tablets rotate, phones stay portrait. The device's own size decides,
// not the window's, so an iPad in Split View still counts as a tablet.
import { Dimensions } from 'react-native'
import { isTablet, orientation } from '@/lib/device'

const screen = (width: number, height: number) =>
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height, scale: 2, fontScale: 1 })

afterEach(() => jest.restoreAllMocks())

describe('isTablet', () => {
  it('is false for a phone (AC5)', () => {
    expect(isTablet({ width: 390, height: 844 })).toBe(false)
  })

  it('is true for the smallest iPad and for a tablet held sideways (AC5)', () => {
    expect(isTablet({ width: 744, height: 1133 })).toBe(true)
    expect(isTablet({ width: 1194, height: 834 })).toBe(true)
  })
})

describe('orientation', () => {
  it('keeps a phone in portrait (AC5)', () => {
    screen(390, 844)
    expect(orientation()).toBe('portrait')
  })

  it('lets a tablet turn (AC5)', () => {
    screen(834, 1194)
    expect(orientation()).toBe('default')
    expect(Dimensions.get).toHaveBeenCalledWith('screen')
  })
})
