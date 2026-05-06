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
import { authApi, smartDebitApi, type ApiTransaction } from './api'
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
  repeatOperation?: {
    title?: string
    subtitle?: string
    amount?: number
  }
}

function mapRepeatOperationToFavorite(
  repeatOperation: PaymentsLocationState['repeatOperation'],
): FavoritePaymentEntry | null {
  const title = repeatOperation?.title?.trim() || ''
  const subtitle = repeatOperation?.subtitle?.trim() || 'Повтор операции'
  const amount = Math.round(Math.abs(Number(repeatOperation?.amount) || 0))

  if (!title || !Number.isFinite(amount) || amount <= 0) {
    return null
  }

  return {
    id: `repeat-${title.toLowerCase()}-${amount}`,
    title,
    subtitle,
    account: 'По данным прошлой операции',
    lastAmount: amount,
    icon: Phone,
  }
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

const PROFILE = {
  fullName: 'Иван Иванов',
  cardNameLatin: 'IVAN IVANOV',
  clientId: '428531',
  phone: '+7 (900) 123-45-67',
  email: 'ivan.ivanov@example.com',
  city: 'Москва',
}

const WALLET_CASHBACK_BY_USER: Record<string, number> = {
  user1: 601,
  user2: 520,
  user3: 740,
  user4: 410,
  user5: 990,
  user6: 350,
  user7: 860,
  user8: 470,
  user9: 630,
  user10: 1200,
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
  baseOperations: BankOperation[] = [],
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
  profileName,
  walletCashback,
  onTopUp,
  onSpend,
}: {
  dashboard: DashboardPayload | null
  loading: boolean
  error: string
  userHistory?: HomeHistoryItem[]
  profileName: string
  walletCashback: number
  onTopUp: (amount: number) => Promise<boolean>
  onSpend: (amount: number) => Promise<boolean>
}) {
  const historyItems = useMemo<HomeHistoryItem[]>(() => {
    return userHistory ?? []
  }, [userHistory])

  const [isCardBackVisible, setCardBackVisible] = useState(false)
  const [activeDetail, setActiveDetail] = useState<OperationDetail | null>(null)
  const [balanceAction, setBalanceAction] = useState<'spend' | 'topup' | null>(null)
  const [balanceAmount, setBalanceAmount] = useState('1500')
  const [balanceSubmitting, setBalanceSubmitting] = useState(false)
  const greetingName = profileName.trim().split(/\s+/)[0] || 'клиент'

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

  async function submitBalanceAction(event: FormEvent) {
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
    setBalanceSubmitting(true)
    const actionSucceeded =
      balanceAction === 'spend'
        ? await onSpend(normalizedAmount)
        : await onTopUp(normalizedAmount)
    setBalanceSubmitting(false)

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
      toast.success('Скопировано', { id: 'home-card-copy' })
    } catch {
      toast.error('Не удалось скопировать', { id: 'home-card-copy' })
    }
  }

  return (
    <section className="home-screen">
      <h1 className="home-title">Добрый день, {greetingName}</h1>
      {loading ? <p className="home-note">Загружаем данные...</p> : null}
      {error ? <p className="home-error">{error}</p> : null}

      <div className="home-layout">
        <aside className="home-left-column">
          <article className="home-wallet-card">
            <div className="wallet-row">
              <span className="wallet-currency">₽</span>
              <div className="wallet-balance-wrap">
                <p className="wallet-balance">
                  {formatCurrency(dashboard?.account.balance ?? 0)}
                </p>
                <small>Black</small>
              </div>
              <span className="wallet-chip">
                <Crown size={11} strokeWidth={2.5} />
                <span>{numberFormatter.format(walletCashback)} ₽</span>
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
            onClick={() => toast('У вас уже открыто все, что нужно', { id: 'home-open-product' })}
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

            {dashboard?.enabled ? (
              <>
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
              </>
            ) : (
              <div className="home-smartdebit-disabled">
                <p className="muted">SmartDebit выключен. Включите сервис, чтобы видеть будущие списания.</p>
                <Link to="/operations/smartdebit" className="widget-link-btn">
                  Перейти к SmartDebit
                </Link>
              </div>
            )}
          </article>

          <article className="panel home-history-panel">
            <h2>История операций</h2>

            {historyItems.length ? (
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
            ) : (
              <p className="muted">Операции пока не найдены.</p>
            )}
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

              <button type="submit" className="primary" disabled={balanceSubmitting}>
                {balanceAction === 'spend'
                  ? `${balanceSubmitting ? 'Списываем' : 'Списать'} ${numberFormatter.format(Number(balanceAmount) || 0)} ₽`
                  : `${balanceSubmitting ? 'Пополняем' : 'Пополнить'} ${numberFormatter.format(Number(balanceAmount) || 0)} ₽`}
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
  onLocalDebit: (amount: number) => Promise<boolean>
  favorites?: FavoritePaymentEntry[]
}) {
  const favoriteList = favorites ?? []
  const location = useLocation()
  const navigate = useNavigate()
  const locationState = location.state as PaymentsLocationState | null
  const initialQuickActionCandidate =
    typeof locationState?.quickAction === 'string' ? locationState.quickAction : null
  const initialQuickAction =
    initialQuickActionCandidate && isPaymentQuickActionId(initialQuickActionCandidate)
      ? initialQuickActionCandidate
      : null
  const initialRepeatPayment = mapRepeatOperationToFavorite(locationState?.repeatOperation)

  const [selectedFavoritePayment, setSelectedFavoritePayment] =
    useState<FavoritePaymentEntry | null>(initialRepeatPayment)
  const [activeQuickAction, setActiveQuickAction] = useState<PaymentQuickActionId | null>(
    initialQuickAction,
  )
  const [payAmount, setPayAmount] = useState(
    initialRepeatPayment ? String(initialRepeatPayment.lastAmount) : '',
  )
  const [paying, setPaying] = useState(false)
  const [payNotice, setPayNotice] = useState(
    initialRepeatPayment
      ? `Повтор операции: ${initialRepeatPayment.title}`
      : initialQuickAction
        ? QUICK_ACTION_NOTICE[initialQuickAction]
        : '',
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
    if (!locationState?.quickAction && !locationState?.repeatOperation) {
      return
    }

    navigate('/payments', { replace: true, state: null })
  }, [locationState?.quickAction, locationState?.repeatOperation, navigate])

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
      void (async () => {
        const paid = await onLocalDebit(amountValue)
        setPaying(false)
        if (!paid) {
          return
        }
        setPayNotice(
          `Оплата ${payment.title}: ${numberFormatter.format(amountValue)} ₽`,
        )
        closeFavoritePayment()
      })()
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

        {favoriteList.length ? (
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
        ) : (
          <p className="muted">Нет операций для автоподбора избранных платежей.</p>
        )}
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
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const currentYear = new Date().getFullYear()
  const [chargeMonth, setChargeMonth] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return String(date.getMonth() + 1).padStart(2, '0')
  })
  const [chargeDay, setChargeDay] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return String(date.getDate()).padStart(2, '0')
  })
  const [category, setCategory] = useState('Прочее')
  const [mandatory, setMandatory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const monthOptions = [
    { value: '01', label: 'Январь' },
    { value: '02', label: 'Февраль' },
    { value: '03', label: 'Март' },
    { value: '04', label: 'Апрель' },
    { value: '05', label: 'Май' },
    { value: '06', label: 'Июнь' },
    { value: '07', label: 'Июль' },
    { value: '08', label: 'Август' },
    { value: '09', label: 'Сентябрь' },
    { value: '10', label: 'Октябрь' },
    { value: '11', label: 'Ноябрь' },
    { value: '12', label: 'Декабрь' },
  ]

  const daysInSelectedMonth = useMemo(() => {
    return new Date(currentYear, Number(chargeMonth), 0).getDate()
  }, [chargeMonth, currentYear])

  function handleChargeMonthChange(nextMonth: string) {
    const daysInNextMonth = new Date(currentYear, Number(nextMonth), 0).getDate()
    setChargeMonth(nextMonth)
    if (Number(chargeDay) > daysInNextMonth) {
      setChargeDay(String(daysInNextMonth).padStart(2, '0'))
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      setError('Укажите название платежа')
      return
    }

    if (normalizedTitle.length > 60) {
      setError('Название не должно превышать 60 символов')
      return
    }

    const amountValue = Number(amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Сумма должна быть больше нуля')
      return
    }

    const nextChargeDate = `${currentYear}-${chargeMonth}-${chargeDay}`

    setSaving(true)
    setError('')

    try {
      await onSave({
        title: normalizedTitle,
        description: description.trim() || undefined,
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
            Описание (необязательно)
            <input
              type="text"
              value={description}
              maxLength={80}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Например, счет 4218"
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
              onWheel={(event) => {
                event.currentTarget.blur()
              }}
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
            <div className="date-select-row">
              <select value={chargeDay} onChange={(event) => setChargeDay(event.target.value)}>
                {Array.from({ length: daysInSelectedMonth }, (_, index) => {
                  const day = String(index + 1).padStart(2, '0')
                  return (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  )
                })}
              </select>
              <select
                value={chargeMonth}
                onChange={(event) => handleChargeMonthChange(event.target.value)}
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            <small className="muted">Год: {currentYear}</small>
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
    () => buildOperationsFeed(dashboard, userOperations ?? []),
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
                      onWheel={(event) => {
                        event.currentTarget.blur()
                      }}
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
                      onWheel={(event) => {
                        event.currentTarget.blur()
                      }}
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
  const [payingDebtId, setPayingDebtId] = useState<string | null>(null)

  const primaryAlert = dashboard?.alerts[0] ?? null
  const primaryAlertPayment = primaryAlert
    ? dashboard?.upcoming.find((payment) => payment.id === primaryAlert.paymentId) ?? null
    : null
  const overdueCount = dashboard?.upcoming.filter((payment) => payment.status === 'overdue').length ?? 0
  const canPayPrimaryAlertNow =
    Boolean(primaryAlert && primaryAlertPayment?.status === 'overdue') &&
    (dashboard?.account.balance ?? 0) >= (primaryAlert?.amount ?? 0)

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

  async function handlePayAlertNow(paymentId: string) {
    setPayingDebtId(paymentId)
    try {
      await onPayDebt(paymentId)
    } finally {
      setPayingDebtId(null)
    }
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
                  overdueCount ? ' smartdebit-hero-stat-warn' : ''
                }`}
                role="listitem"
              >
                <span className="smartdebit-hero-stat-icon">
                  <AlertTriangle size={18} aria-hidden />
                </span>
                <span className="smartdebit-hero-stat-body">
                  <span className="smartdebit-hero-stat-label">Просрочек</span>
                  <span className="smartdebit-hero-stat-value">{overdueCount}</span>
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
            {primaryAlert ? (
              <div className="danger-box">
                <p>
                  {primaryAlert.title} · {numberFormatter.format(primaryAlert.amount)} ₽
                </p>
                {primaryAlertPayment?.status === 'overdue' && !canPayPrimaryAlertNow ? (
                  <small className="danger-box-help">
                    Пополните карту, чтобы погасить задолженность.
                  </small>
                ) : null}
                {primaryAlertPayment?.status === 'overdue' ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      void handlePayAlertNow(primaryAlert.paymentId)
                    }}
                    disabled={!canPayPrimaryAlertNow || payingDebtId === primaryAlert.paymentId}
                  >
                    {payingDebtId === primaryAlert.paymentId ? 'Погашаем...' : 'Погасить сейчас'}
                  </button>
                ) : null}
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

function normalizeTransactionDateISO(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function formatTransactionDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Операция по карте'
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24))
  const timeLabel = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (dayDiff === 0) {
    return `Сегодня, ${timeLabel}`
  }
  if (dayDiff === 1) {
    return `Вчера, ${timeLabel}`
  }

  return `${formatDate(date.toISOString())}, ${timeLabel}`
}

function formatTransactionDayLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Недавно'
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function mapTransactionAmount(transaction: ApiTransaction) {
  const normalizedAmount = Math.abs(Number(transaction.amount) || 0)
  return transaction.direction === 'income' ? normalizedAmount : -normalizedAmount
}

function transactionsToBankOperations(transactions: ApiTransaction[]): BankOperation[] {
  return transactions.map((transaction) => {
    const amount = mapTransactionAmount(transaction)
    return {
      id: `tx-${transaction.id}`,
      title: formatPaymentTitle(transaction.merchantName),
      subtitle: 'Операция по карте',
      dateLabel: formatTransactionDateLabel(transaction.transactionDate),
      dateISO: normalizeTransactionDateISO(transaction.transactionDate),
      amount,
      tone: amount >= 0 ? 'success' : 'neutral',
    }
  })
}

function resolveFavoriteIconByMerchant(merchantName: string) {
  const value = merchantName.toLowerCase()

  if (/(мтс|мегафон|tele2|yota|билайн|мобил|sim)/.test(value)) {
    return Smartphone
  }
  if (/(интернет|wifi|роутер|ростелеком|akado|tv|kion|netflix|spotify|start)/.test(value)) {
    return Wifi
  }
  if (/(жкх|квартплат|коммун|вода|газ|домсервис|ук)/.test(value)) {
    return Home
  }
  if (/(энерг|электр)/.test(value)) {
    return Zap
  }
  if (/(такси|авто|карш|метро|тройка|sapsan|транспорт)/.test(value)) {
    return Car
  }

  return Phone
}

function transactionsToFavorites(transactions: ApiTransaction[]): FavoritePaymentEntry[] {
  const grouped = new Map<
    string,
    { merchantName: string; count: number; latestTimestamp: number; latestAmount: number }
  >()

  for (const transaction of transactions) {
    if (transaction.direction === 'income') {
      continue
    }

    const merchantName = transaction.merchantName.trim() || 'Операция'
    const key = merchantName.toLowerCase()
    const timestamp = new Date(transaction.transactionDate).getTime()
    const safeTimestamp = Number.isNaN(timestamp) ? 0 : timestamp
    const amount = Math.abs(Number(transaction.amount) || 0)

    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, {
        merchantName,
        count: 1,
        latestTimestamp: safeTimestamp,
        latestAmount: amount,
      })
      continue
    }

    current.count += 1
    if (safeTimestamp >= current.latestTimestamp) {
      current.latestTimestamp = safeTimestamp
      current.latestAmount = amount
      current.merchantName = merchantName
    }
  }

  return Array.from(grouped.entries())
    .sort((left, right) => {
      const byCount = right[1].count - left[1].count
      if (byCount !== 0) {
        return byCount
      }
      return right[1].latestTimestamp - left[1].latestTimestamp
    })
    .slice(0, 6)
    .map(([key, item], index) => ({
      id: `fav-${index}-${key}`,
      title: formatPaymentTitle(item.merchantName),
      subtitle: 'Частый платеж',
      account: 'Быстрый платеж',
      lastAmount: item.latestAmount,
      icon: resolveFavoriteIconByMerchant(item.merchantName),
    }))
}

function transactionsToHomeHistory(transactions: ApiTransaction[]): HomeHistoryItem[] {
  return transactions.slice(0, 8).map((transaction) => {
    const title = formatPaymentTitle(transaction.merchantName)
    const amount = mapTransactionAmount(transaction)
    const initial = title.trim().charAt(0).toUpperCase() || '•'
    const iconTone: HomeHistoryItem['iconTone'] = amount >= 0 ? 'green' : 'dark'

    return {
      id: `home-${transaction.id}`,
      title,
      date: formatTransactionDayLabel(transaction.transactionDate),
      amount,
      icon: initial,
      iconTone,
    }
  })
}

function App() {
  const [currentUsername, setCurrentUsername] = useState<string | null>(() => authApi.getStoredUsername())
  const [profileName, setProfileName] = useState<string>(() => authApi.getStoredUsername() || PROFILE.fullName)
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [transactions, setTransactions] = useState<ApiTransaction[]>([])

  const refreshDashboard = useCallback(async () => {
    setDashboardLoading(true)
    try {
      const dashboardPayload = await smartDebitApi.getDashboard()
      setDashboard(dashboardPayload)
      setDashboardError('')

      setDashboardLoading(false)

      const fallbackName = currentUsername || authApi.getStoredUsername() || PROFILE.fullName
      void authApi
        .getMe()
        .then((me) => {
          setProfileName(me.fullName || me.username || fallbackName)
        })
        .catch(() => {
          setProfileName(fallbackName)
        })

      try {
        const transactionsPayload = await smartDebitApi.getTransactions(60)
        setTransactions(transactionsPayload)
      } catch {
        setTransactions([])
      }
    } catch (error) {
      const message = resolveErrorMessage(error, 'Не удалось загрузить данные SmartDebit')
      setDashboardError(message)
      if (/(401|403|token|credentials|авторизац|учетные данные|доступ)/i.test(message)) {
        authApi.logout()
        setCurrentUsername(null)
        setProfileName(PROFILE.fullName)
        setDashboard(null)
        setTransactions([])
      }
      setDashboardLoading(false)
    }
  }, [currentUsername])

  useEffect(() => {
    if (!currentUsername) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDashboard()
  }, [currentUsername, refreshDashboard])

  const handleLogin = useCallback(async (username: string, password: string) => {
    await authApi.login(username, password)
    const normalizedUsername = username.trim()
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/')
    }
    setCurrentUsername(normalizedUsername)
    setProfileName(normalizedUsername)
    setDashboardError('')
    toast.success('Вход выполнен', { id: 'auth-login' })
  }, [])

  const handleLogout = useCallback(() => {
    authApi.logout()
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/')
    }
    setCurrentUsername(null)
    setProfileName(PROFILE.fullName)
    setDashboard(null)
    setTransactions([])
    setDashboardError('')
    toast.success('Вы вышли из аккаунта', { id: 'auth-logout' })
  }, [])

  const userBankOperations = useMemo(() => {
    return transactionsToBankOperations(transactions)
  }, [transactions])

  const userFavorites = useMemo(() => {
    return transactionsToFavorites(transactions)
  }, [transactions])

  const userHomeHistory = useMemo(() => {
    return transactionsToHomeHistory(transactions)
  }, [transactions])

  const walletCashback = useMemo(() => {
    if (!currentUsername) {
      return 601
    }
    return WALLET_CASHBACK_BY_USER[currentUsername] ?? 601
  }, [currentUsername])

  const applyServerBalance = useCallback((nextBalance: number) => {
    setDashboard((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        account: {
          ...current.account,
          balance: Math.max(0, nextBalance),
          available: Math.max(0, nextBalance),
        },
      }
    })
  }, [])

  const handleToggle = useCallback(
    async (enabled: boolean) => {
      try {
        const result = await smartDebitApi.toggle(enabled)
        await refreshDashboard()
        toast.success(result.enabled ? 'SmartDebit включен' : 'SmartDebit выключен', {
          id: 'smartdebit-toggle',
        })
      } catch (error) {
        toast.error(resolveErrorMessage(error, 'Не удалось изменить состояние SmartDebit'))
      }
    },
    [refreshDashboard],
  )

  const handlePayDebt = useCallback(
    async (paymentId: string) => {
      try {
        const result = await smartDebitApi.payDebt(paymentId)
        toast.success(result.message, { id: `smartdebit-pay-${paymentId}` })
        await refreshDashboard()
      } catch (error) {
        toast.error(resolveErrorMessage(error, 'Не удалось оплатить платёж'), {
          id: `smartdebit-pay-${paymentId}`,
        })
      }
    },
    [refreshDashboard],
  )

  const handleChangeStatus = useCallback(
    async (paymentId: string, status: PaymentStatus) => {
      try {
        const result = await smartDebitApi.updateStatus(paymentId, status)
        toast.success(result.message)
        await refreshDashboard()
      } catch (error) {
        toast.error(resolveErrorMessage(error, 'Не удалось обновить статус платежа'))
      }
    },
    [refreshDashboard],
  )

  const handleHomeTopUp = useCallback(
    async (amount: number) => {
      const normalizedAmount = Math.round(Number(amount))
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        toast.error('Введите корректную сумму')
        return false
      }

      try {
        const result = await smartDebitApi.adjustBalance('topup', normalizedAmount, 'Пополнение счета')
        applyServerBalance(result.newBalance)
        toast.success(result.message)
        await refreshDashboard()
        return true
      } catch (error) {
        toast.error(resolveErrorMessage(error, 'Не удалось пополнить баланс'))
        return false
      }
    },
    [applyServerBalance, refreshDashboard],
  )

  const handleHomeSpend = useCallback(
    async (amount: number) => {
      const normalizedAmount = Math.round(Number(amount))
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        toast.error('Введите корректную сумму')
        return false
      }

      const currentBalance = dashboard?.account.balance ?? 0
      if (normalizedAmount > currentBalance) {
        toast.error('Недостаточно средств для списания')
        return false
      }

      try {
        const result = await smartDebitApi.adjustBalance('spend', normalizedAmount, 'Ручное списание')
        applyServerBalance(result.newBalance)
        toast.success(result.message)
        await refreshDashboard()
        return true
      } catch (error) {
        toast.error(resolveErrorMessage(error, 'Не удалось выполнить списание'))
        return false
      }
    },
    [applyServerBalance, dashboard?.account.balance, refreshDashboard],
  )

  const handleLocalDebit = useCallback(
    async (amount: number) => {
      const normalizedAmount = Math.round(Number(amount))
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        toast.error('Введите корректную сумму')
        return false
      }

      const currentBalance = dashboard?.account.balance ?? 0
      if (normalizedAmount > currentBalance) {
        toast.error('Недостаточно средств для оплаты')
        return false
      }

      try {
        const result = await smartDebitApi.adjustBalance('spend', normalizedAmount, 'Оплата вручную')
        applyServerBalance(result.newBalance)
        await refreshDashboard()
        return true
      } catch (error) {
        toast.error(resolveErrorMessage(error, 'Не удалось провести оплату'))
        return false
      }
    },
    [applyServerBalance, dashboard?.account.balance, refreshDashboard],
  )

  const handleAddPayment = useCallback(
    async (payload: CreatePaymentPayload) => {
      try {
        const result = await smartDebitApi.addPayment(payload)
        toast.success(result.message)
        await refreshDashboard()
      } catch (error) {
        toast.error(resolveErrorMessage(error, 'Не удалось добавить платеж'))
      }
    },
    [refreshDashboard],
  )

  if (!currentUsername) {
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
                  loading={dashboardLoading}
                  error={dashboardError}
                  userHistory={userHomeHistory}
                  profileName={profileName}
                  walletCashback={walletCashback}
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
                  loading={dashboardLoading}
                  error={dashboardError}
                  userOperations={userBankOperations}
                />
              }
            />
            <Route
              path="/operations/smartdebit"
              element={
                <SmartDebitDetailsPage
                  dashboard={dashboard}
                  loading={dashboardLoading}
                  error={dashboardError}
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
