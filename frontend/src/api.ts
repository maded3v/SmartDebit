import type {
  CreatePaymentPayload,
  DashboardPayload,
  Payment,
  PaymentStatus,
  NotificationItem,
  ChartSlice,
  DashboardAlert,
} from './types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '/api/v1'

const ACCESS_TOKEN_STORAGE_KEY = 'smartdebit:access-token'
const REFRESH_TOKEN_STORAGE_KEY = 'smartdebit:refresh-token'
const USERNAME_STORAGE_KEY = 'smartdebit:current-user'

const STATUS_LABELS: Record<PaymentStatus, string> = {
  active: 'Активен',
  expected: 'Ожидается',
  predicted: 'Скоро',
  low_balance: 'Недостаточно средств',
  overdue: 'Просрочен',
  cancelled: 'Отключен',
  disabled: 'Отключен',
  frozen: 'Приостановлен',
  paid: 'Оплачен',
}

const CHART_COLOR_MAP: Record<string, { label: string; color: string }> = {
  finance: { label: 'Финансы', color: '#4f46e5' },
  utilities: { label: 'ЖКХ', color: '#0ea5e9' },
  entertainment: { label: 'Развлечения', color: '#22c55e' },
}

let smartDebitEnabledCache: boolean | null = null

interface ErrorPayload {
  message?: string
  detail?: string
  error?: string
}

interface TokenRefreshEnvelope {
  access?: string
}

interface AuthLoginEnvelope {
  status?: string
  access?: string
  refresh?: string
}

function readStorage(key: string) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (value === null) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, value)
  } catch {
    // ignore localStorage errors
  }
}

function getAccessToken() {
  return readStorage(ACCESS_TOKEN_STORAGE_KEY)
}

function getRefreshToken() {
  return readStorage(REFRESH_TOKEN_STORAGE_KEY)
}

function setTokens(access: string, refresh: string) {
  writeStorage(ACCESS_TOKEN_STORAGE_KEY, access)
  writeStorage(REFRESH_TOKEN_STORAGE_KEY, refresh)
}

function setAccessToken(access: string) {
  writeStorage(ACCESS_TOKEN_STORAGE_KEY, access)
}

function clearTokens() {
  writeStorage(ACCESS_TOKEN_STORAGE_KEY, null)
  writeStorage(REFRESH_TOKEN_STORAGE_KEY, null)
}

function getStoredUsername() {
  return readStorage(USERNAME_STORAGE_KEY)
}

function setStoredUsername(username: string | null) {
  writeStorage(USERNAME_STORAGE_KEY, username)
}

function buildHeaders(init?: HeadersInit, includeAuth = true) {
  const headers = new Headers(init)

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (includeAuth) {
    const accessToken = getAccessToken()
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
  }

  return headers
}

async function parseErrorMessage(response: Response) {
  let message = `Ошибка запроса (${response.status})`

  try {
    const payload = (await response.json()) as ErrorPayload
    if (payload.message || payload.detail || payload.error) {
      message = payload.message || payload.detail || payload.error || message
    }
  } catch {
    // ignore json parsing errors for non-json responses
  }

  return message
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    return false
  }

  const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh: refreshToken }),
  })

  if (!response.ok) {
    clearTokens()
    return false
  }

  const payload = (await response.json()) as TokenRefreshEnvelope
  if (!payload.access) {
    clearTokens()
    return false
  }

  setAccessToken(payload.access)
  return true
}

async function doFetch(path: string, init?: RequestInit, includeAuth = true) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init?.headers, includeAuth),
  })
}

interface BackendPayment {
  id: number | string
  service_name: string
  amount: number
  next_charge_date: string
  category: string
  is_mandatory: boolean
  status: string
}

interface BackendAlert {
  id: number | string
  service_name: string
  message: string
  amount: number
  type: string
}

interface BackendDashboardEnvelope {
  status: string
  data: {
    balance: number
    currency?: string
    is_smartdebit_enabled?: boolean
    upcoming_payments: BackendPayment[]
    alerts: BackendAlert[]
    analytics?: Record<string, number>
  }
}

interface BackendToggleEnvelope {
  status: string
  message?: string
  data?: {
    is_smartdebit_enabled?: boolean
  }
}

interface BackendStatusEnvelope {
  status?: string
  message?: string
  payment?: {
    id?: number | string
    status?: string
  }
}

interface BackendCreatePaymentEnvelope {
  status?: string
  message?: string
  payment?: BackendPayment
}

interface BackendPayEnvelope {
  status?: string
  message?: string
  data?: {
    new_balance?: number
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isAuthEndpoint = path.startsWith('/auth/')
  const response = await doFetch(path, init, !isAuthEndpoint)

  if (response.status === 401 && !isAuthEndpoint) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      const retried = await doFetch(path, init, true)
      if (retried.ok) {
        return (await retried.json()) as T
      }
      throw new Error(await parseErrorMessage(retried))
    }
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return (await response.json()) as T
}

export const authApi = {
  async login(username: string, password: string) {
    const normalizedUsername = username.trim()
    const payload = await request<AuthLoginEnvelope>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username: normalizedUsername, password }),
    })

    if (!payload.access || !payload.refresh) {
      throw new Error('Сервер не вернул токены доступа')
    }

    setTokens(payload.access, payload.refresh)
    setStoredUsername(normalizedUsername)
  },

  logout() {
    clearTokens()
    setStoredUsername(null)
  },

  isAuthenticated() {
    return Boolean(getAccessToken() && getStoredUsername())
  },

  getStoredUsername,
}

function normalizeStatus(status: string): PaymentStatus {
  if (status === 'active' || status === 'expected' || status === 'predicted') {
    return status
  }

  if (
    status === 'low_balance' ||
    status === 'overdue' ||
    status === 'cancelled' ||
    status === 'disabled' ||
    status === 'frozen' ||
    status === 'paid'
  ) {
    return status
  }

  return 'expected'
}

function getPeriodLabel(nextChargeDate: string) {
  const date = new Date(nextChargeDate)
  if (Number.isNaN(date.getTime())) {
    return 'Регулярный платеж'
  }

  return `Ежемесячно, ${date.getDate()} числа`
}

function mapBackendPayment(payment: BackendPayment): Payment {
  const status = normalizeStatus(payment.status)

  return {
    id: String(payment.id),
    title: payment.service_name || 'Регулярный платеж',
    provider: payment.category || 'SmartDebit',
    amount: Number(payment.amount) || 0,
    category: payment.category || 'Прочее',
    mandatory: Boolean(payment.is_mandatory),
    status,
    statusLabel: STATUS_LABELS[status],
    nextChargeDate: payment.next_charge_date,
    periodLabel: getPeriodLabel(payment.next_charge_date),
    source: 'auto',
  }
}

function mapAlerts(alerts: BackendAlert[]): DashboardAlert[] {
  return alerts.map((alert) => ({
    id: String(alert.id),
    paymentId: String(alert.id),
    title: `${alert.service_name}: ${alert.message}`,
    amount: Number(alert.amount) || 0,
  }))
}

function mapChart(analytics?: Record<string, number>): ChartSlice[] {
  if (!analytics) {
    return []
  }

  return Object.entries(analytics)
    .map(([key, amount]) => {
      const config = CHART_COLOR_MAP[key]
      if (!config) {
        return null
      }

      return {
        category: config.label,
        amount: Number(amount) || 0,
        color: config.color,
      }
    })
    .filter((item): item is ChartSlice => Boolean(item && item.amount > 0))
}

function buildNotifications(upcoming: Payment[], alerts: DashboardAlert[]): NotificationItem[] {
  const alertNotifications = alerts.map((alert) => ({
    id: `alert-${alert.id}`,
    title: alert.title,
    subtitle: `Сумма: ${(Number(alert.amount) || 0).toLocaleString('ru-RU')} ₽`,
    level: 'critical' as const,
  }))

  const upcomingNotifications = upcoming.slice(0, 3).map((payment) => ({
    id: `payment-${payment.id}`,
    title: `Скоро списание: ${payment.title}`,
    subtitle: `${(Number(payment.amount) || 0).toLocaleString('ru-RU')} ₽ · ${payment.nextChargeDate}`,
    level: payment.status === 'low_balance' ? ('critical' as const) : ('neutral' as const),
  }))

  return [...alertNotifications, ...upcomingNotifications]
}

function computeAvailableBalance(balance: number, upcoming: Payment[]) {
  const reserved = upcoming
    .filter((payment) => !['cancelled', 'frozen', 'paid'].includes(payment.status))
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)

  return Math.max(0, Number(balance) - reserved)
}

function isLegacyDashboard(payload: unknown): payload is DashboardPayload {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      'enabled' in payload &&
      'account' in payload &&
      'upcoming' in payload,
  )
}

function isBackendDashboard(payload: unknown): payload is BackendDashboardEnvelope {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    return false
  }

  const envelope = payload as BackendDashboardEnvelope
  return Boolean(envelope.data && Array.isArray(envelope.data.upcoming_payments))
}

function mapDashboardPayload(payload: unknown): DashboardPayload {
  if (isLegacyDashboard(payload)) {
    return payload
  }

  if (!isBackendDashboard(payload)) {
    throw new Error('Неподдерживаемый формат ответа дашборда')
  }

  const upcoming = payload.data.upcoming_payments.map(mapBackendPayment)
  const alerts = mapAlerts(payload.data.alerts || [])
  const balance = Number(payload.data.balance) || 0
  const enabled =
    typeof payload.data.is_smartdebit_enabled === 'boolean'
      ? payload.data.is_smartdebit_enabled
      : smartDebitEnabledCache ?? true

  return {
    enabled,
    account: {
      balance,
      available: computeAvailableBalance(balance, upcoming),
    },
    alerts,
    upcoming,
    chart: mapChart(payload.data.analytics),
    notifications: buildNotifications(upcoming, alerts),
    generatedAt: new Date().toISOString(),
  }
}

export const smartDebitApi = {
  async getDashboard() {
    try {
      const payload = await request<unknown>('/smartdebit/dashboard/')
      return mapDashboardPayload(payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''

      if (/User not found/i.test(message)) {
        await smartDebitApi.toggle(true)
        const payload = await request<unknown>('/smartdebit/dashboard/')
        return mapDashboardPayload(payload)
      }

      throw error
    }
  },

  async toggle(enabled: boolean) {
    const payload = await request<BackendToggleEnvelope>('/smartdebit/toggle/', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    })

    const resolvedEnabled =
      typeof payload.data?.is_smartdebit_enabled === 'boolean'
        ? payload.data.is_smartdebit_enabled
        : enabled

    smartDebitEnabledCache = resolvedEnabled

    return { enabled: resolvedEnabled }
  },

  async payDebt(paymentId: string) {
    const payload = await request<BackendPayEnvelope>(`/payments/${paymentId}/pay/`, {
      method: 'POST',
    })

    return {
      message: payload.message || 'Платеж успешно оплачен',
      account: {
        balance: Number(payload.data?.new_balance) || 0,
        available: Number(payload.data?.new_balance) || 0,
      },
    }
  },

  async updateStatus(paymentId: string, status: PaymentStatus) {
    const mappedStatus = status === 'disabled' ? 'cancelled' : status
    const payload = await request<BackendStatusEnvelope>(`/payments/${paymentId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status: mappedStatus }),
    })

    return {
      message: payload.message || 'Статус платежа обновлен',
    }
  },

  async addPayment(payload: CreatePaymentPayload) {
    const response = await request<BackendCreatePaymentEnvelope>('/payments/', {
      method: 'POST',
      body: JSON.stringify({
        custom_name: payload.title,
        amount: payload.amount,
        next_charge_date: payload.nextChargeDate,
      }),
    })

    return {
      message: response.message || 'Новый платеж добавлен',
      payment: response.payment ? mapBackendPayment(response.payment) : null,
    }
  },
}
