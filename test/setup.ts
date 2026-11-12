// Runs before every test file (package.json `jest.setupFiles`). expo-audio and
// expo-image-picker need a phone's native code, which Jest doesn't have, and
// every test loads them through the route map. These do nothing; tests that
// drive them (__tests__/capture.test.tsx) mock them with their own behaviour.
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => ({}),
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0 }),
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn(),
}))

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}))

// MB-10: the phone's files, kept in memory. test/reset.ts clears them before
// each test, so a copy or queue never leaks from one test into the next.
// `__files` lets a test look at what was written.
jest.mock('expo-file-system', () => {
  const files = new Map<string, string>()
  const join = (parts: (string | { uri: string })[]) =>
    parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/')
  class Directory {
    uri: string
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(parts)
    }
    get exists() {
      return [...files.keys()].some((key) => key.startsWith(`${this.uri}/`))
    }
    create() {}
    delete() {
      for (const key of [...files.keys()]) if (key.startsWith(`${this.uri}/`)) files.delete(key)
    }
  }
  class File {
    uri: string
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(parts)
    }
    get exists() {
      return files.has(this.uri)
    }
    get name() {
      return this.uri.split('/').pop()
    }
    create() {
      files.set(this.uri, files.get(this.uri) ?? '')
    }
    textSync() {
      return files.get(this.uri) ?? ''
    }
    writeSync(text: string) {
      files.set(this.uri, text)
    }
    write(bytes: Uint8Array) {
      files.set(this.uri, `${bytes.length} bytes`)
    }
    delete() {
      files.delete(this.uri)
    }
    moveSync(to: File) {
      files.set(to.uri, files.get(this.uri) ?? '')
      files.delete(this.uri)
    }
    async copy(to: File) {
      files.set(to.uri, files.get(this.uri) ?? '')
    }
  }
  return { File, Directory, Paths: { document: new Directory('file:///document'), cache: new Directory('file:///cache') }, __files: files }
})

// MB-10 AC9: the keychain and hashing, in memory. test/reset.ts clears the store
// before each test; `__items` lets a test look at what was saved.
jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>()
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => void items.set(key, value),
    deleteItemAsync: async (key: string) => void items.delete(key),
    __items: items,
  }
})

jest.mock('expo-crypto', () => {
  const { createHash, randomUUID } = jest.requireActual('crypto')
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algorithm: string, text: string) => createHash('sha256').update(text).digest('hex'),
    randomUUID,
  }
})

// MB-12: Jest can't swipe, so the swipe row shows its actions beside the row, where a
// test can press them. The gesture itself is checked by hand.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = jest.requireActual('react-native')
  const React = jest.requireActual('react')
  return {
    __esModule: true,
    default: ({
      children,
      renderRightActions,
    }: {
      children: React.ReactNode
      renderRightActions?: (...args: unknown[]) => React.ReactNode
    }) => React.createElement(View, null, children, renderRightActions?.(undefined, undefined, { close: () => {} })),
  }
})
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual('react-native').View,
  // MB-14: the chats panel's swipe-to-close; Jest can't swipe, so it only has to render.
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  usePanGesture: () => ({}),
}))
// The blur is a native view; Jest only needs it to render (MB-14 chats drawer).
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }))
// The phone's GPS (MB-02 AC13): granted, with a fix at the Marina Point example. A test changes
// these to try a refusal or a failed fix.
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 1.2966124, longitude: 103.8520338, accuracy: 8.4 } })),
  Accuracy: { Balanced: 3, High: 4 },
}))
// MB-02 AC25-AC27: Jest has no map. The map is a plain View that passes its props through, so a test
// can press a marker or call its onDragEnd; moving the camera does nothing.
jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native')
  const React = jest.requireActual('react')
  const MapView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ fitToCoordinates: () => {}, animateToRegion: () => {} }))
    return React.createElement(View, props, props.children)
  })
  const Marker = (props: Record<string, unknown>) => React.createElement(View, props, props.children)
  return { __esModule: true, default: MapView, Marker }
})
