export type PaymentStatus =
  | 'active'
  | 'expected'
  | 'predicted'
  | 'low_balance'
  | 'overdue'
  | 'disabled'
  | 'frozen'

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
}

export interface DashboardAlert {
  id: string
  paymentId: string
  title: string
  amount: number
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
  }
  alerts: DashboardAlert[]
  upcoming: Payment[]
  chart: ChartSlice[]
  notifications: NotificationItem[]
  generatedAt: string
}

export interface CreatePaymentPayload {
  title: string
  amount: number
  nextChargeDate: string
  category: string
  mandatory: boolean
}
