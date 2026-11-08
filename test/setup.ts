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
