import type {
  CreatePaymentPayload,
  DashboardPayload,
  Payment,
  PaymentStatus,
} from './types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'

interface ErrorPayload {
  message?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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
      if (payload.message) {
        message = payload.message
      }
    } catch {
      // ignore json parsing errors for non-json responses
    }

    throw new Error(message)
  }

  return (await response.json()) as T
}

export const smartDebitApi = {
  getDashboard() {
    return request<DashboardPayload>('/smartdebit/dashboard')
  },

  toggle(enabled: boolean) {
    return request<{ enabled: boolean }>('/smartdebit/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    })
  },

  payDebt(paymentId: string) {
    return request<{
      message: string
      payment: Payment
      account: { balance: number; available: number }
    }>(`/smartdebit/payments/${paymentId}/pay-debt`, {
      method: 'POST',
    })
  },

  updateStatus(paymentId: string, status: PaymentStatus) {
    return request<Payment>(`/smartdebit/payments/${paymentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  addPayment(payload: CreatePaymentPayload) {
    return request<Payment>('/smartdebit/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
