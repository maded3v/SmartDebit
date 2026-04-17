import { createContext } from 'react'
import type { AuthSession, LoginPayload, RegisterPayload } from './types'

export interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  isReady: boolean
  login: (payload: LoginPayload) => Promise<AuthSession>
  register: (payload: RegisterPayload) => Promise<AuthSession>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
