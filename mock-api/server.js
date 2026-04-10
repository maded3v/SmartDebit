const express = require('express')
const cors = require('cors')

const app = express()
const PORT = 4000

app.use(cors())
app.use(express.json())

const STATUS_LABELS = {
  active: 'Активно',
  expected: 'Ожидается',
  predicted: 'Спрогнозировано',
  low_balance: 'Низкий баланс',
  overdue: 'Просрочено',
  disabled: 'Отключено',
  frozen: 'Заморожено',
}

const CATEGORY_COLORS = {
  Развлечения: '#2f7df6',
  ЖКХ: '#03b37d',
  Финансы: '#101828',
  Связь: '#f4b400',
  Прочее: '#9aa4b2',
}

function addDays(date, days) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

function toIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const now = new Date()

const state = {
  smartDebitEnabled: false,
  account: {
    balance: 116783,
    available: 64500,
  },
  payments: [
    {
      id: 'mortgage-sber',
      title: 'Ипотека (Сбербанк)',
      provider: 'Сбербанк',
      amount: 45000,
      category: 'Финансы',
      mandatory: true,
      status: 'overdue',
      nextChargeDate: toIsoDate(addDays(now, -2)),
      periodLabel: 'Оплата за Март 2026',
      source: 'auto',
    },
    {
      id: 'tinkoff-pro',
      title: 'Tinkoff Pro',
      provider: 'Т-Банк',
      amount: 199,
      category: 'Развлечения',
      mandatory: false,
      status: 'active',
      nextChargeDate: toIsoDate(addDays(now, 1)),
      periodLabel: 'Оплата за Апрель 2026',
      source: 'auto',
    },
    {
      id: 'yandex-plus',
      title: 'Яндекс Плюс',
      provider: 'Яндекс',
      amount: 299,
      category: 'Развлечения',
      mandatory: false,
      status: 'low_balance',
      nextChargeDate: toIsoDate(addDays(now, 2)),
      periodLabel: 'Оплата за Апрель 2026',
      source: 'auto',
    },
    {
      id: 'mts',
      title: 'МТС Связь',
      provider: 'МТС',
      amount: 3090,
      category: 'Связь',
      mandatory: true,
      status: 'expected',
      nextChargeDate: toIsoDate(addDays(now, 3)),
      periodLabel: 'Оплата за Апрель 2026',
      source: 'auto',
    },
    {
      id: 'kion',
      title: 'KION',
      provider: 'МТС',
      amount: 249,
      category: 'Развлечения',
      mandatory: false,
      status: 'disabled',
      nextChargeDate: toIsoDate(addDays(now, 4)),
      periodLabel: 'Отключено в Апреле 2026',
      source: 'auto',
    },
    {
      id: 'alpha-loan',
      title: 'Кредит (Альфа)',
      provider: 'Альфа-Банк',
      amount: 12500,
      category: 'Финансы',
      mandatory: true,
      status: 'predicted',
      nextChargeDate: toIsoDate(addDays(now, 6)),
      periodLabel: 'Оплата за Апрель 2026',
      source: 'auto',
    },
  ],
  notifications: [
    {
      id: 'notif-1',
      title: 'Завтра списание 199 ₽ за Tinkoff Pro',
      subtitle: 'Проверьте, что на счете хватает средств',
      level: 'neutral',
    },
    {
      id: 'notif-2',
      title: 'Неоплаченный платеж: Ипотека (Сбербанк)',
      subtitle: 'Рекомендуем закрыть задолженность сегодня',
      level: 'critical',
    },
  ],
}

function serializePayment(payment) {
  return {
    ...payment,
    statusLabel: STATUS_LABELS[payment.status],
  }
}

function buildDashboard() {
  const nowDate = new Date()
  const weekBorder = addDays(nowDate, 7)

  const upcoming = state.payments
    .filter((payment) => {
      const chargeDate = new Date(payment.nextChargeDate)
      return chargeDate <= weekBorder
    })
    .sort((left, right) => {
      return new Date(left.nextChargeDate) - new Date(right.nextChargeDate)
    })

  const alerts = upcoming
    .filter((payment) => payment.status === 'overdue')
    .map((payment) => ({
      id: `alert-${payment.id}`,
      paymentId: payment.id,
      title: `Просрочен платеж: ${payment.title}`,
      amount: payment.amount,
    }))

  const chartAccumulator = upcoming
    .filter((payment) => payment.status !== 'disabled' && payment.status !== 'frozen')
    .reduce((accumulator, payment) => {
      accumulator[payment.category] = (accumulator[payment.category] || 0) + payment.amount
      return accumulator
    }, {})

  const chart = Object.entries(chartAccumulator).map(([category, amount]) => ({
    category,
    amount,
    color: CATEGORY_COLORS[category] || CATEGORY_COLORS['Прочее'],
  }))

  return {
    enabled: state.smartDebitEnabled,
    account: state.account,
    alerts,
    upcoming: upcoming.map(serializePayment),
    chart,
    notifications: state.notifications,
    generatedAt: new Date().toISOString(),
  }
}

function validateStatus(nextStatus) {
  return [
    'active',
    'expected',
    'predicted',
    'low_balance',
    'overdue',
    'disabled',
    'frozen',
  ].includes(nextStatus)
}

app.get('/api/v1/smartdebit/dashboard', (_request, response) => {
  response.json(buildDashboard())
})

app.post('/api/v1/smartdebit/toggle', (request, response) => {
  if (typeof request.body.enabled !== 'boolean') {
    response.status(400).json({
      message: 'Поле enabled должно быть boolean',
    })
    return
  }

  state.smartDebitEnabled = request.body.enabled
  response.json({ enabled: state.smartDebitEnabled })
})

app.post('/api/v1/smartdebit/payments', (request, response) => {
  const { title, amount, nextChargeDate, category, mandatory } = request.body

  if (!title || typeof title !== 'string') {
    response.status(400).json({ message: 'Укажите название платежа' })
    return
  }

  if (typeof amount !== 'number' || amount <= 0) {
    response.status(400).json({ message: 'Сумма должна быть больше нуля' })
    return
  }

  const dateValue = new Date(nextChargeDate)
  if (Number.isNaN(dateValue.getTime())) {
    response.status(400).json({ message: 'Некорректная дата платежа' })
    return
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (dateValue < today) {
    response.status(400).json({
      message: 'Дата нового платежа должна быть не раньше сегодняшнего дня',
    })
    return
  }

  const payment = {
    id: `manual-${Date.now()}`,
    title,
    provider: 'Ручной платеж',
    amount,
    category: category || 'Прочее',
    mandatory: Boolean(mandatory),
    status: 'expected',
    nextChargeDate: toIsoDate(dateValue),
    periodLabel: 'Добавлено вручную',
    source: 'manual',
  }

  state.payments.push(payment)
  response.status(201).json(serializePayment(payment))
})

app.patch('/api/v1/smartdebit/payments/:paymentId/status', (request, response) => {
  const payment = state.payments.find((entry) => entry.id === request.params.paymentId)

  if (!payment) {
    response.status(404).json({ message: 'Платеж не найден' })
    return
  }

  const nextStatus = request.body.status
  if (!validateStatus(nextStatus)) {
    response.status(400).json({ message: 'Недопустимый статус' })
    return
  }

  if (payment.mandatory && (nextStatus === 'disabled' || nextStatus === 'frozen')) {
    response.status(403).json({
      message: 'Обязательный платеж нельзя отключить или заморозить',
    })
    return
  }

  payment.status = nextStatus
  response.json(serializePayment(payment))
})

app.post('/api/v1/smartdebit/payments/:paymentId/pay-debt', (request, response) => {
  const payment = state.payments.find((entry) => entry.id === request.params.paymentId)

  if (!payment) {
    response.status(404).json({ message: 'Платеж не найден' })
    return
  }

  if (state.account.balance < payment.amount) {
    response.status(409).json({
      message: 'Недостаточно средств на счете',
    })
    return
  }

  state.account.balance -= payment.amount
  state.account.available = Math.max(0, state.account.available - payment.amount)
  payment.status = 'active'
  payment.nextChargeDate = toIsoDate(addDays(new Date(), 30))
  payment.periodLabel = 'Долг погашен, следующее списание через месяц'

  response.json({
    message: 'Задолженность успешно погашена',
    payment: serializePayment(payment),
    account: state.account,
  })
})

app.get('/api/v1/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/', (_request, response) => {
  response.json({
    service: 'SmartDebit mock API',
    status: 'running',
    endpoints: [
      'GET /api/v1/health',
      'GET /api/v1/smartdebit/dashboard',
      'POST /api/v1/smartdebit/toggle',
      'POST /api/v1/smartdebit/payments',
      'PATCH /api/v1/smartdebit/payments/:paymentId/status',
      'POST /api/v1/smartdebit/payments/:paymentId/pay-debt',
    ],
  })
})

app.listen(PORT, () => {
  console.log(`SmartDebit mock API listening on http://localhost:${PORT}`)
})
