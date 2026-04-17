export interface AuthSession {
  fullName: string
  email: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  fullName: string
  email: string
  password: string
}

export interface AuthAdapter {
  getSession: () => Promise<AuthSession | null>
  login: (payload: LoginPayload) => Promise<AuthSession>
  register: (payload: RegisterPayload) => Promise<AuthSession>
  logout: () => Promise<void>
}
