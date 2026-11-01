// Runs before each test (package.json `jest.setupFilesAfterEnv`): clears the
// in-memory phone files from test/setup.ts (MB-10).
beforeEach(() => {
  ;(jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files.clear()
})
