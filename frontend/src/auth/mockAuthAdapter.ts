import type { AuthAdapter, AuthSession, LoginPayload, RegisterPayload } from './types'

const AUTH_SESSION_STORAGE_KEY = 'smartdebit-auth-session'
const AUTH_USERS_STORAGE_KEY = 'smartdebit-auth-users'

interface StoredUser {
  fullName: string
  email: string
  password: string
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function buildDisplayNameFromEmail(email: string) {
  const localPart = email.split('@')[0] ?? ''
  const normalized = localPart.replace(/[._-]+/g, ' ').trim()

  if (!normalized) {
    return 'Клиент банка'
  }

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((token) => token.slice(0, 1).toUpperCase() + token.slice(1))
    .join(' ')
}

function parseStoredSession(rawValue: string | null): AuthSession | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthSession>

    if (typeof parsed.fullName !== 'string' || typeof parsed.email !== 'string') {
      return null
    }

    const fullName = parsed.fullName.trim()
    const email = normalizeEmail(parsed.email)

    if (!fullName || !isValidEmail(email)) {
      return null
    }

    return {
      fullName,
      email,
    }
  } catch {
    return null
  }
}

function parseStoredUsers(rawValue: string | null): StoredUser[] {
  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null
        }

        const user = entry as Partial<StoredUser>

        if (
          typeof user.fullName !== 'string' ||
          typeof user.email !== 'string' ||
          typeof user.password !== 'string'
        ) {
          return null
        }

        const fullName = user.fullName.trim()
        const email = normalizeEmail(user.email)
        const password = user.password.trim()

        if (!fullName || !isValidEmail(email) || !password) {
          return null
        }

        return {
          fullName,
          email,
          password,
        }
      })
      .filter((entry): entry is StoredUser => Boolean(entry))
  } catch {
    return []
  }
}

function readSession() {
  return parseStoredSession(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY))
}

function writeSession(session: AuthSession | null) {
  if (!session) {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

function readUsers() {
  return parseStoredUsers(window.localStorage.getItem(AUTH_USERS_STORAGE_KEY))
}

function writeUsers(users: StoredUser[]) {
  window.localStorage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(users))
}

function createSession(fullName: string, email: string): AuthSession {
  return {
    fullName: fullName.trim(),
    email: normalizeEmail(email),
  }
}

export function createMockAuthAdapter(): AuthAdapter {
  return {
    async getSession() {
      await delay(80)
      return readSession()
    },

    async login(payload: LoginPayload) {
      await delay(260)

      const email = normalizeEmail(payload.email)
      if (!isValidEmail(email)) {
        throw new Error('Укажите корректный email')
      }

      const users = readUsers()
      const existingUser = users.find((user) => user.email === email)

      if (existingUser) {
        if (existingUser.password !== payload.password) {
          throw new Error('Неверный пароль')
        }

        const session = createSession(existingUser.fullName, existingUser.email)
        writeSession(session)
        return session
      }

      const displayName = buildDisplayNameFromEmail(email)
      const fallbackUser: StoredUser = {
        fullName: displayName,
        email,
        password: payload.password,
      }

      writeUsers([...users, fallbackUser])

      const session = createSession(displayName, email)
      writeSession(session)
      return session
    },

    async register(payload: RegisterPayload) {
      await delay(320)

      const fullName = payload.fullName.trim()
      const email = normalizeEmail(payload.email)
      const password = payload.password

      if (!fullName) {
        throw new Error('Укажите имя и фамилию')
      }

      if (!isValidEmail(email)) {
        throw new Error('Укажите корректный email')
      }

      if (password.trim().length < 6) {
        throw new Error('Пароль должен быть не короче 6 символов')
      }

      const users = readUsers()
      if (users.some((user) => user.email === email)) {
        throw new Error('Пользователь с таким email уже существует')
      }

      const newUser: StoredUser = {
        fullName,
        email,
        password,
      }

      writeUsers([...users, newUser])

      const session = createSession(fullName, email)
      writeSession(session)
      return session
    },

    async logout() {
      await delay(120)
      writeSession(null)
    },
  }
}
