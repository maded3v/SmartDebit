import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import './App.css'
import type { FormEvent } from 'react'
import { LoginPage } from './components/LoginPage'
import {
  USER_DATASETS,
  buildUserChart,
  buildUserNotifications,
  toUpcomingPayments,
  getFavoriteIcon,
  operationISO,
  type UserDataset,
  type UserOperation,
  type UserFavorite,
  type UserUpcoming,
} from './userData'
import {
  ArrowLeftRight,
  Briefcase,
  Car,
  Check,
  Copy,
  CirclePlus,
  ChevronDown,
  ChevronRight,
  Crown,
  FileText,
  GraduationCap,
  HandCoins,
  Home,
  Landmark,
  LogOut,
  Mail,
  PiggyBank,
  Phone,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  AlertTriangle,
  CalendarClock,
  User,
  UserCheck,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import type {
  CreatePaymentPayload,
  DashboardPayload,
  Payment,
  PaymentStatus,
} from './types'
import toast from 'react-hot-toast'
import { AppHeader } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { OperationDetailDialog } from './components/OperationDetailDialog'
import { buildOperationDetail, brandColorFor, brandInitial, categoryFor } from './operationDetails'
import type { OperationDetail } from './operationDetails'

type StatusTone = 'green' | 'yellow' | 'red' | 'gray'

interface BankOperation {
  id: string
  title: string
  subtitle: string
  dateLabel: string
  /** ISO date string (yyyy-mm-dd) used for grouping/sorting. */
  dateISO: string
  amount: number
  smartTag?: string
  tone: 'neutral' | 'danger' | 'success'
}

interface HomeHistoryItem {
  id: string
  title: string
  date: string
  amount: number
  icon: string
  iconTone: 'green' | 'dark' | 'gray' | 'red'
  smartTag?: string
}

interface FavoritePaymentEntry {
  id: string
  title: string
  subtitle: string
  account: string
  lastAmount: number
  icon: typeof Phone
}

interface PaymentQuickActionEntry {
  id: string
  label: string
  icon: typeof Phone
}

interface PaymentServiceEntry {
  id: string
  label: string
  icon: typeof Phone
}

interface ProfileSettingItem {
  id: string
  icon: typeof Phone
  label: string
  tone: 'blue' | 'purple'
}

type PaymentQuickActionId = PaymentQuickActionEntry['id']
type OperationsFilterId = 'all' | 'income' | 'expense' | 'subscriptions'

interface PaymentsLocationState {
  quickAction?: string
}

const STATUS_TONE: Record<PaymentStatus, StatusTone> = {
  active: 'green',
  expected: 'yellow',
  predicted: 'green',
  low_balance: 'red',
  overdue: 'red',
  cancelled: 'gray',
  disabled: 'gray',
  frozen: 'gray',
  paid: 'green',
}

function isoDaysAgo(days: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

const BASE_OPERATIONS: BankOperation[] = [
  {
    id: 'salary-1',
    title: 'Зарплата',
    subtitle: 'Acme Team',
    dateLabel: 'Сегодня, 09:12',
    dateISO: isoDaysAgo(0),
    amount: 85000,
    tone: 'success',
  },
  {
    id: 'samokat-1',
    title: 'Самокат',
    subtitle: 'Еда и продукты',
    dateLabel: 'Сегодня, 12:41',
    dateISO: isoDaysAgo(0),
    amount: -1250,
    tone: 'neutral',
  },
  {
    id: 'wildberries-1',
    title: 'Wildberries',
    subtitle: 'Покупки',
    dateLabel: 'Вчера, 21:07',
    dateISO: isoDaysAgo(1),
    amount: -3450,
    tone: 'neutral',
  },
  {
    id: 'ozon-1',
    title: 'Ozon',
    subtitle: 'Маркетплейс',
    dateLabel: 'Вчера, 19:23',
    dateISO: isoDaysAgo(1),
    amount: -2300,
    tone: 'neutral',
  },
  {
    id: 'magnit-2',
    title: 'Магнит',
    subtitle: 'Супермаркеты',
    dateLabel: 'Позавчера, 18:50',
    dateISO: isoDaysAgo(2),
    amount: -2340,
    tone: 'neutral',
  },
  {
    id: 'yandex-eda-2',
    title: 'Яндекс Еда',
    subtitle: 'Кафе и доставка',
    dateLabel: '3 дня назад, 14:25',
    dateISO: isoDaysAgo(3),
    amount: -890,
    tone: 'neutral',
  },
  {
    id: 'mts-2',
    title: 'МТС',
    subtitle: 'Мобильная связь',
    dateLabel: '5 дней назад, 10:00',
    dateISO: isoDaysAgo(5),
    amount: -600,
    tone: 'neutral',
  },
]

const PROFILE = {
  fullName: 'Иван Иванов',
  cardNameLatin: 'IVAN IVANOV',
  clientId: '428531',
  phone: '+7 (900) 123-45-67',
  email: 'ivan.ivanov@example.com',
  city: 'Москва',
}

const MERCHANT_LOGOS: Array<{ match: RegExp; src: string; alt: string }> = [
  { match: /зарплат|salary|acme/i, src: '/icons/brands/salary.svg', alt: 'Зарплата' },
  { match: /самокат|samokat/i, src: '/icons/brands/samokat.svg', alt: 'Самокат' },
  { match: /wildberries/i, src: '/icons/brands/wildberries.svg', alt: 'Wildberries' },
  { match: /ozon/i, src: '/icons/brands/ozon.svg', alt: 'Ozon' },
  { match: /яндекс|yandex/i, src: '/icons/brands/yandex.svg', alt: 'Яндекс' },
  { match: /kion/i, src: '/icons/brands/kion.svg', alt: 'KION' },
  { match: /start/i, src: '/icons/brands/start.svg', alt: 'START' },
  { match: /магнит|magnit/i, src: '/icons/brands/magnit.svg', alt: 'Магнит' },
  { match: /сбер|sber|ипотек/i, src: '/icons/brands/sber.svg', alt: 'Сбербанк' },
]

const PAYMENT_QUICK_ACTIONS: PaymentQuickActionEntry[] = [
  { id: 'quick-phone', label: 'По номеру телефона', icon: Phone },
  { id: 'quick-details', label: 'По реквизитам', icon: FileText },
  { id: 'quick-between', label: 'Между счетами', icon: ArrowLeftRight },
  { id: 'quick-qr', label: 'QR-код', icon: QrCode },
]

const QUICK_ACTION_NOTICE: Record<PaymentQuickActionId, string> = {
  'quick-phone': 'Открыт перевод по номеру телефона',
  'quick-details': 'Открыты платежи по реквизитам',
  'quick-between': 'Открыт перевод между счетами',
  'quick-qr': 'Открыта оплата по QR-коду',
}

const OPERATIONS_FILTERS: Array<{ id: OperationsFilterId; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'income', label: 'Доходы' },
  { id: 'expense', label: 'Расходы' },
  { id: 'subscriptions', label: 'Подписки' },
]

const FAVORITE_PAYMENTS: FavoritePaymentEntry[] = [
  {
    id: 'fav-mts',
    title: 'МТС',
    subtitle: 'Мобильная связь',
    account: '+7 (925) 123-45-67',
    lastAmount: 600,
    icon: Smartphone,
  },
  {
    id: 'fav-rostelecom',
    title: 'Ростелеком',
    subtitle: 'Интернет',
    account: 'Договор №847291',
    lastAmount: 890,
    icon: Wifi,
  },
  {
    id: 'fav-zhkh',
    title: 'ЖКХ Квартплата',
    subtitle: 'УК «Домсервис»',
    account: 'ЛС 4820193847',
    lastAmount: 8500,
    icon: Home,
  },
  {
    id: 'fav-energo',
    title: 'МосЭнерго',
    subtitle: 'Электроэнергия',
    account: 'ЛС 7391028456',
    lastAmount: 1340,
    icon: Zap,
  },
  {
    id: 'fav-kindergarten',
    title: 'Детский сад №42',
    subtitle: 'Образование',
    account: 'ИНН 7701234567',
    lastAmount: 3200,
    icon: GraduationCap,
  },
]

const PAYMENT_SERVICES: PaymentServiceEntry[] = [
  { id: 'svc-mobile', label: 'Мобильная связь', icon: Smartphone },
  { id: 'svc-internet', label: 'Интернет и ТВ', icon: Wifi },
  { id: 'svc-communal', label: 'ЖКХ', icon: Home },
  { id: 'svc-fines', label: 'Штрафы ГИБДД', icon: Car },
  { id: 'svc-tax', label: 'Налоги', icon: Receipt },
  { id: 'svc-education', label: 'Образование', icon: GraduationCap },
]

const PROFILE_SETTINGS: ProfileSettingItem[] = [
  { id: 'profile-phone', icon: Phone, label: '+7 123 456-78-90', tone: 'blue' },
  { id: 'profile-email', icon: Mail, label: 'qwert12345@gmail.com', tone: 'blue' },
  { id: 'profile-address', icon: Home, label: 'Адреса', tone: 'blue' },
  { id: 'profile-work', icon: Briefcase, label: 'Работа', tone: 'blue' },
  { id: 'profile-gos', icon: Shield, label: 'Госуслуги', tone: 'purple' },
  { id: 'profile-refresh', icon: RefreshCw, label: 'Автообновление данных', tone: 'blue' },
  { id: 'profile-self', icon: UserCheck, label: 'Самозанятость', tone: 'blue' },
  { id: 'profile-pension', icon: Landmark, label: 'Пенсия на карту Т-Банка', tone: 'blue' },
  { id: 'profile-social', icon: HandCoins, label: 'Соцвыплаты', tone: 'blue' },
]

const numberFormatter = new Intl.NumberFormat('ru-RU')
const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
})

function formatCurrency(value: number, signed = false) {
  const prefix = signed ? (value > 0 ? '+' : value < 0 ? '-' : '') : ''
  return `${prefix}${numberFormatter.format(Math.abs(value))} ₽`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Неизвестная дата'
  }
  return dateFormatter.format(date)
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

function resolveMerchantLogo(...parts: string[]) {
  const value = parts.join(' ').trim()
  if (!value) {
    return null
  }

  return MERCHANT_LOGOS.find((merchant) => merchant.match.test(value)) ?? null
}

function formatPaymentTitle(title: string) {
  const normalized = title.trim()
  if (!normalized) {
    return 'Без названия'
  }

  const lowered = normalized.toLowerCase()
  if (lowered === 'кредит на помидры' || lowered === 'кредит на помидоры') {
    return 'Кредит на помидоры'
  }

  return normalized.slice(0, 1).toUpperCase() + normalized.slice(1)
}

function isPaymentQuickActionId(value: string): value is PaymentQuickActionId {
  return PAYMENT_QUICK_ACTIONS.some((action) => action.id === value)
}

function buildOperationsFeed(
  dashboard: DashboardPayload | null,
  baseOperations: BankOperation[] = BASE_OPERATIONS,
): BankOperation[] {
  if (!dashboard) {
    return baseOperations
  }
  const smartOperations: BankOperation[] = dashboard.upcoming.map((payment) => {
    const tone: BankOperation['tone'] =
      payment.status === 'low_balance' || payment.status === 'overdue' ? 'danger' : 'neutral'
    return {
      id: `smart-${payment.id}`,
      title: formatPaymentTitle(payment.title),
      subtitle: payment.provider,
      dateLabel: `Списание: ${formatDate(payment.nextChargeDate)}`,
      dateISO: new Date(payment.nextChargeDate).toISOString().slice(0, 10),
      amount: -payment.amount,
      smartTag: `SmartDebit · ${payment.periodLabel}`,
      tone,
    }
  })
  return [...baseOperations, ...smartOperations]
}

interface OperationGroup {
  key: string
  label: string
  items: BankOperation[]
}

function formatGroupHeader(iso: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const date = new Date(`${iso}T00:00:00`)
  const ms = date.getTime()
  if (ms === today.getTime()) return 'Сегодня'
  if (ms === yesterday.getTime()) return 'Вчера'

  const formatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(today.getFullYear() !== date.getFullYear() ? { year: 'numeric' } : {}),
  })
  return formatter.format(date)
}

function pluralizeOperations(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'операция'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'операции'
  return 'операций'
}

function groupOperationsByDay(operations: BankOperation[]): OperationGroup[] {
  const map = new Map<string, BankOperation[]>()
  for (const op of operations) {
    const list = map.get(op.dateISO)
    if (list) {
      list.push(op)
    } else {
      map.set(op.dateISO, [op])
    }
  }
  const sortedKeys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  return sortedKeys.map((key) => ({
    key,
    label: formatGroupHeader(key),
    items: map.get(key) ?? [],
  }))
}

function StatusBadge({
  status,
  label,
}: {
  status: PaymentStatus
  label: string
}) {
  return <span className={`status-badge ${STATUS_TONE[status]}`}>{label}</span>
}

function HomePage({
  dashboard,
  loading,
  error,
  userHistory,
  onTopUp,
  onSpend,
}: {
  dashboard: DashboardPayload | null
  loading: boolean
  error: string
  userHistory?: HomeHistoryItem[]
  onTopUp: (amount: number) => boolean
  onSpend: (amount: number) => boolean
}) {
  const historyItems = useMemo<HomeHistoryItem[]>(() => {
    if (userHistory && userHistory.length > 0) {
      return userHistory
    }
    const mortgage = dashboard?.upcoming.find((payment) => payment.id === 'mortgage-sber')
    const kion = dashboard?.upcoming.find((payment) => payment.id === 'kion')
    return [
      {
        id: 'salary-main',
        title: 'Зарплата',
        date: '1 мар',
        amount: 95000,
        icon: '↙',
        iconTone: 'green',
      },
      {
        id: 'mortgage-main',
        title: 'Ипотека (Сбербанк)',
        date: '28 фев',
        amount: -(mortgage?.amount ?? 45000),
        icon: 'Б',
        iconTone: 'dark',
        smartTag: 'SmartDebit · Ежемесячный платеж',
      },
      {
        id: 'samokat-main',
        title: 'Самокат',
        date: '27 фев',
        amount: -1250,
        icon: 'С',
        iconTone: 'green',
      },
      {
        id: 'plus-main',
        title: 'Яндекс Плюс',
        date: '27 фев',
        amount: -299,
        icon: '↻',
        iconTone: 'gray',
        smartTag: 'SmartDebit · Оплата за расчетный период: Март 2026',
      },
      {
        id: 'eda-main',
        title: 'Яндекс Еда',
        date: '26 фев',
        amount: -890,
        icon: 'Я',
        iconTone: 'dark',
      },
      {
        id: 'start-main',
        title: 'START Подписка',
        date: '26 фев',
        amount: -399,
        icon: '↻',
        iconTone: 'gray',
        smartTag: 'SmartDebit · Оплата за расчетный период: Март 2026',
      },
      {
        id: 'magnit-main',
        title: 'Магнит',
        date: '25 фев',
        amount: -2340,
        icon: 'М',
        iconTone: 'red',
      },
      {
        id: 'kion-main',
        title: 'KION',
        date: '24 фев',
        amount: -(kion?.amount ?? 249),
        icon: 'К',
        iconTone: 'gray',
      },
    ]
  }, [dashboard, userHistory])

  const [isCardBackVisible, setCardBackVisible] = useState(false)
  const [activeDetail, setActiveDetail] = useState<OperationDetail | null>(null)
  const [balanceAction, setBalanceAction] = useState<'spend' | 'topup' | null>(null)
  const [balanceAmount, setBalanceAmount] = useState('1500')

  function openBalanceModal(action: 'spend' | 'topup') {
    setBalanceAction(action)
    setBalanceAmount('1500')
  }

  function closeBalanceModal() {
    setBalanceAction(null)
    setBalanceAmount('1500')
  }

  function normalizeAmountInput(value: string) {
    const normalized = value.replace(',', '.').replace(/[^\d.]/g, '')
    const [wholeRaw, ...fractionParts] = normalized.split('.')
    const whole = wholeRaw.slice(0, 9)
    const fraction = fractionParts.join('').slice(0, 2)

    if (!whole && fraction) {
      return `0.${fraction}`
    }

    return fraction ? `${whole}.${fraction}` : whole
  }

  function submitBalanceAction(event: FormEvent) {
    event.preventDefault()
    if (!balanceAction) {
      return
    }

    const amountValue = Number(balanceAmount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error('Введите корректную сумму')
      return
    }

    const normalizedAmount = Math.round(amountValue)
    const actionSucceeded =
      balanceAction === 'spend' ? onSpend(normalizedAmount) : onTopUp(normalizedAmount)

    if (actionSucceeded) {
      closeBalanceModal()
    }
  }

  const openHistoryDetail = useCallback((item: HomeHistoryItem) => {
    setActiveDetail(
      buildOperationDetail({
        id: item.id,
        title: item.title,
        subtitle: item.smartTag ? item.smartTag.replace(/^SmartDebit · /, '') : '',
        amount: item.amount,
        dateLabel: item.date,
        smartTag: item.smartTag,
      }),
    )
  }, [])

  async function copyCardData(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Скопировано')
    } catch {
      toast.error('Не удалось скопировать')
    }
  }

  return (
    <section className="home-screen">
      <h1 className="home-title">Добрый день, Иван</h1>
      {loading ? <p className="home-note">Загружаем данные...</p> : null}
      {error ? <p className="home-error">{error}</p> : null}

      <div className="home-layout">
        <aside className="home-left-column">
          <article className="home-wallet-card">
            <div className="wallet-row">
              <span className="wallet-currency">₽</span>
              <div className="wallet-balance-wrap">
                <p className="wallet-balance">
                  {formatCurrency(dashboard?.account.balance ?? 116783)}
                </p>
                <small>Black</small>
              </div>
              <span className="wallet-chip">
                <Crown size={11} strokeWidth={2.5} />
                <span>601 ₽</span>
              </span>
            </div>

            <div className={isCardBackVisible ? 'wallet-card-preview flipped' : 'wallet-card-preview'}>
              <div className="wallet-card-inner">
                <div className="wallet-card-face wallet-card-front">
                  <span className="wallet-card-bank">T-Банк</span>
                  <button
                    type="button"
                    className="wallet-copy-value"
                    onClick={() => {
                      void copyCardData('6584516117433803')
                    }}
                    aria-label="Скопировать номер карты"
                  >
                    <strong>6584 5161 1743 3803</strong>
                    <Copy size={15} />
                  </button>
                  <Link to="/payments" className="wallet-card-open-link">
                    Открыть карту и платежи
                  </Link>
                </div>

                <div className="wallet-card-face wallet-card-back" aria-hidden={!isCardBackVisible}>
                  <div className="wallet-card-back-grid">
                    <small>Действует до</small>
                    <small>CVV</small>
                    <button
                      type="button"
                      className="wallet-copy-value compact"
                      onClick={() => {
                        void copyCardData('12/28')
                      }}
                      aria-label="Скопировать срок действия"
                    >
                      <strong>12/28</strong>
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      className="wallet-copy-value compact"
                      onClick={() => {
                        void copyCardData('482')
                      }}
                      aria-label="Скопировать CVV"
                    >
                      <strong>482</strong>
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={isCardBackVisible ? 'wallet-flip-btn active' : 'wallet-flip-btn'}
                onClick={() => setCardBackVisible((value) => !value)}
                aria-label={
                  isCardBackVisible ? 'Показать лицевую сторону карты' : 'Показать оборот карты с CVV'
                }
              >
                <RefreshCw size={14} strokeWidth={2.35} />
              </button>
            </div>
          </article>

          <div className="home-actions">
            <button
              type="button"
              className="action-transfer"
              onClick={() => openBalanceModal('spend')}
            >
              <ArrowLeftRight size={17} />
              <span>Списать</span>
            </button>
            <button
              type="button"
              className="action-top-up"
              onClick={() => openBalanceModal('topup')}
            >
              <CirclePlus size={17} />
              <span>Пополнить</span>
            </button>
          </div>

          <article className="home-account-card">
            <span className="account-icon savings">
              <PiggyBank size={15} strokeWidth={2.2} />
            </span>
            <div>
              <p>9 009,42 ₽</p>
              <small>Накопительный счет</small>
            </div>
            <span className="trend-badge">
              <strong>+7,72 ₽</strong>
            </span>
          </article>

          <article className="home-account-card">
            <span className="account-icon invest">
              <Landmark size={15} strokeWidth={2.2} />
            </span>
            <div>
              <p>350 000 ₽</p>
              <small>Вклад «Стабильный»</small>
            </div>
          </article>

          <button
            type="button"
            className="home-open-product-btn"
            onClick={() => toast('У вас уже открыто все, что нужно')}
          >
            <Plus size={18} />
            <span>Открыть новый продукт</span>
          </button>
        </aside>

        <div className="home-right-column">
          <article className="panel home-smartdebit-widget">
            <div className="row-between">
              <h2>SmartDebit</h2>
              <span className={dashboard?.enabled ? 'status-badge green' : 'status-badge gray'}>
                {dashboard?.enabled ? 'Включен' : 'Выключен'}
              </span>
            </div>

            <p className="muted">Ближайшие списания на 7 дней</p>

            <ul className="home-widget-list">
              {(dashboard?.upcoming ?? []).slice(0, 3).map((payment) => (
                <li key={payment.id}>
                  <div>
                    <p>{formatPaymentTitle(payment.title)}</p>
                    <small>{formatDate(payment.nextChargeDate)}</small>
                  </div>
                  <strong>-{numberFormatter.format(payment.amount)} ₽</strong>
                </li>
              ))}
            </ul>

            <Link to="/operations/smartdebit" className="widget-link-btn">
              Открыть SmartDebit
            </Link>
          </article>

          <article className="panel home-history-panel">
            <h2>История операций</h2>

            <ul className="home-history-list">
              {historyItems.map((item) => {
                const merchantLogo = resolveMerchantLogo(item.title)
                const showInitial = !merchantLogo
                const tileColor = showInitial ? brandColorFor(item.title) : undefined

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="history-row"
                      onClick={() => openHistoryDetail(item)}
                      aria-label={`Открыть детали операции ${item.title}`}
                    >
                      <span
                        className={`history-icon ${item.iconTone}${merchantLogo ? ' has-logo' : ' has-initial'}`}
                        style={tileColor ? { backgroundColor: tileColor } : undefined}
                      >
                        {merchantLogo ? (
                          <img src={merchantLogo.src} alt="" className="merchant-logo" />
                        ) : (
                          brandInitial(item.title)
                        )}
                      </span>
                      <div className="history-body">
                        <p>{item.title}</p>
                        <small>{item.date}</small>
                        {item.smartTag ? <small className="history-tag">{item.smartTag}</small> : null}
                      </div>
                      <strong className={item.amount > 0 ? 'amount positive' : 'amount negative'}>
                        {formatCurrency(item.amount, true)}
                      </strong>
                      <ChevronRight size={16} className="history-chevron" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          </article>
        </div>
      </div>

      {balanceAction ? (
        <div className="modal-overlay" role="presentation" onClick={closeBalanceModal}>
          <div
            className="modal-window balance-modal-window"
            role="dialog"
            aria-modal="true"
            aria-label={balanceAction === 'spend' ? 'Списание со счета' : 'Пополнение счета'}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="close-btn" type="button" onClick={closeBalanceModal}>
              x
            </button>

            <h3>{balanceAction === 'spend' ? 'Списание со счета' : 'Пополнение счета'}</h3>
            <p className="muted">Текущий баланс: {formatCurrency(dashboard?.account.balance ?? 0)}</p>

            <form className="form-grid balance-action-form" onSubmit={submitBalanceAction}>
              <label>
                Сумма, ₽
                <input
                  type="text"
                  inputMode="decimal"
                  maxLength={12}
                  autoFocus
                  value={balanceAmount}
                  onChange={(event) => setBalanceAmount(normalizeAmountInput(event.target.value))}
                  placeholder="1500"
                />
              </label>

              <button type="submit" className="primary">
                {balanceAction === 'spend'
                  ? `Списать ${numberFormatter.format(Number(balanceAmount) || 0)} ₽`
                  : `Пополнить ${numberFormatter.format(Number(balanceAmount) || 0)} ₽`}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <OperationDetailDialog detail={activeDetail} onClose={() => setActiveDetail(null)} />
    </section>
  )
}

function CardOverviewPage({
  dashboard,
  onLocalDebit,
  favorites,
}: {
  dashboard: DashboardPayload | null
  onLocalDebit: (amount: number) => void
  favorites?: FavoritePaymentEntry[]
}) {
  const favoriteList = favorites && favorites.length > 0 ? favorites : FAVORITE_PAYMENTS
  const location = useLocation()
  const locationState = location.state as PaymentsLocationState | null
  const initialQuickActionCandidate =
    typeof locationState?.quickAction === 'string' ? locationState.quickAction : null
  const initialQuickAction =
    initialQuickActionCandidate && isPaymentQuickActionId(initialQuickActionCandidate)
      ? initialQuickActionCandidate
      : null

  const [selectedFavoritePayment, setSelectedFavoritePayment] =
    useState<FavoritePaymentEntry | null>(null)
  const [activeQuickAction, setActiveQuickAction] = useState<PaymentQuickActionId | null>(
    initialQuickAction,
  )
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [payNotice, setPayNotice] = useState(
    initialQuickAction ? QUICK_ACTION_NOTICE[initialQuickAction] : '',
  )
  const payTimerRef = useRef<number | null>(null)

  const mandatoryPayments = useMemo(() => {
    return (dashboard?.upcoming ?? []).filter((payment) => payment.mandatory)
  }, [dashboard])

  useEffect(() => {
    if (!payNotice) {
      return
    }
    const timer = setTimeout(() => {
      setPayNotice('')
    }, 3200)

    return () => clearTimeout(timer)
  }, [payNotice])

  useEffect(() => {
    return () => {
      if (payTimerRef.current !== null) {
        clearTimeout(payTimerRef.current)
        payTimerRef.current = null
      }
    }
  }, [])

  function cancelPendingPayment() {
    if (payTimerRef.current !== null) {
      clearTimeout(payTimerRef.current)
      payTimerRef.current = null
    }
  }

  function openFavoritePayment(payment: FavoritePaymentEntry) {
    cancelPendingPayment()
    setSelectedFavoritePayment(payment)
    setPayAmount(String(payment.lastAmount))
  }

  function closeFavoritePayment() {
    cancelPendingPayment()
    setSelectedFavoritePayment(null)
    setPayAmount('')
    setPaying(false)
  }

  function handleFavoritePayment() {
    const amountValue = Number(payAmount)
    const payment = selectedFavoritePayment
    if (!payment || !Number.isFinite(amountValue) || amountValue <= 0) {
      return
    }
    cancelPendingPayment()
    setPaying(true)

    payTimerRef.current = window.setTimeout(() => {
      payTimerRef.current = null
      setPaying(false)
      onLocalDebit(amountValue)
      setPayNotice(
        `Оплата ${payment.title}: ${numberFormatter.format(amountValue)} ₽`,
      )
      closeFavoritePayment()
    }, 700)
  }

  return (
    <section className="payments-page">
      <div className="payments-quick-grid">
        {PAYMENT_QUICK_ACTIONS.map((action) => {
          const Icon = action.icon

          return (
            <button
              key={action.id}
              type="button"
              className={
                action.id === activeQuickAction ? 'payments-quick-card active' : 'payments-quick-card'
              }
              onClick={() => {
                setActiveQuickAction(action.id)
                setPayNotice(QUICK_ACTION_NOTICE[action.id])
              }}
            >
              <span className="payments-quick-icon">
                <Icon size={22} />
              </span>
              <span className="payments-quick-label">{action.label}</span>
            </button>
          )
        })}
      </div>

      <article className="panel card-favorites-panel payments-favorites-panel">
        <h2>Избранные платежи</h2>

        <ul className="favorite-payments-list">
          {favoriteList.map((payment) => {
            const Icon = payment.icon

            return (
              <li key={payment.id}>
                <div className="favorite-payment-main">
                  <span className="favorite-payment-icon">
                    <Icon size={19} />
                  </span>

                  <div className="favorite-payment-content">
                    <p>{payment.title}</p>
                    <small>{payment.subtitle}</small>
                    <small className="favorite-payment-account">{payment.account}</small>
                  </div>
                </div>

                <button
                  type="button"
                  className="favorite-pay-btn"
                  onClick={() => openFavoritePayment(payment)}
                >
                  Оплатить
                </button>
              </li>
            )
          })}
        </ul>
      </article>

      {mandatoryPayments.length ? (
        <article className="panel card-autopay-panel payments-autopay-panel">
          <h2>Автоплатежи</h2>
          <ul className="card-payments-list card-autopay-list">
            {mandatoryPayments.map((payment) => (
              <li key={payment.id}>
                <div>
                  <p>{payment.title}</p>
                  <small>
                    {payment.periodLabel} · {numberFormatter.format(payment.amount)} ₽
                  </small>
                </div>
                <StatusBadge status={payment.status} label={payment.statusLabel} />
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <article className="panel card-services-panel payments-services-panel">
        <h2>Оплата услуг</h2>
        <div className="services-grid">
          {PAYMENT_SERVICES.map((service) => {
            const Icon = service.icon

            return (
              <button key={service.id} type="button" className="service-pay-btn">
                <span className="service-pay-icon">
                  <Icon size={20} />
                </span>
                <span className="service-pay-label">{service.label}</span>
                <ChevronRight size={16} />
              </button>
            )
          })}
        </div>
      </article>

      {payNotice ? (
        <article className="panel card-payments-actions payments-notice-panel">
          <p className="notice">{payNotice}</p>
        </article>
      ) : null}

      {selectedFavoritePayment ? (
        <div className="modal-overlay" role="presentation" onClick={closeFavoritePayment}>
          <div
            className="modal-window"
            role="dialog"
            aria-modal="true"
            aria-label={`Оплата ${selectedFavoritePayment.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="close-btn" type="button" onClick={closeFavoritePayment}>
              x
            </button>

            <h3>Оплата · {selectedFavoritePayment.title}</h3>
            <p className="muted">{selectedFavoritePayment.subtitle}</p>
            <p className="muted">{selectedFavoritePayment.account}</p>

            <div className="favorite-pay-form">
              <label>
                Сумма, ₽
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max="999999"
                  step="0.01"
                  value={payAmount}
                  onChange={(event) => {
                    const next = event.target.value
                    if (next === '' || (next.length <= 12 && Number(next) <= 999999)) {
                      setPayAmount(next)
                    }
                  }}
                />
              </label>

              <button
                type="button"
                className="primary payment-submit-btn"
                onClick={handleFavoritePayment}
                disabled={paying || Number(payAmount) <= 0}
              >
                {paying
                  ? 'Проводим оплату...'
                  : `Оплатить ${numberFormatter.format(Number(payAmount) || 0)} ₽`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function AnalyticsDonut({ slices }: { slices: DashboardPayload['chart'] }) {
  const total = slices.reduce((sum, item) => sum + item.amount, 0)
  const gradient = useMemo(() => {
    if (!slices.length || total <= 0) {
      return 'conic-gradient(#d8dde8 0deg 360deg)'
    }
    let angle = 0
    const tokens = slices.map((slice) => {
      const start = angle
      const delta = (slice.amount / total) * 360
      angle += delta
      return `${slice.color} ${start}deg ${angle}deg`
    })

    return `conic-gradient(${tokens.join(', ')})`
  }, [slices, total])

  return (
    <div className="donut-block">
      <div className="donut" style={{ background: gradient }}>
        <div className="donut-center">
          <strong>{numberFormatter.format(total)} ₽</strong>
          <small>за 7 дней</small>
        </div>
      </div>

      <ul className="legend">
        {slices.map((slice) => (
          <li key={slice.category}>
            <span style={{ background: slice.color }} />
            <p>{slice.category}</p>
            <strong>{numberFormatter.format(slice.amount)} ₽</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function QuickManageModal({
  payment,
  onClose,
  onChangeStatus,
}: {
  payment: Payment
  onClose: () => void
  onChangeStatus: (status: PaymentStatus) => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  const isMandatory = payment.mandatory

  async function applyStatus(status: PaymentStatus) {
    setSubmitting(true)
    try {
      await onChangeStatus(status)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleLabel = payment.status === 'cancelled' ? 'Включить автоплатеж' : 'Отключить автоплатеж'
  const toggleStatus: PaymentStatus = payment.status === 'cancelled' ? 'active' : 'cancelled'

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-window"
        role="dialog"
        aria-modal="true"
        aria-label={`Управление ${payment.title}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close-btn" type="button" onClick={onClose}>
          x
        </button>

        <h3>{payment.title}</h3>
        <p className="muted">{payment.provider}</p>
        <p className="big-amount">{formatCurrency(payment.amount)}</p>
        <p className="muted">Списание: {formatDate(payment.nextChargeDate)}</p>

        <div className="modal-actions">
          <button
            type="button"
            onClick={() => {
              void applyStatus('frozen')
            }}
            disabled={submitting || isMandatory}
          >
            Пропустить месяц
          </button>
          <button
            type="button"
            className="danger-btn"
            onClick={() => {
              void applyStatus(toggleStatus)
            }}
            disabled={submitting || isMandatory}
          >
            {toggleLabel}
          </button>
        </div>

        {isMandatory ? (
          <p className="muted">Это обязательный платеж, его нельзя отключить.</p>
        ) : null}
      </div>
    </div>
  )
}

function AddPaymentModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (payload: CreatePaymentPayload) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [nextChargeDate, setNextChargeDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return date.toISOString().slice(0, 10)
  })
  const [category, setCategory] = useState('Прочее')
  const [mandatory, setMandatory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Укажите название платежа')
      return
    }

    const amountValue = Number(amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Сумма должна быть больше нуля')
      return
    }

    setSaving(true)
    setError('')

    try {
      await onSave({
        title: title.trim(),
        amount: amountValue,
        nextChargeDate,
        category,
        mandatory,
      })
      onClose()
    } catch (saveError) {
      setSaving(false)
      setError(resolveErrorMessage(saveError, 'Не удалось добавить платеж'))
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-window"
        role="dialog"
        aria-modal="true"
        aria-label="Новый платеж"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close-btn" type="button" onClick={onClose}>
          x
        </button>

        <h3>Новый регулярный платеж</h3>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Название
            <input
              type="text"
              value={title}
              maxLength={60}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, аренда квартиры"
            />
          </label>

          <label>
            Сумма
            <input
              type="number"
              inputMode="decimal"
              min="1"
              max="999999"
              step="0.01"
              value={amount}
              onChange={(event) => {
                const next = event.target.value
                if (next === '' || (next.length <= 12 && Number(next) <= 999999)) {
                  setAmount(next)
                }
              }}
              placeholder="25000"
            />
          </label>

          <label>
            Дата списания
            <input
              type="date"
              value={nextChargeDate}
              onChange={(event) => setNextChargeDate(event.target.value)}
            />
          </label>

          <label>
            Категория
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="Финансы">Финансы</option>
              <option value="ЖКХ">ЖКХ</option>
              <option value="Развлечения">Развлечения</option>
              <option value="Связь">Связь</option>
              <option value="Прочее">Прочее</option>
            </select>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={mandatory}
              onChange={(event) => setMandatory(event.target.checked)}
            />
            Обязательный платеж
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  )
}

function OperationsPage({
  dashboard,
  loading,
  error,
  userOperations,
}: {
  dashboard: DashboardPayload | null
  loading: boolean
  error: string
  userOperations?: BankOperation[]
}) {
  const [activeFilter, setActiveFilter] = useState<OperationsFilterId>('all')
  const [activeDetail, setActiveDetail] = useState<OperationDetail | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [merchantQuery, setMerchantQuery] = useState('')
  const operations = useMemo(
    () => buildOperationsFeed(dashboard, userOperations && userOperations.length > 0 ? userOperations : undefined),
    [dashboard, userOperations],
  )

  const openOperationDetail = useCallback((operation: BankOperation) => {
    setActiveDetail(
      buildOperationDetail({
        id: operation.id,
        title: operation.title,
        subtitle: operation.subtitle,
        amount: operation.amount,
        dateLabel: operation.dateLabel,
        smartTag: operation.smartTag,
      }),
    )
  }, [])

  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    for (const op of operations) {
      set.add(categoryFor(op.title, op.subtitle))
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [operations])

  const minAmountNumber = useMemo(() => {
    const value = parseFloat(minAmount.replace(/[^\d.-]/g, ''))
    return Number.isFinite(value) ? value : null
  }, [minAmount])

  const maxAmountNumber = useMemo(() => {
    const value = parseFloat(maxAmount.replace(/[^\d.-]/g, ''))
    return Number.isFinite(value) ? value : null
  }, [maxAmount])

  const trimmedSearch = searchQuery.trim().toLowerCase()
  const trimmedMerchant = merchantQuery.trim().toLowerCase()

  const filteredOperations = useMemo(() => {
    return operations.filter((operation) => {
      if (activeFilter === 'income' && operation.amount <= 0) return false
      if (activeFilter === 'expense' && operation.amount >= 0) return false
      if (activeFilter === 'subscriptions' && !operation.smartTag) return false

      if (trimmedSearch) {
        const haystack = [operation.title, operation.subtitle, operation.smartTag ?? '']
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(trimmedSearch)) return false
      }

      if (trimmedMerchant) {
        const haystack = `${operation.title} ${operation.subtitle}`.toLowerCase()
        if (!haystack.includes(trimmedMerchant)) return false
      }

      if (selectedCategories.length > 0) {
        const category = categoryFor(operation.title, operation.subtitle)
        if (!selectedCategories.includes(category)) return false
      }

      const absAmount = Math.abs(operation.amount)
      if (minAmountNumber !== null && absAmount < minAmountNumber) return false
      if (maxAmountNumber !== null && absAmount > maxAmountNumber) return false

      return true
    })
  }, [
    activeFilter,
    operations,
    trimmedSearch,
    trimmedMerchant,
    selectedCategories,
    minAmountNumber,
    maxAmountNumber,
  ])

  const operationGroups = useMemo(
    () => groupOperationsByDay(filteredOperations),
    [filteredOperations],
  )

  const activeFilterCount =
    (trimmedSearch ? 1 : 0) +
    (trimmedMerchant ? 1 : 0) +
    selectedCategories.length +
    (minAmountNumber !== null ? 1 : 0) +
    (maxAmountNumber !== null ? 1 : 0) +
    (activeFilter !== 'all' ? 1 : 0)

  function toggleCategory(category: string) {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((value) => value !== category) : [...prev, category],
    )
  }

  function clearAllFilters() {
    setActiveFilter('all')
    setSearchQuery('')
    setSelectedCategories([])
    setMinAmount('')
    setMaxAmount('')
    setMerchantQuery('')
  }

  const upcomingPayments = useMemo(() => {
    return [...(dashboard?.upcoming ?? [])].sort((left, right) => {
      return new Date(left.nextChargeDate).getTime() - new Date(right.nextChargeDate).getTime()
    })
  }, [dashboard])

  const upcomingTotal = useMemo(() => {
    return upcomingPayments
      .filter((payment) => !['frozen', 'cancelled', 'paid'].includes(payment.status))
      .reduce((sum, payment) => sum + payment.amount, 0)
  }, [upcomingPayments])

  const nextPayment = upcomingPayments[0] ?? null

  return (
    <section className="operations-screen">
      <Link to="/operations/smartdebit" className="smartdebit-strip">
        <div className="smartdebit-strip-body">
          <strong>SmartDebit</strong>
          {loading ? (
            <>
              <p>Загружаем информацию по SmartDebit...</p>
              <small>Подождите несколько секунд.</small>
            </>
          ) : dashboard?.enabled ? (
            <>
              <p>
                На ближайшие 7 дней спишется {formatCurrency(upcomingTotal)}
              </p>
              <small>
                {nextPayment
                  ? `Ближайшее списание: ${formatDate(nextPayment.nextChargeDate)} · ${formatCurrency(nextPayment.amount)}`
                  : 'Ближайших списаний нет'}
              </small>
            </>
          ) : (
            <>
              <p>Сервис выключен. Включите SmartDebit, чтобы видеть будущие списания.</p>
              <small>Нажмите, чтобы открыть подробности.</small>
            </>
          )}
        </div>
        <span className="smartdebit-strip-action">Открыть детали</span>
      </Link>

      {error ? <p className="error">{error}</p> : null}

      <div className="page-grid operations-grid without-smartdebit">
        <div className="column wide">
          <article className="panel">
            <div className="row-between wrap">
              <h2>Операции</h2>
              <div className="filter-row" role="group" aria-label="Фильтры операций">
                {OPERATIONS_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={activeFilter === filter.id ? 'active' : ''}
                    onClick={() => {
                      setActiveFilter(filter.id)
                    }}
                    aria-pressed={activeFilter === filter.id}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="operations-search">
              <label className="operations-search-input">
                <Search size={16} aria-hidden />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Поиск по операциям и тегам"
                  aria-label="Поиск по операциям"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="operations-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Очистить поиск"
                  >
                    <X size={14} aria-hidden />
                  </button>
                ) : null}
              </label>
              <button
                type="button"
                className={`operations-advanced-toggle${advancedOpen ? ' open' : ''}`}
                onClick={() => setAdvancedOpen((value) => !value)}
                aria-expanded={advancedOpen}
              >
                <SlidersHorizontal size={16} aria-hidden />
                <span>Фильтры</span>
                {activeFilterCount > 0 ? (
                  <span className="operations-advanced-count">{activeFilterCount}</span>
                ) : null}
                <ChevronDown size={14} aria-hidden className="operations-advanced-caret" />
              </button>
            </div>

            {advancedOpen ? (
              <div className="operations-advanced" role="group" aria-label="Расширенные фильтры">
                <div className="operations-advanced-row">
                  <label className="operations-advanced-field">
                    <span>Мерчант</span>
                    <input
                      type="text"
                      value={merchantQuery}
                      onChange={(event) => setMerchantQuery(event.target.value)}
                      placeholder="Например, Самокат"
                    />
                  </label>
                  <label className="operations-advanced-field">
                    <span>Сумма от, ₽</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={minAmount}
                      onChange={(event) => setMinAmount(event.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label className="operations-advanced-field">
                    <span>Сумма до, ₽</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={maxAmount}
                      onChange={(event) => setMaxAmount(event.target.value)}
                      placeholder="999 999"
                    />
                  </label>
                </div>

                {availableCategories.length ? (
                  <div className="operations-advanced-categories">
                    <p className="operations-advanced-label">Категории</p>
                    <div className="operations-category-grid">
                      {availableCategories.map((category) => {
                        const checked = selectedCategories.includes(category)
                        return (
                          <button
                            key={category}
                            type="button"
                            className={`operations-category-chip${checked ? ' checked' : ''}`}
                            onClick={() => toggleCategory(category)}
                            aria-pressed={checked}
                          >
                            {checked ? <Check size={14} aria-hidden /> : null}
                            <span>{category}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    className="operations-advanced-clear"
                    onClick={clearAllFilters}
                  >
                    <X size={14} aria-hidden />
                    Сбросить все фильтры
                  </button>
                ) : null}
              </div>
            ) : null}

            {operationGroups.length ? (
              <div className="operation-groups">
                {operationGroups.map((group) => (
                  <section key={group.key} className="operation-group">
                    <header className="operation-group-header">
                      <span>{group.label}</span>
                      <small>
                        {group.items.length}{' '}
                        {pluralizeOperations(group.items.length)}
                      </small>
                    </header>
                    <ul className="operation-list">
                      {group.items.map((operation) => {
                        const merchantLogo = resolveMerchantLogo(
                          operation.title,
                          operation.subtitle,
                        )
                        const tileColor = !merchantLogo
                          ? brandColorFor(operation.title)
                          : undefined

                        return (
                          <li key={operation.id}>
                            <button
                              type="button"
                              className="operation-row"
                              onClick={() => openOperationDetail(operation)}
                              aria-label={`Открыть детали операции ${operation.title}`}
                            >
                              <span
                                className={`operation-icon ${operation.tone}${merchantLogo ? ' has-logo' : ' has-initial'}`}
                                style={
                                  tileColor ? { backgroundColor: tileColor } : undefined
                                }
                              >
                                {merchantLogo ? (
                                  <img
                                    src={merchantLogo.src}
                                    alt=""
                                    className="merchant-logo"
                                  />
                                ) : (
                                  brandInitial(operation.title)
                                )}
                              </span>
                              <div className="operation-body">
                                <p>{operation.title}</p>
                                <small>
                                  {operation.subtitle} · {operation.dateLabel}
                                </small>
                                {operation.smartTag ? (
                                  <small
                                    className={
                                      operation.tone === 'danger'
                                        ? 'smart-tag danger'
                                        : 'smart-tag'
                                    }
                                  >
                                    {operation.smartTag}
                                  </small>
                                ) : null}
                              </div>
                              <strong
                                className={
                                  operation.amount > 0 ? 'amount positive' : 'amount negative'
                                }
                              >
                                {formatCurrency(operation.amount, true)}
                              </strong>
                              <ChevronRight
                                size={16}
                                className="operation-chevron"
                                aria-hidden
                              />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <div className="operations-empty">
                <p>Ничего не нашли по текущим фильтрам.</p>
                {activeFilterCount > 0 ? (
                  <button type="button" className="link-button" onClick={clearAllFilters}>
                    Сбросить фильтры
                  </button>
                ) : null}
              </div>
            )}
          </article>
        </div>
      </div>
      <OperationDetailDialog detail={activeDetail} onClose={() => setActiveDetail(null)} />
    </section>
  )
}

function SmartDebitDetailsPage({
  dashboard,
  loading,
  error,
  onToggle,
  onPayDebt,
  onStatusChange,
  onAddPayment,
}: {
  dashboard: DashboardPayload | null
  loading: boolean
  error: string
  onToggle: (enabled: boolean) => Promise<void>
  onPayDebt: (paymentId: string) => Promise<void>
  onStatusChange: (paymentId: string, status: PaymentStatus) => Promise<void>
  onAddPayment: (payload: CreatePaymentPayload) => Promise<void>
}) {
  const navigate = useNavigate()
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  function handleBackNavigation() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  async function handleChangeStatus(status: PaymentStatus) {
    if (!selectedPayment) {
      return
    }
    await onStatusChange(selectedPayment.id, status)
    setSelectedPayment(null)
  }

  return (
    <section className="smartdebit-details-page">
      <header className="smartdebit-hero">
        <button
          type="button"
          className="back-link back-link-button smartdebit-hero-back"
          onClick={handleBackNavigation}
        >
          <span>←</span>
          Назад
        </button>
        <div className="smartdebit-hero-grid">
          <div className="smartdebit-hero-copy">
            <span className="smartdebit-hero-eyebrow">
              <Sparkles size={14} aria-hidden />
              Умный сервис автосписаний
            </span>
            <h1 className="smartdebit-hero-title">SmartDebit</h1>
            <p className="smartdebit-hero-subtitle">
              Управляйте автосписаниями и контролируйте будущие платежи в одном экране
            </p>
          </div>
          {dashboard ? (
            <div className="smartdebit-hero-stats" role="list">
              <div className="smartdebit-hero-stat" role="listitem">
                <span className="smartdebit-hero-stat-icon">
                  <CalendarClock size={18} aria-hidden />
                </span>
                <span className="smartdebit-hero-stat-body">
                  <span className="smartdebit-hero-stat-label">Всего подписок</span>
                  <span className="smartdebit-hero-stat-value">{dashboard.upcoming.length}</span>
                </span>
              </div>
              <div
                className={`smartdebit-hero-stat${
                  dashboard.alerts.length ? ' smartdebit-hero-stat-warn' : ''
                }`}
                role="listitem"
              >
                <span className="smartdebit-hero-stat-icon">
                  <AlertTriangle size={18} aria-hidden />
                </span>
                <span className="smartdebit-hero-stat-body">
                  <span className="smartdebit-hero-stat-label">Просрочек</span>
                  <span className="smartdebit-hero-stat-value">{dashboard.alerts.length}</span>
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <article className="panel smart-panel smart-panel-full">
        <div className="row-between">
          <h2>Состояние сервиса</h2>
          <label className="switch">
            <input
              type="checkbox"
              checked={Boolean(dashboard?.enabled)}
              onChange={(event) => {
                void onToggle(event.target.checked)
              }}
              disabled={loading}
            />
            <span />
          </label>
        </div>

        {loading ? <p className="muted">Обновляем данные...</p> : null}

        {!loading && dashboard && !dashboard.enabled ? (
          <div className="onboard-box">
            <p>
              Включите SmartDebit, чтобы автоматически отслеживать регулярные
              списания и предупреждать о задолженностях.
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => {
                void onToggle(true)
              }}
            >
              Включить SmartDebit
            </button>
          </div>
        ) : null}

        {!loading && dashboard?.enabled ? (
          <>
            {dashboard.alerts[0] ? (
              <div className="danger-box">
                <p>
                  {dashboard.alerts[0].title} · {numberFormatter.format(dashboard.alerts[0].amount)} ₽
                </p>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    void onPayDebt(dashboard.alerts[0].paymentId)
                  }}
                >
                  Погасить сейчас
                </button>
              </div>
            ) : null}

            <div className="row-between">
              <h3>Ближайшие списания</h3>
              <button
                type="button"
                className="ghost"
                onClick={() => setIsAddModalOpen(true)}
              >
                + Добавить
              </button>
            </div>

            <ul className="payment-list">
              {dashboard.upcoming.map((payment) => (
                <li key={payment.id}>
                  <button
                    type="button"
                    className="payment-item"
                    onClick={() => setSelectedPayment(payment)}
                  >
                    <div>
                      <p>{formatPaymentTitle(payment.title)}</p>
                      <small>
                        {payment.provider} · {formatDate(payment.nextChargeDate)}
                      </small>
                    </div>
                    <div className="payment-side-info">
                      <StatusBadge status={payment.status} label={payment.statusLabel} />
                      {payment.mandatory ? <small className="mandatory">Обязательный</small> : null}
                      <strong>{formatCurrency(payment.amount)}</strong>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <article className="mini-panel">
              <h3>Аналитика</h3>
              <AnalyticsDonut slices={dashboard.chart} />
            </article>

            <article className="mini-panel">
              <h3>Уведомления</h3>
              <ul className="notify-list">
                {dashboard.notifications.map((notification) => (
                  <li key={notification.id}>
                    <p
                      className={
                        notification.level === 'critical' ? 'notification critical' : 'notification'
                      }
                    >
                      {notification.title}
                    </p>
                    <small>{notification.subtitle}</small>
                  </li>
                ))}
              </ul>
            </article>
          </>
        ) : null}
      </article>

      {selectedPayment ? (
        <QuickManageModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onChangeStatus={handleChangeStatus}
        />
      ) : null}

      {isAddModalOpen ? (
        <AddPaymentModal
          onClose={() => setIsAddModalOpen(false)}
          onSave={onAddPayment}
        />
      ) : null}
    </section>
  )
}

function ProfilePage({
  fullName,
  username,
  onLogout,
}: {
  fullName: string
  username?: string
  onLogout?: () => void
}) {
  return (
    <section className="profile-page">
      <div className="profile-page-head">
        <h1 className="profile-page-title">Ваши данные</h1>
        {onLogout ? (
          <button type="button" className="profile-logout" onClick={onLogout}>
            <LogOut size={16} aria-hidden />
            Выйти{username ? ` · ${username}` : ''}
          </button>
        ) : null}
      </div>

      <div className="profile-layout">
        <div>
          <div className="profile-headline">
            <div className="profile-avatar-big">
              <User size={30} />
            </div>
            <span className="profile-name">{fullName}</span>
          </div>

          <div className="profile-pro-banner">
            <div>
              <p className="profile-pro-title">
                Подписка <span className="profile-pro-chip">PRO</span>
              </p>
              <p className="profile-pro-subtitle">Больше кэшбэка и бонусов</p>
            </div>
            <button type="button" className="profile-pro-button">
              Подробнее
            </button>
          </div>
        </div>

        <div className="profile-settings-card">
          {PROFILE_SETTINGS.map((item) => {
            const Icon = item.icon

            return (
              <button key={item.id} type="button" className="profile-settings-row">
                <span
                  className={
                    item.tone === 'purple'
                      ? 'profile-settings-icon purple'
                      : 'profile-settings-icon blue'
                  }
                >
                  <Icon size={19} />
                </span>

                <span className="profile-settings-label">{item.label}</span>
                <ChevronRight size={16} className="profile-settings-chevron" />
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const AUTH_STORAGE_KEY = 'smartdebit:current-user'

function loadStoredUsername(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY)
  } catch {
    return null
  }
}

function persistUsername(username: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (username) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, username)
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

function userOperationsToBank(operations: UserOperation[]): BankOperation[] {
  return operations.map((op) => ({
    id: op.id,
    title: op.title,
    subtitle: op.subtitle,
    dateLabel: op.dateLabel,
    dateISO: operationISO(op),
    amount: op.amount,
    smartTag: op.smartTag,
    tone: op.amount >= 0 ? 'success' : 'neutral',
  }))
}

function userFavoritesToEntries(favorites: UserFavorite[]): FavoritePaymentEntry[] {
  return favorites.map((fav) => ({
    id: fav.id,
    title: fav.title,
    subtitle: fav.subtitle,
    account: fav.account,
    lastAmount: fav.lastAmount,
    icon: getFavoriteIcon(fav.iconKey),
  }))
}

function userOperationsToHomeHistory(operations: UserOperation[]): HomeHistoryItem[] {
  return operations.slice(0, 8).map((op) => {
    const initial = op.title.trim().charAt(0).toUpperCase() || '•'
    const tone: HomeHistoryItem['iconTone'] = op.amount >= 0 ? 'green' : 'dark'
    return {
      id: op.id,
      title: op.title,
      date: op.dateLabel,
      amount: op.amount,
      icon: initial,
      iconTone: tone,
      smartTag: op.smartTag,
    }
  })
}

function buildEffectiveDashboard(
  upcoming: UserUpcoming[],
  balance: number,
  enabled: boolean,
): DashboardPayload {
  const upcomingPayments = toUpcomingPayments(upcoming)
  const overdue = upcoming.filter((item) => item.status === 'overdue')
  return {
    enabled,
    account: {
      balance,
      available: balance,
    },
    alerts: overdue.map((item) => ({
      id: `alert-${item.id}`,
      paymentId: item.id,
      title: item.title,
      amount: item.amount,
    })),
    upcoming: upcomingPayments,
    chart: buildUserChart(upcoming),
    notifications: buildUserNotifications(upcoming),
    generatedAt: new Date().toISOString(),
  }
}

function App() {
  const [currentUsername, setCurrentUsername] = useState<string | null>(() => loadStoredUsername())
  const userDataset = useMemo<UserDataset | null>(() => {
    if (!currentUsername) return null
    return USER_DATASETS.find((entry) => entry.user.username === currentUsername) ?? null
  }, [currentUsername])

  const [balance, setBalance] = useState<number>(userDataset?.balance ?? 0)
  const [upcoming, setUpcoming] = useState<UserUpcoming[]>(userDataset?.upcoming ?? [])
  const [smartDebitEnabled, setSmartDebitEnabled] = useState<boolean>(true)
  const lastUserKeyRef = useRef<string | null>(userDataset?.user.username ?? null)

  const currentUserKey = userDataset?.user.username ?? null
  if (lastUserKeyRef.current !== currentUserKey) {
    lastUserKeyRef.current = currentUserKey
    setBalance(userDataset?.balance ?? 0)
    setUpcoming(userDataset?.upcoming ?? [])
    setSmartDebitEnabled(true)
  }

  const handleLogin = useCallback((username: string) => {
    persistUsername(username)
    setCurrentUsername(username)
  }, [])

  const handleLogout = useCallback(() => {
    persistUsername(null)
    setCurrentUsername(null)
    toast.success('Вы вышли из аккаунта')
  }, [])

  const dashboard = useMemo(() => {
    if (!userDataset) return null
    return buildEffectiveDashboard(upcoming, balance, smartDebitEnabled)
  }, [userDataset, upcoming, balance, smartDebitEnabled])

  const userBankOperations = useMemo(() => {
    if (!userDataset) return [] as BankOperation[]
    return userOperationsToBank(userDataset.operations)
  }, [userDataset])

  const userFavorites = useMemo(() => {
    if (!userDataset) return [] as FavoritePaymentEntry[]
    return userFavoritesToEntries(userDataset.favorites)
  }, [userDataset])

  const userHomeHistory = useMemo(() => {
    if (!userDataset) return [] as HomeHistoryItem[]
    return userOperationsToHomeHistory(userDataset.operations)
  }, [userDataset])

  const profileName = userDataset?.user.fullName ?? PROFILE.fullName

  const handleToggle = useCallback(async (enabled: boolean) => {
    setSmartDebitEnabled(enabled)
    toast.success(enabled ? 'SmartDebit включен' : 'SmartDebit выключен')
  }, [])

  const handlePayDebt = useCallback(
    async (paymentId: string) => {
      const target = upcoming.find((item) => item.id === paymentId)
      if (!target) {
        toast.error('Платёж не найден')
        return
      }
      if (balance < target.amount) {
        toast.error('Недостаточно средств для оплаты')
        return
      }
      setBalance((value) => Math.max(0, value - target.amount))
      setUpcoming((current) => current.filter((item) => item.id !== paymentId))
      toast.success(`Просрочка погашена: ${target.title}`)
    },
    [upcoming, balance],
  )

  const handleChangeStatus = useCallback(
    async (paymentId: string, status: PaymentStatus) => {
      const allowed: UserUpcoming['status'][] = [
        'overdue',
        'expected',
        'active',
        'low_balance',
        'cancelled',
        'frozen',
      ]
      const mapped = (allowed as PaymentStatus[]).includes(status)
        ? (status as UserUpcoming['status'])
        : null
      if (!mapped) {
        toast.error('Этот статус пока не поддерживается')
        return
      }
      setUpcoming((current) =>
        current.map((item) => (item.id === paymentId ? { ...item, status: mapped } : item)),
      )
      toast.success('Статус платежа обновлен')
    },
    [],
  )

  const handleHomeTopUp = useCallback((amount: number) => {
    const normalizedAmount = Math.round(Number(amount))
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast.error('Введите корректную сумму')
      return false
    }

    setBalance((value) => value + normalizedAmount)
    toast.success(`Баланс пополнен на ${numberFormatter.format(normalizedAmount)} ₽`)
    return true
  }, [])

  const handleHomeSpend = useCallback(
    (amount: number) => {
      const normalizedAmount = Math.round(Number(amount))
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        toast.error('Введите корректную сумму')
        return false
      }

      if (normalizedAmount > balance) {
        toast.error('Недостаточно средств для списания')
        return false
      }

      setBalance((value) => value - normalizedAmount)
      toast.success(`Списано ${numberFormatter.format(normalizedAmount)} ₽`)
      return true
    },
    [balance],
  )

  const handleLocalDebit = useCallback((amount: number) => {
    setBalance((value) => Math.max(0, value - amount))
  }, [])

  const handleAddPayment = useCallback(async (payload: CreatePaymentPayload) => {
    const id = `manual-${Date.now()}`
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [chargeYear, chargeMonth, chargeDay] = payload.nextChargeDate
      .split('-')
      .map(Number)
    const charge = new Date(chargeYear, chargeMonth - 1, chargeDay)
    const daysFromToday = Math.round((charge.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const status: UserUpcoming['status'] = daysFromToday < 0 ? 'overdue' : 'expected'
    setUpcoming((current) => [
      ...current,
      {
        id,
        title: payload.title,
        provider: payload.title,
        amount: payload.amount,
        category: payload.category,
        mandatory: payload.mandatory,
        status,
        daysFromToday,
      },
    ])
    toast.success('Новый платеж добавлен')
  }, [])

  if (!currentUsername || !userDataset) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <BrowserRouter>
      <AppHeader
        notifications={dashboard?.notifications ?? []}
        profileName={profileName}
        onLogout={handleLogout}
      />

      <div className="shell">
        <div className="content">
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  dashboard={dashboard}
                  loading={false}
                  error=""
                  userHistory={userHomeHistory}
                  onTopUp={handleHomeTopUp}
                  onSpend={handleHomeSpend}
                />
              }
            />
            <Route
              path="/payments"
              element={
                <CardOverviewPage
                  dashboard={dashboard}
                  onLocalDebit={handleLocalDebit}
                  favorites={userFavorites}
                />
              }
            />
            <Route path="/card-overview" element={<Navigate to="/payments" replace />} />
            <Route
              path="/operations"
              element={
                <OperationsPage
                  dashboard={dashboard}
                  loading={false}
                  error=""
                  userOperations={userBankOperations}
                />
              }
            />
            <Route
              path="/operations/smartdebit"
              element={
                <SmartDebitDetailsPage
                  dashboard={dashboard}
                  loading={false}
                  error=""
                  onToggle={handleToggle}
                  onPayDebt={handlePayDebt}
                  onStatusChange={handleChangeStatus}
                  onAddPayment={handleAddPayment}
                />
              }
            />
            <Route
              path="/profile"
              element={
                <ProfilePage
                  fullName={profileName}
                  username={currentUsername}
                  onLogout={handleLogout}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      <BottomNav />
    </BrowserRouter>
  )
}

export default App
