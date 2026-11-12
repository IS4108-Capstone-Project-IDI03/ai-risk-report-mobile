// Sign in with no signal (MB-10 AC9). After each sign-in with a signal, the phone
// keeps a salted hash (a scrambled fingerprint, not the password) in its keychain.
// With no signal, the same email and password are checked against it. Called by
// session.tsx, which signs the engineer in as that user.
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import type { User } from './session'

type Saved = { user: User; salt: string; hash: string }

// Never copied to another phone, and only readable while this one is unlocked.
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }

// ponytail: one salted SHA-256, guarded by the keychain, and no limit on wrong
// guesses. A slow hash (PBKDF2, bcrypt) or a lockout would need more code or a
// native module; add one if guessing on a stolen, unlocked phone ever matters.
const sha = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text)
const same = (email: string) => email.trim().toLowerCase()
// The keychain's keys can't hold "@", so the key is the email's own hash.
const keyFor = async (email: string) => `signin-${await sha(same(email))}`
const fingerprint = (salt: string, email: string, password: string) => sha(`${salt}:${same(email)}:${password}`)

// Saved after the gateway accepts a sign-in; replaces an older one, so a changed
// password works offline too. A failure is left to the caller to ignore.
export async function remember(email: string, password: string, user: User) {
  const salt = Crypto.randomUUID()
  const saved: Saved = { user, salt, hash: await fingerprint(salt, email, password) }
  await SecureStore.setItemAsync(await keyFor(email), JSON.stringify(saved), OPTIONS)
}

// Dropped when the gateway refuses the email and password, e.g. after the password
// was changed on the web, so the old one can't get in offline.
export async function forget(email: string) {
  await SecureStore.deleteItemAsync(await keyFor(email), OPTIONS)
}

// The saved engineer if the email and password match; null if this phone has
// never signed that email in; throws if the password is wrong.
export async function recall(email: string, password: string): Promise<User | null> {
  let saved: Saved | null
  try {
    const text = await SecureStore.getItemAsync(await keyFor(email), OPTIONS)
    saved = text ? (JSON.parse(text) as Saved) : null
  } catch {
    // An unreadable keychain or entry counts as nothing saved, so the engineer
    // sees "Can't reach the server" (what failed), not a stray parse error.
    return null
  }
  if (!saved) return null
  if ((await fingerprint(saved.salt, email, password)) !== saved.hash) throw new Error('Wrong email or password.')
  return saved.user
}
