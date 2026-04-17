import type { AuthAdapter, AuthSession, LoginPayload, RegisterPayload } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

interface ErrorPayload {
  message?: string
  detail?: string
  error?: string
}

interface AuthSessionEnvelope {
  data?: {
    user?: {
      full_name?: string
      email?: string
    }
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    let message = `Ошибка запроса (${response.status})`

    try {
      const payload = (await response.json()) as ErrorPayload
      message = payload.message || payload.detail || payload.error || message
    } catch {
      // ignore invalid error payloads
    }

    throw new Error(message)
  }

  return (await response.json()) as T
}

function mapSession(payload: AuthSessionEnvelope): AuthSession | null {
  const fullName = payload.data?.user?.full_name?.trim()
  const email = payload.data?.user?.email?.trim().toLowerCase()

  if (!fullName || !email) {
    return null
  }

  return {
    fullName,
    email,
  }
}

export function createBackendAuthAdapter(): AuthAdapter {
  return {
    async getSession() {
      try {
        const payload = await request<AuthSessionEnvelope>('/auth/session/', {
          method: 'GET',
        })
        return mapSession(payload)
      } catch {
        return null
      }
    },

    async login(payload: LoginPayload) {
      const response = await request<AuthSessionEnvelope>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const session = mapSession(response)
      if (!session) {
        throw new Error('Не удалось получить данные пользователя')
      }

      return session
    },

    async register(payload: RegisterPayload) {
      const response = await request<AuthSessionEnvelope>('/auth/register/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const session = mapSession(response)
      if (!session) {
        throw new Error('Не удалось получить данные пользователя')
      }

      return session
    },

    async logout() {
      await request('/auth/logout/', {
        method: 'POST',
      })
    },
  }
}
