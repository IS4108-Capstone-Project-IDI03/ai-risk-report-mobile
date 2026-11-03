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
  return { File, Directory, Paths: { document: new Directory('file:///document') }, __files: files }
})
