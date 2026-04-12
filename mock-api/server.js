const express = require('express')
const cors = require('cors')
const { randomUUID } = require('crypto')
const {
  DB_PATH,
  DEFAULT_USER_ID,
  addDays,
  addMonths,
  createDatabase,
  toIsoDate,
  toIsoDateTime,
} = require('./db/bootstrap')

const app = express()
const PORT = 4000
const db = createDatabase()

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
  cancelled: 'Отменено',
}

const AVAILABLE_STATUSES = new Set([
  'active',
  'expected',
  'predicted',
  'low_balance',
  'overdue',
  'disabled',
  'frozen',
  'cancelled',
])

const debtMessagePattern = /неоплачен|просроч|долг/i

const periodFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
})

const PAYMENT_SELECT_SQL = `
  SELECT
    rp.id,
    rp.account_id,
    rp.service_id,
    rp.category_id,
    rp.custom_name,
    rp.amount,
    rp.next_charge_date,
    rp.periodicity,
    rp.is_mandatory,
    rp.status,
    rp.frozen_until,
    sd.name AS service_name,
    sd.provider_name,
    sd.default_is_mandatory,
    c.name AS category_name,
    c.hex_color,
    dr.period_name AS debt_period_name,
    CASE WHEN rp.service_id IS NULL THEN 'manual' ELSE 'auto' END AS source
  FROM "RECURRING_PAYMENT" rp
  LEFT JOIN "SERVICE_DICTIONARY" sd ON sd.id = rp.service_id
  LEFT JOIN "CATEGORY" c ON c.id = rp.category_id
  LEFT JOIN "DEBT_RECORD" dr
    ON dr.recurring_payment_id = rp.id
   AND dr.status = 'unpaid'
`

function toMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function capitalize(value) {
  if (!value) {
    return value
  }
  return value.slice(0, 1).toUpperCase() + value.slice(1)
}

function formatBillingPeriod(dateValue) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return 'текущий период'
  }

  return capitalize(periodFormatter.format(date))
}

function isMandatoryPayment(row) {
  return Boolean(row.is_mandatory || row.default_is_mandatory)
}

function buildPeriodLabel(row) {
  if (row.status === 'disabled') {
    return `Отключено в ${formatBillingPeriod(row.next_charge_date)}`
  }

  if (row.status === 'overdue' && row.debt_period_name) {
    return `Оплата за ${row.debt_period_name}`
  }

  if (row.source === 'manual') {
    return 'Добавлено вручную'
  }

  return `Оплата за расчетный период: ${formatBillingPeriod(row.next_charge_date)}`
}

function serializePaymentRow(row) {
  const title = row.custom_name || row.service_name || 'Регулярный платеж'
  const provider = row.provider_name || row.service_name || 'Ручной платеж'
  const category = row.category_name || 'Прочее'
  const statusLabel = STATUS_LABELS[row.status] || 'Неизвестно'

  return {
    id: row.id,
    title,
    provider,
    amount: toMoney(row.amount),
    category,
    mandatory: isMandatoryPayment(row),
    status: row.status,
    statusLabel,
    nextChargeDate: row.next_charge_date,
    periodLabel: buildPeriodLabel(row),
    source: row.source,
  }
}

function getMainAccount() {
  return db
    .prepare(
      `SELECT id, balance
       FROM "ACCOUNT"
       WHERE user_id = ? AND type = 'Debit'
       ORDER BY rowid
       LIMIT 1`
    )
    .get(DEFAULT_USER_ID)
}

function getAccountSummary(accountId) {
  const account = db
    .prepare(
      `SELECT id, balance
       FROM "ACCOUNT"
       WHERE id = ?`
    )
    .get(accountId)

  if (!account) {
    return {
      balance: 0,
      available: 0,
    }
  }

  const reserved = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM "RECURRING_PAYMENT"
       WHERE account_id = ?
         AND status IN ('active', 'expected', 'predicted', 'low_balance', 'overdue')`
    )
    .get(accountId).total

  const balance = toMoney(account.balance)
  const available = Math.max(0, toMoney(balance - reserved))

  return {
    balance,
    available,
  }
}

function getPaymentRowById(paymentId) {
  return db
    .prepare(
      `${PAYMENT_SELECT_SQL}
       WHERE rp.id = ?`
    )
    .get(paymentId)
}

function validateStatus(nextStatus) {
  return AVAILABLE_STATUSES.has(nextStatus)
}

function getDefaultCategoryId() {
  const category = db
    .prepare(
      `SELECT id
       FROM "CATEGORY"
       WHERE name = 'Прочее'
       LIMIT 1`
    )
    .get()

  return category ? category.id : null
}

function resolveCategoryId(categoryName) {
  if (!categoryName) {
    return getDefaultCategoryId()
  }

  const category = db
    .prepare(
      `SELECT id
       FROM "CATEGORY"
       WHERE name = ?
       LIMIT 1`
    )
    .get(categoryName)

  if (category) {
    return category.id
  }

  return getDefaultCategoryId()
}

function buildDashboard() {
  const user = db
    .prepare(
      `SELECT id, full_name, is_smartdebit_enabled
       FROM "USER"
       WHERE id = ?`
    )
    .get(DEFAULT_USER_ID)

  if (!user) {
    throw new Error('Пользователь не найден в БД')
  }

  const mainAccount = getMainAccount()
  if (!mainAccount) {
    throw new Error('Не найден основной счет пользователя')
  }

  const weekBorder = toIsoDate(addDays(new Date(), 7))

  const upcomingRows = db
    .prepare(
      `${PAYMENT_SELECT_SQL}
       WHERE date(rp.next_charge_date) <= date(?)
         AND rp.status <> 'cancelled'
       ORDER BY date(rp.next_charge_date) ASC, rp.amount DESC`
    )
    .all(weekBorder)

  const upcoming = upcomingRows.map(serializePaymentRow)

  const alerts = db
    .prepare(
      `SELECT
         dr.id,
         dr.amount,
         rp.id AS payment_id,
         COALESCE(rp.custom_name, sd.name) AS payment_title
       FROM "DEBT_RECORD" dr
       JOIN "RECURRING_PAYMENT" rp ON rp.id = dr.recurring_payment_id
       LEFT JOIN "SERVICE_DICTIONARY" sd ON sd.id = rp.service_id
       WHERE dr.status = 'unpaid'
       ORDER BY dr.created_at DESC`
    )
    .all()
    .map((row) => ({
      id: row.id,
      paymentId: row.payment_id,
      title: `Просрочен платеж: ${row.payment_title}`,
      amount: toMoney(row.amount),
    }))

  const chart = db
    .prepare(
      `SELECT
         COALESCE(c.name, 'Прочее') AS category,
         COALESCE(c.hex_color, '#9aa4b2') AS color,
         ROUND(SUM(rp.amount), 2) AS amount
       FROM "RECURRING_PAYMENT" rp
       LEFT JOIN "CATEGORY" c ON c.id = rp.category_id
       WHERE date(rp.next_charge_date) <= date(?)
         AND rp.status NOT IN ('disabled', 'frozen', 'cancelled')
       GROUP BY category, color
       ORDER BY amount DESC`
    )
    .all(weekBorder)
    .map((row) => ({
      category: row.category,
      amount: toMoney(row.amount),
      color: row.color,
    }))

  const notifications = db
    .prepare(
      `SELECT id, message, is_read, created_at
       FROM "NOTIFICATION"
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT 10`
    )
    .all(DEFAULT_USER_ID)
    .map((row) => ({
      id: row.id,
      title: row.message,
      subtitle: row.is_read
        ? `Прочитано · ${row.created_at.slice(0, 16)}`
        : `Новое · ${row.created_at.slice(0, 16)}`,
      level: debtMessagePattern.test(row.message) ? 'critical' : 'neutral',
    }))

  return {
    enabled: Boolean(user.is_smartdebit_enabled),
    account: getAccountSummary(mainAccount.id),
    alerts,
    upcoming,
    chart,
    notifications,
    generatedAt: new Date().toISOString(),
  }
}

app.get('/api/v1/smartdebit/dashboard', (_request, response) => {
  try {
    response.json(buildDashboard())
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : 'Ошибка при сборке дашборда',
    })
  }
})

app.post('/api/v1/smartdebit/toggle', (request, response) => {
  if (typeof request.body.enabled !== 'boolean') {
    response.status(400).json({
      message: 'Поле enabled должно быть boolean',
    })
    return
  }

  db.prepare(
    `UPDATE "USER"
     SET is_smartdebit_enabled = ?
     WHERE id = ?`
  ).run(request.body.enabled ? 1 : 0, DEFAULT_USER_ID)

  response.json({ enabled: request.body.enabled })
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

  const account = getMainAccount()
  if (!account) {
    response.status(500).json({ message: 'Не найден основной счет пользователя' })
    return
  }

  const paymentId = randomUUID()
  const categoryId = resolveCategoryId(category)

  db.prepare(
    `INSERT INTO "RECURRING_PAYMENT" (
       id,
       account_id,
       service_id,
       category_id,
       custom_name,
       amount,
       next_charge_date,
       periodicity,
       is_mandatory,
       status,
       frozen_until
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    paymentId,
    account.id,
    null,
    categoryId,
    title.trim(),
    amount,
    toIsoDate(dateValue),
    'month',
    mandatory ? 1 : 0,
    'expected',
    null
  )

  const paymentRow = getPaymentRowById(paymentId)
  response.status(201).json(serializePaymentRow(paymentRow))
})

app.patch('/api/v1/smartdebit/payments/:paymentId/status', (request, response) => {
  const payment = getPaymentRowById(request.params.paymentId)

  if (!payment) {
    response.status(404).json({ message: 'Платеж не найден' })
    return
  }

  const nextStatus = request.body.status
  if (!validateStatus(nextStatus)) {
    response.status(400).json({ message: 'Недопустимый статус' })
    return
  }

  const mandatoryPayment = isMandatoryPayment(payment)
  if (mandatoryPayment && ['disabled', 'frozen', 'cancelled'].includes(nextStatus)) {
    response.status(403).json({
      message: 'Обязательный платеж нельзя отключить или заморозить',
    })
    return
  }

  const frozenUntil = nextStatus === 'frozen' ? toIsoDate(addMonths(new Date(), 1)) : null

  db.prepare(
    `UPDATE "RECURRING_PAYMENT"
     SET status = ?,
         frozen_until = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(nextStatus, frozenUntil, payment.id)

  if (nextStatus === 'disabled') {
    db.prepare(
      `INSERT INTO "NOTIFICATION" (id, user_id, message, is_read, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      DEFAULT_USER_ID,
      `Автоплатеж отключен: ${payment.custom_name || payment.service_name}`,
      0,
      toIsoDateTime(new Date())
    )
  }

  const updatedPayment = getPaymentRowById(payment.id)
  response.json(serializePaymentRow(updatedPayment))
})

app.post('/api/v1/smartdebit/payments/:paymentId/pay-debt', (request, response) => {
  const payment = getPaymentRowById(request.params.paymentId)

  if (!payment) {
    response.status(404).json({ message: 'Платеж не найден' })
    return
  }

  const account = db
    .prepare(
      `SELECT id, balance
       FROM "ACCOUNT"
       WHERE id = ?`
    )
    .get(payment.account_id)

  if (!account) {
    response.status(404).json({ message: 'Счет платежа не найден' })
    return
  }

  const debtRecord = db
    .prepare(
      `SELECT id, amount, period_name
       FROM "DEBT_RECORD"
       WHERE recurring_payment_id = ?
         AND status = 'unpaid'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(payment.id)

  const debtAmount = toMoney(debtRecord ? debtRecord.amount : payment.amount)
  const periodName = debtRecord
    ? debtRecord.period_name
    : formatBillingPeriod(payment.next_charge_date)

  if (account.balance < debtAmount) {
    response.status(409).json({
      message: 'Недостаточно средств на счете',
    })
    return
  }

  const payDebt = db.transaction(() => {
    const resolvedDebtId = debtRecord ? debtRecord.id : randomUUID()

    if (!debtRecord) {
      db.prepare(
        `INSERT INTO "DEBT_RECORD" (
           id,
           recurring_payment_id,
           amount,
           period_name,
           status,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        resolvedDebtId,
        payment.id,
        debtAmount,
        periodName,
        'unpaid',
        toIsoDateTime(new Date())
      )
    }

    db.prepare(
      `UPDATE "ACCOUNT"
       SET balance = balance - ?
       WHERE id = ?`
    ).run(debtAmount, account.id)

    db.prepare(
      `UPDATE "DEBT_RECORD"
       SET status = 'paid'
       WHERE id = ?`
    ).run(resolvedDebtId)

    db.prepare(
      `UPDATE "RECURRING_PAYMENT"
       SET status = 'active',
           next_charge_date = ?,
           frozen_until = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(toIsoDate(addMonths(new Date(), 1)), payment.id)

    db.prepare(
      `INSERT INTO "TRANSACTION" (
         id,
         account_id,
         amount,
         date,
         merchant_name,
         type,
         status,
         recurring_payment_id,
         billing_period
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      account.id,
      -debtAmount,
      toIsoDateTime(new Date()),
      payment.custom_name || payment.service_name || 'SmartDebit платеж',
      'smartdebit',
      'success',
      payment.id,
      periodName
    )

    db.prepare(
      `INSERT INTO "NOTIFICATION" (id, user_id, message, is_read, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      DEFAULT_USER_ID,
      `Задолженность погашена: ${payment.custom_name || payment.service_name}`,
      0,
      toIsoDateTime(new Date())
    )
  })

  payDebt()

  const updatedPayment = getPaymentRowById(payment.id)

  response.json({
    message: 'Задолженность успешно погашена',
    payment: serializePaymentRow(updatedPayment),
    account: getAccountSummary(account.id),
  })
})

app.get('/api/v1/health', (_request, response) => {
  response.json({ status: 'ok', db: 'sqlite' })
})

app.get('/', (_request, response) => {
  response.json({
    service: 'SmartDebit mock API',
    status: 'running',
    storage: {
      engine: 'sqlite',
      path: DB_PATH,
    },
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
  console.log(`SQLite database initialized at: ${DB_PATH}`)
})
