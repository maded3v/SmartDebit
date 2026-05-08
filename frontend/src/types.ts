// Путь: frontend/src/types.ts
export type PaymentStatus =
  | 'active'
  | 'expected'
  | 'predicted'
  | 'low_balance'
  | 'overdue'
  | 'cancelled'
  | 'disabled'
  | 'frozen'
  | 'paid'

export interface Payment {
  id: string
  title: string
  provider: string
  amount: number
  category: string
  mandatory: boolean
  status: PaymentStatus
  statusLabel: string
  nextChargeDate: string
  periodLabel: string
  source: 'auto' | 'manual'
  iconUrl?: string
  // Признак того, что просрочка возникла из-за виртуальной даты (Time Travel).
  // При работе с реальной датой всегда false. Поле опциональное.
  isOverdueSimulated?: boolean
  // На сколько дней платёж просрочен относительно текущей (реальной или
  // виртуальной) даты. Для не-просроченных платежей значение 0 либо undefined.
  daysOverdue?: number
}

export interface DashboardAlert {
  id: string
  paymentId: string
  title: string
  amount: number
  // См. Payment.isOverdueSimulated.
  isOverdueSimulated?: boolean
  // См. Payment.daysOverdue.
  daysOverdue?: number
}

export interface ChartSlice {
  category: string
  amount: number
  color: string
}

export interface NotificationItem {
  id: string
  title: string
  subtitle: string
  level: 'neutral' | 'critical'
}

export interface DashboardPayload {
  enabled: boolean
  account: {
    balance: number
    available: number
    savings: number
  }
  alerts: DashboardAlert[]
  upcoming: Payment[]
  chart: ChartSlice[]
  notifications: NotificationItem[]
  generatedAt: string
}

export interface CreatePaymentPayload {
  title: string
  description?: string
  amount: number
  nextChargeDate: string
  category: string
  mandatory: boolean
}
