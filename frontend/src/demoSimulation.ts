import type { CreatePaymentPayload, DashboardPayload, Payment, PaymentStatus } from './types'

export interface DemoHistoryItem {
  id: string
  title: string
  date: string
  amount: number
  icon: string
  iconTone: 'green' | 'dark' | 'gray' | 'red'
  smartTag?: string
}

interface DemoPaymentSeed {
  id: string
  title: string
  provider: string
  amount: number
  category: string
  mandatory: boolean
  daysUntilCharge: number
}

interface DemoHistorySeed {
  id: string
  title: string
  amount: number
  daysAgo: number
  icon: string
  iconTone: DemoHistoryItem['iconTone']
  smartTag?: string
}

interface DemoProfileTemplate {
  id: string
  fullName: string
  tierLabel: string
  startingBalance: number
  enabled: boolean
  payments: DemoPaymentSeed[]
  history: DemoHistorySeed[]
}

export interface DemoProfileRuntime {
  id: string
  fullName: string
  tierLabel: string
  dashboard: DashboardPayload
  history: DemoHistoryItem[]
}

export interface DemoSimulationState {
  activeProfileId: string
  currentDate: string
  profiles: Record<string, DemoProfileRuntime>
}

export interface DemoProfileOption {
  id: string
  fullName: string
  tierLabel: string
}

interface SimulationResult {
  state: DemoSimulationState
  message?: string
  error?: string
}

const STORAGE_KEY = 'smartdebit.frontend.simulation.v1'
const BASE_DATE = '2026-03-01'
const MAX_HISTORY_ITEMS = 30
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

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

const CHART_CONFIG = {
  finance: { label: 'Финансы', color: '#4f46e5' },
  utilities: { label: 'ЖКХ и связь', color: '#0ea5e9' },
  entertainment: { label: 'Развлечения', color: '#22c55e' },
  shopping: { label: 'Покупки', color: '#f97316' },
  other: { label: 'Прочее', color: '#64748b' },
}

const PROFILE_TEMPLATES: DemoProfileTemplate[] = [
  {
    id: 'profile-1',
    fullName: 'Иван Иванов',
    tierLabel: 'Black',
    startingBalance: 116783,
    enabled: true,
    payments: [
      {
        id: 'mortgage-sber',
        title: 'Ипотека (Сбербанк)',
        provider: 'Финансы',
        amount: 45000,
        category: 'Финансы',
        mandatory: true,
        daysUntilCharge: 3,
      },
      {
        id: 'yandex-plus',
        title: 'Яндекс Плюс',
        provider: 'Развлечения',
        amount: 299,
        category: 'Развлечения',
        mandatory: false,
        daysUntilCharge: 2,
      },
      {
        id: 'kion',
        title: 'KION',
        provider: 'Развлечения',
        amount: 249,
        category: 'Развлечения',
        mandatory: false,
        daysUntilCharge: 5,
      },
      {
        id: 'mos-zhkh',
        title: 'ЖКХ Квартплата',
        provider: 'ЖКХ',
        amount: 8900,
        category: 'ЖКХ',
        mandatory: true,
        daysUntilCharge: 7,
      },
      {
        id: 'mts-main',
        title: 'МТС',
        provider: 'Связь',
        amount: 620,
        category: 'Связь',
        mandatory: false,
        daysUntilCharge: 4,
      },
    ],
    history: [
      { id: 'salary', title: 'Зарплата', amount: 95000, daysAgo: 1, icon: '↙', iconTone: 'green' },
      { id: 'samokat', title: 'Самокат', amount: -1250, daysAgo: 2, icon: 'С', iconTone: 'green' },
      {
        id: 'plus',
        title: 'Яндекс Плюс',
        amount: -299,
        daysAgo: 2,
        icon: '↻',
        iconTone: 'gray',
        smartTag: 'SmartDebit · Оплата за расчетный период',
      },
      { id: 'magnit', title: 'Магнит', amount: -2340, daysAgo: 3, icon: 'М', iconTone: 'red' },
    ],
  },
  {
    id: 'profile-2',
    fullName: 'Анна Смирнова',
    tierLabel: 'Platinum',
    startingBalance: 68420,
    enabled: true,
    payments: [
      {
        id: 'rent-ann',
        title: 'Аренда квартиры',
        provider: 'Финансы',
        amount: 32000,
        category: 'Финансы',
        mandatory: true,
        daysUntilCharge: 2,
      },
      {
        id: 'kids-ann',
        title: 'Детский сад',
        provider: 'Образование',
        amount: 5400,
        category: 'Прочее',
        mandatory: true,
        daysUntilCharge: 4,
      },
      {
        id: 'internet-ann',
        title: 'Ростелеком',
        provider: 'Интернет',
        amount: 990,
        category: 'Связь',
        mandatory: false,
        daysUntilCharge: 1,
      },
      {
        id: 'okko-ann',
        title: 'OKKO Подписка',
        provider: 'Развлечения',
        amount: 399,
        category: 'Развлечения',
        mandatory: false,
        daysUntilCharge: 6,
      },
      {
        id: 'electric-ann',
        title: 'МосЭнерго',
        provider: 'ЖКХ',
        amount: 2300,
        category: 'ЖКХ',
        mandatory: true,
        daysUntilCharge: 9,
      },
    ],
    history: [
      { id: 'salary', title: 'Зарплата', amount: 73000, daysAgo: 1, icon: '↙', iconTone: 'green' },
      { id: 'market', title: 'Пятерочка', amount: -3260, daysAgo: 1, icon: 'П', iconTone: 'red' },
      { id: 'taxi', title: 'Яндекс Такси', amount: -740, daysAgo: 2, icon: 'Я', iconTone: 'dark' },
      { id: 'coffee', title: 'Кофейня', amount: -390, daysAgo: 2, icon: 'К', iconTone: 'gray' },
    ],
  },
  {
    id: 'profile-3',
    fullName: 'Максим Петров',
    tierLabel: 'Premium',
    startingBalance: 214000,
    enabled: true,
    payments: [
      {
        id: 'loan-max',
        title: 'Автокредит',
        provider: 'Финансы',
        amount: 18800,
        category: 'Финансы',
        mandatory: true,
        daysUntilCharge: 8,
      },
      {
        id: 'rent-office-max',
        title: 'Аренда офиса',
        provider: 'Финансы',
        amount: 42000,
        category: 'Финансы',
        mandatory: true,
        daysUntilCharge: 5,
      },
      {
        id: 'internet-max',
        title: 'Бизнес интернет',
        provider: 'Связь',
        amount: 2400,
        category: 'Связь',
        mandatory: false,
        daysUntilCharge: 3,
      },
      {
        id: 'music-max',
        title: 'YouTube Premium',
        provider: 'Развлечения',
        amount: 999,
        category: 'Развлечения',
        mandatory: false,
        daysUntilCharge: 10,
      },
      {
        id: 'tax-max',
        title: 'Налог ИП',
        provider: 'Налоги',
        amount: 12000,
        category: 'Финансы',
        mandatory: true,
        daysUntilCharge: 11,
      },
    ],
    history: [
      { id: 'income', title: 'Оплата от клиента', amount: 180000, daysAgo: 0, icon: '↙', iconTone: 'green' },
      { id: 'fuel', title: 'АЗС', amount: -4100, daysAgo: 1, icon: 'А', iconTone: 'red' },
      { id: 'tools', title: 'Маркетплейс', amount: -13900, daysAgo: 3, icon: 'М', iconTone: 'dark' },
      { id: 'dinner', title: 'Ресторан', amount: -2800, daysAgo: 4, icon: 'Р', iconTone: 'gray' },
    ],
  },
  {
    id: 'profile-4',
    fullName: 'Ольга Кузнецова',
    tierLabel: 'Standard',
    startingBalance: 27500,
    enabled: true,
    payments: [
      {
        id: 'loan-olga',
        title: 'Потребительский кредит',
        provider: 'Финансы',
        amount: 19000,
        category: 'Финансы',
        mandatory: true,
        daysUntilCharge: 1,
      },
      {
        id: 'rent-olga',
        title: 'Аренда',
        provider: 'Финансы',
        amount: 18500,
        category: 'Финансы',
        mandatory: true,
        daysUntilCharge: 3,
      },
      {
        id: 'utilities-olga',
        title: 'ЖКХ',
        provider: 'ЖКХ',
        amount: 6200,
        category: 'ЖКХ',
        mandatory: true,
        daysUntilCharge: 5,
      },
      {
        id: 'sub-olga',
        title: 'START Подписка',
        provider: 'Развлечения',
        amount: 399,
        category: 'Развлечения',
        mandatory: false,
        daysUntilCharge: 2,
      },
    ],
    history: [
      { id: 'income', title: 'Зарплата', amount: 42000, daysAgo: 2, icon: '↙', iconTone: 'green' },
      { id: 'groceries', title: 'Лента', amount: -5600, daysAgo: 1, icon: 'Л', iconTone: 'red' },
      { id: 'pharmacy', title: 'Аптека', amount: -1900, daysAgo: 1, icon: 'А', iconTone: 'dark' },
    ],
  },
  {
    id: 'profile-5',
    fullName: 'Даниил Соколов',
    tierLabel: 'Metal',
    startingBalance: 98500,
    enabled: true,
    payments: [
      {
        id: 'mortgage-dan',
        title: 'Ипотека',
        provider: 'Финансы',
        amount: 37200,
        category: 'Финансы',
        mandatory: true,
        daysUntilCharge: 6,
      },
      {
        id: 'tax-dan',
        title: 'Налог',
        provider: 'Налоги',
        amount: 9800,
        category: 'Финансы',
        mandatory: true,
        daysUntilCharge: 9,
      },
      {
        id: 'mobile-dan',
        title: 'Мобильная связь',
        provider: 'Связь',
        amount: 730,
        category: 'Связь',
        mandatory: false,
        daysUntilCharge: 4,
      },
      {
        id: 'ent-dan',
        title: 'Кинопоиск',
        provider: 'Развлечения',
        amount: 399,
        category: 'Развлечения',
        mandatory: false,
        daysUntilCharge: 2,
      },
    ],
    history: [
      { id: 'income', title: 'Фриланс', amount: 58000, daysAgo: 0, icon: '↙', iconTone: 'green' },
      { id: 'shop', title: 'Ozon', amount: -4400, daysAgo: 1, icon: 'O', iconTone: 'dark' },
      { id: 'food', title: 'Самокат', amount: -1480, daysAgo: 2, icon: 'С', iconTone: 'green' },
    ],
  },
  {
    id: 'profile-6',
    fullName: 'Елена Волкова',
    tierLabel: 'Gold',
    startingBalance: 50200,
    enabled: false,
    payments: [
      {
        id: 'rent-elena',
        title: 'Аренда жилья',
        provider: 'Финансы',
        amount: 24000,
        category: 'Финансы',
        mandatory: true,
        daysUntilCharge: 4,
      },
      {
        id: 'medicine-elena',
        title: 'Медицина',
        provider: 'Прочее',
        amount: 7300,
        category: 'Прочее',
        mandatory: true,
        daysUntilCharge: 7,
      },
      {
        id: 'internet-elena',
        title: 'Интернет',
        provider: 'Связь',
        amount: 890,
        category: 'Связь',
        mandatory: false,
        daysUntilCharge: 3,
      },
      {
        id: 'music-elena',
        title: 'Yandex Music',
        provider: 'Развлечения',
        amount: 299,
        category: 'Развлечения',
        mandatory: false,
        daysUntilCharge: 2,
      },
    ],
    history: [
      { id: 'income', title: 'Премия', amount: 25000, daysAgo: 3, icon: '↙', iconTone: 'green' },
      { id: 'market', title: 'ВкусВилл', amount: -3100, daysAgo: 1, icon: 'В', iconTone: 'red' },
      { id: 'transport', title: 'Метро', amount: -420, daysAgo: 0, icon: 'М', iconTone: 'gray' },
    ],
  },
]

const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
})

function parseIsoDate(value: string) {
  const chunks = value.split('-').map(Number)
  if (chunks.length !== 3 || chunks.some((item) => !Number.isFinite(item))) {
    return parseIsoDate(BASE_DATE)
  }
  const [year, month, day] = chunks
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) {
    return parseIsoDate(BASE_DATE)
  }
  return date
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDaysToIso(value: string, days: number) {
  const date = parseIsoDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date)
}

function addMonthsToIso(value: string, months: number) {
  const date = parseIsoDate(value)
  date.setUTCMonth(date.getUTCMonth() + months)
  return toIsoDate(date)
}

function isOnOrBeforeDate(left: string, right: string) {
  return parseIsoDate(left).getTime() <= parseIsoDate(right).getTime()
}

function isBeforeDate(left: string, right: string) {
  return parseIsoDate(left).getTime() < parseIsoDate(right).getTime()
}

function isIsoDate(value: string) {
  return ISO_DATE_PATTERN.test(value)
}

function formatShortDate(value: string) {
  return shortDateFormatter.format(parseIsoDate(value)).replace('.', '')
}

function formatPaymentTitle(title: string) {
  const normalized = title.trim()
  if (!normalized) {
    return 'Без названия'
  }
  return normalized.slice(0, 1).toUpperCase() + normalized.slice(1)
}

function getPeriodLabel(nextChargeDate: string) {
  return `Ежемесячно, ${parseIsoDate(nextChargeDate).getUTCDate()} числа`
}

function getChartBucket(category: string): keyof typeof CHART_CONFIG {
  const normalized = category.toLowerCase()
  if (
    normalized.includes('финанс') ||
    normalized.includes('кредит') ||
    normalized.includes('ипотек') ||
    normalized.includes('налог')
  ) {
    return 'finance'
  }

  if (
    normalized.includes('жкх') ||
    normalized.includes('коммун') ||
    normalized.includes('интернет') ||
    normalized.includes('связ')
  ) {
    return 'utilities'
  }

  if (
    normalized.includes('развлеч') ||
    normalized.includes('подпис') ||
    normalized.includes('music') ||
    normalized.includes('кино')
  ) {
    return 'entertainment'
  }

  if (
    normalized.includes('покуп') ||
    normalized.includes('маркет') ||
    normalized.includes('магаз') ||
    normalized.includes('еда')
  ) {
    return 'shopping'
  }

  return 'other'
}

function computeAvailableBalance(balance: number, upcoming: Payment[]) {
  const reserved = upcoming
    .filter((payment) => !['cancelled', 'disabled', 'frozen', 'paid'].includes(payment.status))
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)

  return Math.max(0, Number(balance) - reserved)
}

function buildChart(upcoming: Payment[]): DashboardPayload['chart'] {
  const grouped = new Map<keyof typeof CHART_CONFIG, number>()

  upcoming
    .filter((payment) => !['cancelled', 'disabled', 'frozen', 'paid'].includes(payment.status))
    .forEach((payment) => {
      const bucket = getChartBucket(payment.category)
      grouped.set(bucket, (grouped.get(bucket) ?? 0) + payment.amount)
    })

  return Array.from(grouped.entries())
    .filter(([, amount]) => amount > 0)
    .map(([bucket, amount]) => ({
      category: CHART_CONFIG[bucket].label,
      amount,
      color: CHART_CONFIG[bucket].color,
    }))
}

function buildAlerts(upcoming: Payment[], enabled: boolean): DashboardPayload['alerts'] {
  if (!enabled) {
    return []
  }

  return upcoming
    .filter((payment) => payment.status === 'low_balance' || payment.status === 'overdue')
    .map((payment) => ({
      id: `alert-${payment.id}`,
      paymentId: payment.id,
      title:
        payment.status === 'overdue'
          ? `${formatPaymentTitle(payment.title)}: платеж просрочен`
          : `${formatPaymentTitle(payment.title)}: недостаточно средств`,
      amount: payment.amount,
    }))
}

function buildNotifications(
  upcoming: Payment[],
  alerts: DashboardPayload['alerts'],
): DashboardPayload['notifications'] {
  const alertNotifications: DashboardPayload['notifications'] = alerts.map((alert) => ({
    id: `notification-${alert.id}`,
    title: alert.title,
    subtitle: `Сумма: ${alert.amount.toLocaleString('ru-RU')} ₽`,
    level: 'critical',
  }))

  const upcomingNotifications = [...upcoming]
    .sort((left, right) => parseIsoDate(left.nextChargeDate).getTime() - parseIsoDate(right.nextChargeDate).getTime())
    .slice(0, 3)
    .map((payment) => ({
      id: `notification-payment-${payment.id}`,
      title: `Скоро списание: ${formatPaymentTitle(payment.title)}`,
      subtitle: `${payment.amount.toLocaleString('ru-RU')} ₽ · ${payment.nextChargeDate}`,
      level:
        payment.status === 'low_balance' || payment.status === 'overdue'
          ? ('critical' as const)
          : ('neutral' as const),
    }))

  return [...alertNotifications, ...upcomingNotifications]
}

function rebuildDashboard(dashboard: DashboardPayload, currentDate: string): DashboardPayload {
  const upcoming = dashboard.upcoming.map((payment) => {
    let status = payment.status

    if (
      dashboard.enabled &&
      isBeforeDate(payment.nextChargeDate, currentDate) &&
      (status === 'expected' || status === 'predicted' || status === 'active')
    ) {
      status = 'overdue'
    }

    return {
      ...payment,
      status,
      statusLabel: STATUS_LABELS[status],
      periodLabel: getPeriodLabel(payment.nextChargeDate),
    }
  })

  const alerts = buildAlerts(upcoming, dashboard.enabled)
  const chart = buildChart(upcoming)
  const notifications = buildNotifications(upcoming, alerts)

  return {
    ...dashboard,
    upcoming,
    alerts,
    chart,
    notifications,
    account: {
      balance: Number(dashboard.account.balance) || 0,
      available: computeAvailableBalance(Number(dashboard.account.balance) || 0, upcoming),
      savings: Number(dashboard.account.savings) || 0,
    },
    generatedAt: new Date().toISOString(),
  }
}

function createPaymentFromSeed(seed: DemoPaymentSeed, currentDate: string): Payment {
  const nextChargeDate = addDaysToIso(currentDate, seed.daysUntilCharge)
  return {
    id: seed.id,
    title: seed.title,
    provider: seed.provider,
    amount: seed.amount,
    category: seed.category,
    mandatory: seed.mandatory,
    status: 'expected',
    statusLabel: STATUS_LABELS.expected,
    nextChargeDate,
    periodLabel: getPeriodLabel(nextChargeDate),
    source: 'auto',
  }
}

function createHistoryFromSeed(
  profileId: string,
  seed: DemoHistorySeed,
  currentDate: string,
): DemoHistoryItem {
  return {
    id: `${profileId}-${seed.id}`,
    title: seed.title,
    date: formatShortDate(addDaysToIso(currentDate, -seed.daysAgo)),
    amount: seed.amount,
    icon: seed.icon,
    iconTone: seed.iconTone,
    smartTag: seed.smartTag,
  }
}

function createSmartDebitHistoryItem(payment: Payment, chargeDate: string): DemoHistoryItem {
  const title = formatPaymentTitle(payment.title)
  const firstChar = title.slice(0, 1).toUpperCase() || 'S'
  return {
    id: `sim-${payment.id}-${chargeDate}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    date: formatShortDate(chargeDate),
    amount: -payment.amount,
    icon: firstChar,
    iconTone: 'gray',
    smartTag: `SmartDebit · ${payment.periodLabel}`,
  }
}

function createManualHistoryItem(
  currentDate: string,
  title: string,
  amount: number,
  iconTone: DemoHistoryItem['iconTone'],
  icon: string,
): DemoHistoryItem {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    date: formatShortDate(currentDate),
    amount,
    icon,
    iconTone,
  }
}

function appendHistory(history: DemoHistoryItem[], item: DemoHistoryItem) {
  return [item, ...history].slice(0, MAX_HISTORY_ITEMS)
}

function createProfileFromTemplate(template: DemoProfileTemplate, currentDate: string): DemoProfileRuntime {
  const upcoming = template.payments.map((seed) => createPaymentFromSeed(seed, currentDate))
  const history = [...template.history]
    .sort((left, right) => left.daysAgo - right.daysAgo)
    .map((seed) => createHistoryFromSeed(template.id, seed, currentDate))

  const dashboard: DashboardPayload = rebuildDashboard(
    {
      enabled: template.enabled,
      account: {
        balance: template.startingBalance,
        available: template.startingBalance,
        savings: 0,
      },
      alerts: [],
      upcoming,
      chart: [],
      notifications: [],
      generatedAt: new Date().toISOString(),
    },
    currentDate,
  )

  return {
    id: template.id,
    fullName: template.fullName,
    tierLabel: template.tierLabel,
    dashboard,
    history,
  }
}

function applyTimeAdvanceToProfile(profile: DemoProfileRuntime, targetDate: string): DemoProfileRuntime {
  let balance = profile.dashboard.account.balance
  let history = [...profile.history]

  const upcoming = profile.dashboard.upcoming.map((payment) => {
    if (
      !profile.dashboard.enabled ||
      ['cancelled', 'disabled', 'frozen'].includes(payment.status) ||
      payment.amount <= 0
    ) {
      return payment
    }

    let nextChargeDate = payment.nextChargeDate
    let nextStatus: PaymentStatus = payment.status
    let safety = 0

    while (isOnOrBeforeDate(nextChargeDate, targetDate) && safety < 24) {
      if (balance >= payment.amount) {
        balance -= payment.amount
        history = appendHistory(history, createSmartDebitHistoryItem(payment, nextChargeDate))
        nextChargeDate = addMonthsToIso(nextChargeDate, 1)
        nextStatus = 'expected'
      } else {
        nextStatus = isBeforeDate(nextChargeDate, targetDate) ? 'overdue' : 'low_balance'
        break
      }
      safety += 1
    }

    return {
      ...payment,
      nextChargeDate,
      periodLabel: getPeriodLabel(nextChargeDate),
      status: nextStatus,
      statusLabel: STATUS_LABELS[nextStatus],
    }
  })

  const dashboard = rebuildDashboard(
    {
      ...profile.dashboard,
      account: {
        ...profile.dashboard.account,
        balance,
      },
      upcoming,
    },
    targetDate,
  )

  return {
    ...profile,
    dashboard,
    history,
  }
}

function updateActiveProfile(
  state: DemoSimulationState,
  update: (profile: DemoProfileRuntime) => DemoProfileRuntime,
): SimulationResult {
  const activeProfile = state.profiles[state.activeProfileId]
  if (!activeProfile) {
    return { state, error: 'Активный профиль не найден' }
  }

  const nextProfile = update(activeProfile)

  return {
    state: {
      ...state,
      profiles: {
        ...state.profiles,
        [state.activeProfileId]: nextProfile,
      },
    },
  }
}

function isValidHistoryItem(value: unknown): value is DemoHistoryItem {
  if (!value || typeof value !== 'object') {
    return false
  }
  const item = value as DemoHistoryItem
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.date === 'string' &&
    typeof item.amount === 'number' &&
    typeof item.icon === 'string' &&
    (item.iconTone === 'green' || item.iconTone === 'dark' || item.iconTone === 'gray' || item.iconTone === 'red')
  )
}

function normalizeLoadedState(value: unknown): DemoSimulationState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Partial<DemoSimulationState>
  if (!raw.profiles || typeof raw.profiles !== 'object') {
    return null
  }

  const currentDate = typeof raw.currentDate === 'string' && isIsoDate(raw.currentDate)
    ? raw.currentDate
    : BASE_DATE

  const profiles: Record<string, DemoProfileRuntime> = {}

  Object.entries(raw.profiles as Record<string, unknown>).forEach(([profileId, profileValue]) => {
    if (!profileValue || typeof profileValue !== 'object') {
      return
    }
    const profile = profileValue as Partial<DemoProfileRuntime>
    if (
      typeof profile.fullName !== 'string' ||
      typeof profile.tierLabel !== 'string' ||
      !profile.dashboard ||
      typeof profile.dashboard !== 'object'
    ) {
      return
    }

    const history = Array.isArray(profile.history)
      ? (profile.history.filter((item) => isValidHistoryItem(item)) as DemoHistoryItem[])
      : []

    profiles[profileId] = {
      id: profileId,
      fullName: profile.fullName,
      tierLabel: profile.tierLabel,
      dashboard: rebuildDashboard(profile.dashboard as DashboardPayload, currentDate),
      history: history.slice(0, MAX_HISTORY_ITEMS),
    }
  })

  const profileIds = Object.keys(profiles)
  if (!profileIds.length) {
    return null
  }

  const activeProfileId =
    typeof raw.activeProfileId === 'string' && profiles[raw.activeProfileId]
      ? raw.activeProfileId
      : profileIds[0]

  return {
    activeProfileId,
    currentDate,
    profiles,
  }
}

export function createInitialSimulationState(): DemoSimulationState {
  const profiles = Object.fromEntries(
    PROFILE_TEMPLATES.map((template) => [template.id, createProfileFromTemplate(template, BASE_DATE)]),
  ) as Record<string, DemoProfileRuntime>

  return {
    activeProfileId: PROFILE_TEMPLATES[0].id,
    currentDate: BASE_DATE,
    profiles,
  }
}

export function loadSimulationState(): DemoSimulationState {
  if (typeof window === 'undefined') {
    return createInitialSimulationState()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createInitialSimulationState()
    }

    const parsed = JSON.parse(raw)
    return normalizeLoadedState(parsed) ?? createInitialSimulationState()
  } catch {
    return createInitialSimulationState()
  }
}

export function saveSimulationState(state: DemoSimulationState) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore localStorage errors
  }
}

export function getProfileOptions(state: DemoSimulationState): DemoProfileOption[] {
  return Object.values(state.profiles).map((profile) => ({
    id: profile.id,
    fullName: profile.fullName,
    tierLabel: profile.tierLabel,
  }))
}

export function switchActiveProfile(state: DemoSimulationState, profileId: string): SimulationResult {
  if (!state.profiles[profileId]) {
    return { state, error: 'Профиль не найден' }
  }

  return {
    state: {
      ...state,
      activeProfileId: profileId,
    },
  }
}

export function advanceSimulationDays(state: DemoSimulationState, days: number): SimulationResult {
  const normalizedDays = Math.trunc(days)
  if (!Number.isFinite(normalizedDays) || normalizedDays <= 0) {
    return { state, error: 'Количество дней должно быть больше нуля' }
  }

  const targetDate = addDaysToIso(state.currentDate, normalizedDays)
  const nextProfiles: Record<string, DemoProfileRuntime> = {}

  Object.entries(state.profiles).forEach(([profileId, profile]) => {
    nextProfiles[profileId] = applyTimeAdvanceToProfile(profile, targetDate)
  })

  return {
    state: {
      ...state,
      currentDate: targetDate,
      profiles: nextProfiles,
    },
    message: `Время перемотано на ${normalizedDays} дн.`,
  }
}

export function adjustActiveProfileBalance(
  state: DemoSimulationState,
  amount: number,
  direction: 'topup' | 'spend',
): SimulationResult {
  const normalizedAmount = Math.round(Number(amount))
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return { state, error: 'Сумма должна быть больше нуля' }
  }

  const activeProfile = state.profiles[state.activeProfileId]
  if (!activeProfile) {
    return { state, error: 'Активный профиль не найден' }
  }

  if (direction === 'spend' && activeProfile.dashboard.account.balance < normalizedAmount) {
    return { state, error: 'Недостаточно средств для ручного списания' }
  }

  return updateActiveProfile(state, (profile) => {
    const delta = direction === 'topup' ? normalizedAmount : -normalizedAmount
    const nextBalance = profile.dashboard.account.balance + delta
    const historyEntry = createManualHistoryItem(
      state.currentDate,
      direction === 'topup' ? 'Ручное пополнение' : 'Ручное списание',
      delta,
      direction === 'topup' ? 'green' : 'red',
      direction === 'topup' ? '↙' : '↗',
    )

    return {
      ...profile,
      history: appendHistory(profile.history, historyEntry),
      dashboard: rebuildDashboard(
        {
          ...profile.dashboard,
          account: {
            ...profile.dashboard.account,
            balance: nextBalance,
          },
        },
        state.currentDate,
      ),
    }
  })
}

export function toggleActiveProfileSmartDebit(
  state: DemoSimulationState,
  enabled: boolean,
): SimulationResult {
  const result = updateActiveProfile(state, (profile) => ({
    ...profile,
    dashboard: rebuildDashboard(
      {
        ...profile.dashboard,
        enabled,
      },
      state.currentDate,
    ),
  }))

  return {
    ...result,
    message: enabled ? 'SmartDebit включен' : 'SmartDebit выключен',
  }
}

export function payActiveProfileDebt(state: DemoSimulationState, paymentId: string): SimulationResult {
  const activeProfile = state.profiles[state.activeProfileId]
  if (!activeProfile) {
    return { state, error: 'Активный профиль не найден' }
  }

  const payment = activeProfile.dashboard.upcoming.find((item) => item.id === paymentId)
  if (!payment) {
    return { state, error: 'Платеж для погашения не найден' }
  }

  if (activeProfile.dashboard.account.balance < payment.amount) {
    return { state, error: 'Недостаточно средств для погашения' }
  }

  const nextChargeDate = addMonthsToIso(payment.nextChargeDate, 1)

  const result = updateActiveProfile(state, (profile) => {
    const history = appendHistory(profile.history, createSmartDebitHistoryItem(payment, state.currentDate))
    const upcoming: Payment[] = profile.dashboard.upcoming.map((item) => {
      if (item.id !== paymentId) {
        return item
      }

      return {
        ...item,
        nextChargeDate,
        periodLabel: getPeriodLabel(nextChargeDate),
        status: 'expected',
        statusLabel: STATUS_LABELS.expected,
      }
    })

    return {
      ...profile,
      history,
      dashboard: rebuildDashboard(
        {
          ...profile.dashboard,
          account: {
            ...profile.dashboard.account,
            balance: profile.dashboard.account.balance - payment.amount,
          },
          upcoming,
        },
        state.currentDate,
      ),
    }
  })

  return {
    ...result,
    message: 'Задолженность погашена',
  }
}

export function updateActiveProfilePaymentStatus(
  state: DemoSimulationState,
  paymentId: string,
  status: PaymentStatus,
): SimulationResult {
  const activeProfile = state.profiles[state.activeProfileId]
  if (!activeProfile) {
    return { state, error: 'Активный профиль не найден' }
  }

  const exists = activeProfile.dashboard.upcoming.some((payment) => payment.id === paymentId)
  if (!exists) {
    return { state, error: 'Платеж не найден' }
  }

  const result = updateActiveProfile(state, (profile) => {
    const upcoming: Payment[] = profile.dashboard.upcoming.map((payment) => {
      if (payment.id !== paymentId) {
        return payment
      }

      if (status === 'frozen') {
        const shiftedDate = addMonthsToIso(payment.nextChargeDate, 1)
        return {
          ...payment,
          nextChargeDate: shiftedDate,
          periodLabel: getPeriodLabel(shiftedDate),
          status: 'expected',
          statusLabel: STATUS_LABELS.expected,
        }
      }

      return {
        ...payment,
        status,
        statusLabel: STATUS_LABELS[status],
      }
    })

    return {
      ...profile,
      dashboard: rebuildDashboard(
        {
          ...profile.dashboard,
          upcoming,
        },
        state.currentDate,
      ),
    }
  })

  return {
    ...result,
    message: 'Статус платежа обновлен',
  }
}

export function addActiveProfileManualPayment(
  state: DemoSimulationState,
  payload: CreatePaymentPayload,
): SimulationResult {
  const title = payload.title.trim()
  if (!title) {
    return { state, error: 'Укажите название платежа' }
  }

  const amount = Math.round(Number(payload.amount))
  if (!Number.isFinite(amount) || amount <= 0) {
    return { state, error: 'Сумма должна быть больше нуля' }
  }

  const nextChargeDate =
    typeof payload.nextChargeDate === 'string' && isIsoDate(payload.nextChargeDate)
      ? payload.nextChargeDate
      : addDaysToIso(state.currentDate, 1)

  const payment: Payment = {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    provider: payload.category || 'SmartDebit',
    amount,
    category: payload.category || 'Прочее',
    mandatory: Boolean(payload.mandatory),
    status: 'expected',
    statusLabel: STATUS_LABELS.expected,
    nextChargeDate,
    periodLabel: getPeriodLabel(nextChargeDate),
    source: 'manual',
  }

  const result = updateActiveProfile(state, (profile) => ({
    ...profile,
    dashboard: rebuildDashboard(
      {
        ...profile.dashboard,
        upcoming: [...profile.dashboard.upcoming, payment],
      },
      state.currentDate,
    ),
  }))

  return {
    ...result,
    message: 'Новый платеж добавлен',
  }
}
