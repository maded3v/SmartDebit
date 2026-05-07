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
  // 
  //   Признак того, что просрочка возникла исключительно из-за «перемотки
  //   времени» (виртуальной даты). При работе с реальной датой всегда `false`.
   
  //   Поле опциональное: демо-данные и оффлайн-симуляция могут его не задавать
  //   — в таком случае оно трактуется как `false`.
  //  
  // isOverdueSimulated?: boolean
  // 
  //   На сколько дней платёж просрочен относительно текущей (реальной или
  //   виртуальной) даты. Для не-просроченных платежей значение `0`/`undefined`.
  //  
  daysOverdue?: number
}

export interface DashboardAlert {
  id: string
  paymentId: string
  title: string
  amount: number
  /** См. {@link Payment.isOverdueSimulated}. */
  isOverdueSimulated?: boolean
  /** См. {@link Payment.daysOverdue}. */
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
