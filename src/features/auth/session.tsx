// Who is signed in (MB-01). Wraps the app in src/app/_layout.tsx, which picks
// sign-in or the list from `status`. Calls the gateway's /api/auth routes.
// MB-10: remembers the last engineer, so a launch with no signal carries on.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, NetworkError, request, setOnSessionExpired } from '@/lib/api'
import { device, read, remove, setOwner, write } from '@/lib/store'

export type User = { id: string; role: string; name: string }

const EXPIRED = 'Your session ended after 15 minutes without activity. Sign in again.'

type Session = {
  // 'checking' while the launch check of an earlier session runs (AC5).
  status: 'checking' | 'signedIn' | 'signedOut'
  user: User | null
  // Why the engineer is back on sign-in, e.g. an expired session (AC6).
  notice: string | null
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<Session['status']>('checking')
  const [notice, setNotice] = useState<string | null>(null)

  // Their folder on the phone (src/lib/store.ts), and who to carry on as
  // offline.
  const begin = useCallback((user: User) => {
    setOwner(user.id)
    write('last-user', user, device())
    setUser(user)
    setStatus('signedIn')
  }, [])

  const end = useCallback((why: string | null) => {
    setUser(null)
    setNotice(why)
    setStatus('signedOut')
  }, [])

  // 1. On launch, reuse a session the cookie still holds (AC5); a 401 just
  //    means sign in. 2. Any later 401 signs out with the AC6 notice.
  useEffect(() => {
    request<{ user: User }>('/api/auth/me')
      .then(({ user }) => begin(user))
      .catch((error) => {
        // No signal: carry on as the last engineer, with what's on the phone
        // (MB-10 AC1). The gateway still checks their session once it's back.
        const last = error instanceof NetworkError ? read<User>('last-user', device()) : undefined
        if (last) return begin(last)
        // A 401 needs no message. Anything else (no signal, a 500) says what failed.
        end(error instanceof ApiError && error.status === 401 ? null : error.message)
      })
    // Forgotten too, so the next person to open this phone offline isn't
    // carried on as an engineer whose session has ended. Their queue stays.
    setOnSessionExpired(() => {
      remove('last-user', device())
      end(EXPIRED)
    })
  }, [begin, end])

  const signIn = useCallback(async (email: string, password: string) => {
    const { user } = await request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setNotice(null)
    begin(user)
  }, [begin])

  // Signs out locally even if the gateway can't be reached, so the engineer
  // is never stuck signed in on a shared phone.
  const signOut = useCallback(async () => {
    await request('/api/auth/logout', { method: 'POST' }).catch(() => {})
    // Not carried on as offline either. Their queue stays, for their next sign-in.
    remove('last-user', device())
    end(null)
  }, [end])

  return (
    <SessionContext.Provider value={{ status, user, notice, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside SessionProvider')
  return session
}
