// MB-10 AC9: sign in with no signal. An engineer who has signed in on this phone
// before signs in again with the same email and password; the phone checks them
// against what it saved. Renders the real routes, gateway mocked.
import * as SecureStore from 'expo-secure-store'
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { assessment, mockGateway, openTab, pointAtTestGateway, routes, signedIn, signedOut } from '../test/gateway'

pointAtTestGateway()

const REF = 'RPT-2026-0411'
const OFFLINE = "You're offline. Showing what was saved on this device."

async function signInWith(email: string, password: string) {
  await fireEvent.changeText(await screen.findByLabelText('Work email'), email)
  await fireEvent.changeText(screen.getByLabelText('Password'), password)
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
}

// Signs in with a signal, sees the list (so the phone saves a copy), signs out,
// and then the signal goes.
async function signedInOnceThenOffline() {
  mockGateway({
    'GET /api/auth/me': signedOut,
    'POST /api/auth/login': signedIn,
    'GET /api/assessments': { status: 200, body: [assessment(REF, 'capturing')] },
    'POST /api/auth/logout': { status: 204 },
  })
  await renderRouter(routes)
  await signInWith('ava@marsh.test', 'secret')
  await screen.findByText(REF)
  await openTab('Profile')
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }))
  await screen.findByLabelText('Work email')
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed')
  }) as unknown as typeof fetch
}

const keychain = () => (SecureStore as unknown as { __items: Map<string, string> }).__items

describe('sign in offline', () => {
  it('signs in with the same email and password, and shows the saved copy (AC9)', async () => {
    await signedInOnceThenOffline()

    await signInWith('ava@marsh.test', 'secret')

    expect(await screen.findByText(REF)).toBeTruthy()
    expect(await screen.findByText(OFFLINE)).toBeTruthy()
  })

  it('ignores capital letters in the email (AC9)', async () => {
    await signedInOnceThenOffline()

    await signInWith('Ava@Marsh.test', 'secret')

    expect(await screen.findByText(REF)).toBeTruthy()
  })

  it('refuses a wrong password, and stays on sign-in (AC9)', async () => {
    await signedInOnceThenOffline()

    await signInWith('ava@marsh.test', 'not-it')

    expect(await screen.findByText('Wrong email or password.')).toBeTruthy()
    expect(screen.queryByText(REF)).toBeNull()
  })

  it("says it can't reach the server for an email never used on this phone (AC9)", async () => {
    await signedInOnceThenOffline()

    await signInWith('someone.else@marsh.test', 'secret')

    expect(await screen.findByText("Can't reach the server. Check your connection, then try again.")).toBeTruthy()
  })

  it('never saves the password itself (AC9)', async () => {
    await signedInOnceThenOffline()

    expect(keychain().size).toBe(1)
    expect([...keychain().values()].some((value) => value.includes('secret'))).toBe(false)
  })

  it('does not save anything when the gateway refuses the sign-in (AC9)', async () => {
    mockGateway({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': { status: 401, body: { error: 'Email or password is incorrect.' } },
    })
    await renderRouter(routes)
    await signInWith('ava@marsh.test', 'wrong')
    await screen.findByText('Email or password is incorrect.')

    expect(keychain().size).toBe(0)
  })

  it('forgets what it saved once the gateway refuses that email and password (AC9)', async () => {
    await signedInOnceThenOffline()
    // The password was changed on the web: with a signal, the gateway refuses the old one.
    mockGateway({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': { status: 401, body: { error: 'Email or password is incorrect.' } },
    })
    await signInWith('ava@marsh.test', 'secret')
    await screen.findByText('Email or password is incorrect.')
    expect(keychain().size).toBe(0)

    // With no signal again, the old password no longer gets in.
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch
    await signInWith('ava@marsh.test', 'secret')

    expect(await screen.findByText("Can't reach the server. Check your connection, then try again.")).toBeTruthy()
  })

  it('treats a damaged saved entry as nothing saved (AC9)', async () => {
    await signedInOnceThenOffline()
    for (const key of keychain().keys()) keychain().set(key, 'not json')

    await signInWith('ava@marsh.test', 'secret')

    expect(await screen.findByText("Can't reach the server. Check your connection, then try again.")).toBeTruthy()
  })

  it("says the sign-in was without a signal, not that the session timed out, when the gateway refuses it later (AC9)", async () => {
    await signedInOnceThenOffline()
    // No signal at sign-in; the next call that reaches the gateway has no session.
    mockGateway({
      'POST /api/auth/login': new TypeError('Network request failed'),
      'GET /api/assessments': signedOut,
    })

    await signInWith('ava@marsh.test', 'secret')

    expect(
      await screen.findByText("You signed in without a signal. Sign in again to upload what you've captured."),
    ).toBeTruthy()
    expect(screen.queryByText(/after 15 minutes/)).toBeNull()
  })
})
