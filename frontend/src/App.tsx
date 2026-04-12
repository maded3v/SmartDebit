import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { smartDebitApi } from './api'
import './App.css'
import type { FormEvent } from 'react'
import type {
  CreatePaymentPayload,
  DashboardPayload,
  Payment,
  PaymentStatus,
} from './types'

type StatusTone = 'green' | 'yellow' | 'red' | 'gray'

interface BankOperation {
  id: string
  title: string
  subtitle: string
  dateLabel: string
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

const STATUS_TONE: Record<PaymentStatus, StatusTone> = {
  active: 'green',
  expected: 'yellow',
  predicted: 'green',
  low_balance: 'red',
  overdue: 'red',
  cancelled: 'gray',
  disabled: 'gray',
  frozen: 'gray',
}

const BASE_OPERATIONS: BankOperation[] = [
  {
    id: 'salary-1',
    title: 'Зарплата',
    subtitle: 'Acme Team',
    dateLabel: 'Сегодня, 09:12',
    amount: 85000,
    tone: 'success',
  },
  {
    id: 'samokat-1',
    title: 'Самокат',
    subtitle: 'Еда и продукты',
    dateLabel: 'Сегодня, 12:41',
    amount: -1250,
    tone: 'neutral',
  },
  {
    id: 'wildberries-1',
    title: 'Wildberries',
    subtitle: 'Покупки',
    dateLabel: 'Вчера, 21:07',
    amount: -3450,
    tone: 'neutral',
  },
  {
    id: 'ozon-1',
    title: 'Ozon',
    subtitle: 'Маркетплейс',
    dateLabel: 'Вчера, 19:23',
    amount: -2300,
    tone: 'neutral',
  },
]

const PROFILE = {
  shortName: 'II',
  fullName: 'Иван Иванов',
  cardNameLatin: 'IVAN IVANOV',
  clientId: '428531',
  phone: '+7 (900) 123-45-67',
  email: 'ivan.ivanov@example.com',
  city: 'Москва',
}

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

function getOperationIcon(title: string) {
  const normalized = title.trim()
  if (!normalized) {
    return 'O'
  }

  return normalized.slice(0, 1).toUpperCase()
}

function buildOperationsFeed(dashboard: DashboardPayload | null): BankOperation[] {
  if (!dashboard) {
    return BASE_OPERATIONS
  }

  const smartOperations: BankOperation[] = dashboard.upcoming.map((payment) => {
    const tone: BankOperation['tone'] =
      payment.status === 'low_balance' || payment.status === 'overdue'
        ? 'danger'
        : 'neutral'

    return {
      id: `smart-${payment.id}`,
      title: payment.title,
      subtitle: payment.provider,
      dateLabel: `Списание: ${formatDate(payment.nextChargeDate)}`,
      amount: -payment.amount,
      smartTag: `SmartDebit · ${payment.periodLabel}`,
      tone,
    }
  })

  return [...BASE_OPERATIONS, ...smartOperations]
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

function AppHeader() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-logo">T</div>
        <strong>Банк</strong>
      </div>

      <nav className="topbar-nav" aria-label="Основная навигация">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon" aria-hidden="true">
            ⌂
          </span>
          Главная
        </NavLink>
        <NavLink
          to="/operations"
          end
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <span className="nav-icon" aria-hidden="true">
            ↔
          </span>
          Операции
        </NavLink>
        <NavLink
          to="/operations/smartdebit"
          className={({ isActive }) => (isActive ? 'active smart-link' : 'smart-link')}
        >
          <span className="nav-icon" aria-hidden="true">
            ◎
          </span>
          SmartDebit
          <span className="chip">NEW</span>
        </NavLink>
        <NavLink
          to="/card-overview"
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <span className="nav-icon" aria-hidden="true">
            ▣
          </span>
          Платежи
        </NavLink>
      </nav>

      <div className="topbar-right">
        <button type="button" className="notify-btn" aria-label="Уведомления">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3a5 5 0 0 0-5 5v2.8c0 .8-.2 1.5-.7 2.1L5 14.7V16h14v-1.3l-1.3-1.8a3.8 3.8 0 0 1-.7-2.2V8a5 5 0 0 0-5-5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 18a2 2 0 0 0 4 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          <span className="notify-counter">4</span>
        </button>

        <NavLink to="/profile" className="topbar-user">
          <span className="user-avatar">{PROFILE.shortName}</span>
          <span>{PROFILE.fullName}</span>
        </NavLink>
      </div>
    </header>
  )
}

function HomePage({
  dashboard,
  loading,
  error,
}: {
  dashboard: DashboardPayload | null
  loading: boolean
  error: string
}) {
  const historyItems = useMemo<HomeHistoryItem[]>(() => {
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
  }, [dashboard])

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
              <span className="wallet-chip">♥ 601 ₽</span>
            </div>

            <div className="wallet-code-row">
              <span>6584</span>
              <span>5161</span>
              <span>1743</span>
              <span>3803</span>
            </div>

            <button type="button" className="wallet-top-up-btn">
              ▣ Пополните из другого банка
            </button>
          </article>

          <article className="home-account-card">
            <span className="account-icon savings">⌂</span>
            <div>
              <p>9 009,42 ₽</p>
              <small>Накопительный счет</small>
            </div>
            <strong className="trend">+7,72 ₽</strong>
          </article>

          <article className="home-account-card">
            <span className="account-icon invest">✧</span>
            <div>
              <p>350 000 ₽</p>
              <small>Вклад «Стабильный»</small>
            </div>
          </article>

          <div className="home-actions">
            <button type="button" className="action-transfer">
              ↗ Перевод
            </button>
            <button type="button" className="action-pay">
              ▣ Оплатить
            </button>
          </div>
        </aside>

        <article className="panel home-history-panel">
          <h2>История операций</h2>

          <ul className="home-history-list">
            {historyItems.map((item) => (
              <li key={item.id}>
                <span className={`history-icon ${item.iconTone}`}>{item.icon}</span>
                <div className="history-body">
                  <p>{item.title}</p>
                  <small>{item.date}</small>
                  {item.smartTag ? <small className="history-tag">{item.smartTag}</small> : null}
                </div>
                <strong className={item.amount > 0 ? 'amount positive' : 'amount negative'}>
                  {formatCurrency(item.amount, true)}
                </strong>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

function CardOverviewPage({ dashboard }: { dashboard: DashboardPayload | null }) {
  return (
    <section className="page-grid card-overview-grid">
      <article className="panel card-hero">
        <div className="row-between">
          <div>
            <p className="label">Обзор карты</p>
            <h2>Black Debit</h2>
          </div>
          <span className="status-badge green">Активна</span>
        </div>

        <div className="bank-card-visual">
          <p>Т-Банк</p>
          <strong>•••• 2294</strong>
          <small>{PROFILE.cardNameLatin}</small>
        </div>

        <div className="button-row">
          <button type="button">Реквизиты</button>
          <button type="button">Лимиты</button>
          <button type="button">Настройки</button>
        </div>
      </article>

      <article className="panel">
        <h2>Баланс и резервы</h2>
        <ul className="clean-list">
          <li>
            <span>Текущий баланс</span>
            <strong>{formatCurrency(dashboard?.account.balance ?? 116783)}</strong>
          </li>
          <li>
            <span>Зарезервировано SmartDebit</span>
            <strong>
              {formatCurrency(
                (dashboard?.account.balance ?? 116783) -
                  (dashboard?.account.available ?? 64500),
              )}
            </strong>
          </li>
          <li>
            <span>Свободно к тратам</span>
            <strong>{formatCurrency(dashboard?.account.available ?? 64500)}</strong>
          </li>
        </ul>
      </article>

      <article className="panel">
        <h2>Реквизиты</h2>
        <ul className="clean-list">
          <li>
            <span>Номер карты</span>
            <strong>5536 91•• •••• 2294</strong>
          </li>
          <li>
            <span>Счет</span>
            <strong>40817 810 9 0000 1234567</strong>
          </li>
          <li>
            <span>БИК</span>
            <strong>044525974</strong>
          </li>
        </ul>
      </article>

      <article className="panel">
        <h2>Контроль расходов</h2>
        <ul className="bar-list">
          <li>
            <span>Покупки</span>
            <div>
              <b style={{ width: '72%' }} />
            </div>
          </li>
          <li>
            <span>Подписки</span>
            <div>
              <b style={{ width: '38%' }} />
            </div>
          </li>
          <li>
            <span>Переводы</span>
            <div>
              <b style={{ width: '56%' }} />
            </div>
          </li>
        </ul>
      </article>
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
    } finally {
      setSubmitting(false)
    }
  }

  const toggleLabel = payment.status === 'disabled' ? 'Включить автоплатеж' : 'Отключить автоплатеж'
  const toggleStatus: PaymentStatus = payment.status === 'disabled' ? 'active' : 'disabled'

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, аренда квартиры"
            />
          </label>

          <label>
            Сумма
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
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
  notice,
  onToggle,
  onPayDebt,
  onStatusChange,
  onAddPayment,
}: {
  dashboard: DashboardPayload | null
  loading: boolean
  error: string
  notice: string
  onToggle: (enabled: boolean) => Promise<void>
  onPayDebt: (paymentId: string) => Promise<void>
  onStatusChange: (paymentId: string, status: PaymentStatus) => Promise<void>
  onAddPayment: (payload: CreatePaymentPayload) => Promise<void>
}) {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const operations = useMemo(() => buildOperationsFeed(dashboard), [dashboard])

  async function handleChangeStatus(status: PaymentStatus) {
    if (!selectedPayment) {
      return
    }

    await onStatusChange(selectedPayment.id, status)
    setSelectedPayment(null)
  }

  return (
    <section className="page-grid operations-grid">
      <div className="column wide">
        <article className="panel">
          <div className="row-between wrap">
            <h2>Операции</h2>
            <div className="filter-row">
              <button type="button" className="active">Все</button>
              <button type="button">Доходы</button>
              <button type="button">Расходы</button>
              <button type="button">Подписки</button>
            </div>
          </div>

          <ul className="operation-list">
            {operations.map((operation) => (
              <li key={operation.id}>
                <span className={`operation-icon ${operation.tone}`}>
                  {getOperationIcon(operation.title)}
                </span>
                <div className="operation-body">
                  <p>{operation.title}</p>
                  <small>
                    {operation.subtitle} · {operation.dateLabel}
                  </small>
                  {operation.smartTag ? (
                    <small
                      className={
                        operation.tone === 'danger' ? 'smart-tag danger' : 'smart-tag'
                      }
                    >
                      {operation.smartTag}
                    </small>
                  ) : null}
                </div>
                <strong
                  className={operation.amount > 0 ? 'amount positive' : 'amount negative'}
                >
                  {formatCurrency(operation.amount, true)}
                </strong>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="column side">
        <article className="panel smart-panel">
          <div className="row-between">
            <h2>SmartDebit</h2>
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

          {notice ? <p className="notice">{notice}</p> : null}
          {error ? <p className="error">{error}</p> : null}
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
                    {dashboard.alerts[0].title} ·{' '}
                    {numberFormatter.format(dashboard.alerts[0].amount)} ₽
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
                        <p>{payment.title}</p>
                        <small>
                          {payment.provider} · {formatDate(payment.nextChargeDate)}
                        </small>
                      </div>
                      <div className="payment-side-info">
                        <StatusBadge status={payment.status} label={payment.statusLabel} />
                        {payment.mandatory ? (
                          <small className="mandatory">Обязательный</small>
                        ) : null}
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
                          notification.level === 'critical'
                            ? 'notification critical'
                            : 'notification'
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
      </div>

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

function ProfilePage() {
  return (
    <section className="page-grid profile-grid">
      <article className="panel profile-hero">
        <div className="avatar">{PROFILE.shortName}</div>
        <div>
          <h2>{PROFILE.fullName}</h2>
          <p className="muted">Премиум клиент · ID {PROFILE.clientId}</p>
        </div>
        <div className="profile-chip-row">
          <span className="profile-chip">Premium</span>
          <span className="profile-chip">SmartDebit активен</span>
          <span className="profile-chip">Лояльность: 5 лет</span>
        </div>
      </article>

      <article className="panel">
        <h2>Персональные данные</h2>
        <ul className="clean-list">
          <li>
            <span>Телефон</span>
            <strong>{PROFILE.phone}</strong>
          </li>
          <li>
            <span>Email</span>
            <strong>{PROFILE.email}</strong>
          </li>
          <li>
            <span>Город</span>
            <strong>{PROFILE.city}</strong>
          </li>
        </ul>
      </article>

      <article className="panel">
        <h2>Безопасность</h2>
        <ul className="clean-list">
          <li>
            <span>Вход по Face ID</span>
            <strong>Включен</strong>
          </li>
          <li>
            <span>Подтверждение переводов</span>
            <strong>SMS + Push</strong>
          </li>
          <li>
            <span>Последний вход</span>
            <strong>Сегодня, 08:44</strong>
          </li>
        </ul>
      </article>

      <article className="panel">
        <h2>Уведомления</h2>
        <ul className="clean-list">
          <li>
            <span>Операции по карте</span>
            <strong>Мгновенно</strong>
          </li>
          <li>
            <span>Напоминания SmartDebit</span>
            <strong>За 1 день</strong>
          </li>
          <li>
            <span>Маркетинговые предложения</span>
            <strong>Отключены</strong>
          </li>
        </ul>
      </article>

      <article className="panel profile-actions">
        <h2>Быстрые действия</h2>
        <div className="profile-action-grid">
          <button type="button">Изменить лимиты</button>
          <button type="button">Сменить PIN-код</button>
          <button type="button">Выписка PDF</button>
          <button type="button">Поддержка</button>
        </div>
      </article>
    </section>
  )
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
    }

    try {
      const payload = await smartDebitApi.getDashboard()
      setDashboard(payload)
      setError('')
    } catch (loadError) {
      setError(resolveErrorMessage(loadError, 'Не удалось загрузить данные SmartDebit'))
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void refreshDashboard()
  }, [refreshDashboard])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timer = setTimeout(() => {
      setNotice('')
    }, 4000)

    return () => clearTimeout(timer)
  }, [notice])

  const handleToggle = useCallback(
    async (enabled: boolean) => {
      try {
        await smartDebitApi.toggle(enabled)
        await refreshDashboard(true)
        setNotice(enabled ? 'SmartDebit включен' : 'SmartDebit выключен')
      } catch (toggleError) {
        setError(resolveErrorMessage(toggleError, 'Не удалось изменить состояние SmartDebit'))
      }
    },
    [refreshDashboard],
  )

  const handlePayDebt = useCallback(
    async (paymentId: string) => {
      try {
        const result = await smartDebitApi.payDebt(paymentId)
        await refreshDashboard(true)
        setNotice(result.message)
      } catch (debtError) {
        setError(resolveErrorMessage(debtError, 'Не удалось погасить задолженность'))
      }
    },
    [refreshDashboard],
  )

  const handleChangeStatus = useCallback(
    async (paymentId: string, status: PaymentStatus) => {
      try {
        await smartDebitApi.updateStatus(paymentId, status)
        await refreshDashboard(true)
        setNotice('Статус платежа обновлен')
      } catch (statusError) {
        setError(resolveErrorMessage(statusError, 'Не удалось обновить статус платежа'))
      }
    },
    [refreshDashboard],
  )

  const handleAddPayment = useCallback(
    async (payload: CreatePaymentPayload) => {
      try {
        await smartDebitApi.addPayment(payload)
        await refreshDashboard(true)
        setNotice('Новый платеж добавлен')
      } catch (paymentError) {
        throw new Error(resolveErrorMessage(paymentError, 'Не удалось добавить платеж'))
      }
    },
    [refreshDashboard],
  )

  return (
    <BrowserRouter>
      <div className="shell">
        <AppHeader />
        <main className="content">
          <Routes>
            <Route path="/" element={<HomePage dashboard={dashboard} loading={loading} error={error} />} />
            <Route
              path="/card-overview"
              element={<CardOverviewPage dashboard={dashboard} />}
            />
            <Route
              path="/operations"
              element={
                <OperationsPage
                  dashboard={dashboard}
                  loading={loading}
                  error={error}
                  notice={notice}
                  onToggle={handleToggle}
                  onPayDebt={handlePayDebt}
                  onStatusChange={handleChangeStatus}
                  onAddPayment={handleAddPayment}
                />
              }
            />
            <Route
              path="/operations/smartdebit"
              element={
                <OperationsPage
                  dashboard={dashboard}
                  loading={loading}
                  error={error}
                  notice={notice}
                  onToggle={handleToggle}
                  onPayDebt={handlePayDebt}
                  onStatusChange={handleChangeStatus}
                  onAddPayment={handleAddPayment}
                />
              }
            />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
