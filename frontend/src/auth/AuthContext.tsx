import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { PropsWithChildren } from 'react'
import type { AuthAdapter, AuthSession, LoginPayload, RegisterPayload } from './types'
import { AuthContext } from './authState'
import type { AuthContextValue } from './authState'

interface AuthProviderProps extends PropsWithChildren {
  adapter: AuthAdapter
}

export function AuthProvider({ adapter, children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const restoredSession = await adapter.getSession()

        if (!cancelled) {
          setSession(restoredSession)
        }
      } finally {
        if (!cancelled) {
          setIsReady(true)
        }
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
    }
  }, [adapter])

  const login = useCallback(
    async (payload: LoginPayload) => {
      const nextSession = await adapter.login(payload)
      setSession(nextSession)
      return nextSession
    },
    [adapter],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const nextSession = await adapter.register(payload)
      setSession(nextSession)
      return nextSession
    },
    [adapter],
  )

  const logout = useCallback(async () => {
    await adapter.logout()
    setSession(null)
  }, [adapter])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      isReady,
      login,
      register,
      logout,
    }),
    [isReady, login, logout, register, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
