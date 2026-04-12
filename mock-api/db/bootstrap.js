const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const { randomUUID } = require('crypto')

const DB_DIRECTORY = path.join(__dirname, '..', '..', 'backend', 'data')
const DB_PATH = path.join(DB_DIRECTORY, 'smartdebit.sqlite')
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'backend', 'db', 'schema.sql')

const DEFAULT_USER_ID = 'user-main'
const DEFAULT_DEBIT_ACCOUNT_ID = 'account-black'

const CATEGORY_IDS = {
  ENTERTAINMENT: 1,
  HOUSING: 2,
  FINANCE: 3,
  TELECOM: 4,
  OTHER: 5,
}

const SERVICE_IDS = {
  MORTGAGE_SBER: 1,
  TINKOFF_PRO: 2,
  YANDEX_PLUS: 3,
  MTS_CONNECTION: 4,
  KION: 5,
  ALPHA_LOAN: 6,
  START: 7,
}

const PAYMENT_IDS = {
  MORTGAGE_SBER: 'mortgage-sber',
  TINKOFF_PRO: 'tinkoff-pro',
  YANDEX_PLUS: 'yandex-plus',
  MTS: 'mts',
  KION: 'kion',
  ALPHA_LOAN: 'alpha-loan',
  START: 'start-subscription',
}

function addDays(date, days) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

function addMonths(date, months) {
  const value = new Date(date)
  value.setMonth(value.getMonth() + months)
  return value
}

function toIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toIsoDateTime(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function ensureDatabaseDirectory() {
  if (!fs.existsSync(DB_DIRECTORY)) {
    fs.mkdirSync(DB_DIRECTORY, { recursive: true })
  }
}

function seedDatabase(db) {
  const usersCount = db.prepare('SELECT COUNT(1) AS count FROM "USER"').get().count
  if (usersCount > 0) {
    return
  }

  const now = new Date()

  db.prepare(
    `INSERT INTO "USER" (id, full_name, is_smartdebit_enabled)
     VALUES (?, ?, ?)`
  ).run(DEFAULT_USER_ID, 'Иван Иванов', 0)

  const insertAccount = db.prepare(
    `INSERT INTO "ACCOUNT" (id, user_id, name, type, balance, currency)
     VALUES (?, ?, ?, ?, ?, ?)`
  )

  insertAccount.run(DEFAULT_DEBIT_ACCOUNT_ID, DEFAULT_USER_ID, 'Black', 'Debit', 116783, 'RUB')
  insertAccount.run('account-savings', DEFAULT_USER_ID, 'Накопительный счет', 'Savings', 9009.42, 'RUB')
  insertAccount.run('account-deposit', DEFAULT_USER_ID, 'Вклад «Стабильный»', 'Deposit', 350000, 'RUB')

  const insertCategory = db.prepare(
    `INSERT INTO "CATEGORY" (id, name, hex_color)
     VALUES (?, ?, ?)`
  )

  insertCategory.run(CATEGORY_IDS.ENTERTAINMENT, 'Развлечения', '#2f7df6')
  insertCategory.run(CATEGORY_IDS.HOUSING, 'ЖКХ', '#03b37d')
  insertCategory.run(CATEGORY_IDS.FINANCE, 'Финансы', '#101828')
  insertCategory.run(CATEGORY_IDS.TELECOM, 'Связь', '#f4b400')
  insertCategory.run(CATEGORY_IDS.OTHER, 'Прочее', '#9aa4b2')

  const insertService = db.prepare(
    `INSERT INTO "SERVICE_DICTIONARY" (
       id,
       name,
       provider_name,
       mcc_code,
       logo_url,
       default_is_mandatory
     ) VALUES (?, ?, ?, ?, ?, ?)`
  )

  insertService.run(SERVICE_IDS.MORTGAGE_SBER, 'Ипотека (Сбербанк)', 'Сбербанк', 'BANK_MORTGAGE', '', 1)
  insertService.run(SERVICE_IDS.TINKOFF_PRO, 'Tinkoff Pro', 'Т-Банк', 'SUBSCRIPTION', '', 0)
  insertService.run(SERVICE_IDS.YANDEX_PLUS, 'Яндекс Плюс', 'Яндекс', 'SUBSCRIPTION', '', 0)
  insertService.run(SERVICE_IDS.MTS_CONNECTION, 'МТС Связь', 'МТС', 'TELECOM', '', 1)
  insertService.run(SERVICE_IDS.KION, 'KION', 'МТС', 'SUBSCRIPTION', '', 0)
  insertService.run(SERVICE_IDS.ALPHA_LOAN, 'Кредит (Альфа)', 'Альфа-Банк', 'BANK_LOAN', '', 1)
  insertService.run(SERVICE_IDS.START, 'START Подписка', 'START', 'SUBSCRIPTION', '', 0)

  const insertRecurringPayment = db.prepare(
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
  )

  insertRecurringPayment.run(
    PAYMENT_IDS.MORTGAGE_SBER,
    DEFAULT_DEBIT_ACCOUNT_ID,
    SERVICE_IDS.MORTGAGE_SBER,
    CATEGORY_IDS.FINANCE,
    null,
    45000,
    toIsoDate(addDays(now, -2)),
    'month',
    1,
    'overdue',
    null
  )

  insertRecurringPayment.run(
    PAYMENT_IDS.TINKOFF_PRO,
    DEFAULT_DEBIT_ACCOUNT_ID,
    SERVICE_IDS.TINKOFF_PRO,
    CATEGORY_IDS.ENTERTAINMENT,
    null,
    199,
    toIsoDate(addDays(now, 1)),
    'month',
    0,
    'active',
    null
  )

  insertRecurringPayment.run(
    PAYMENT_IDS.YANDEX_PLUS,
    DEFAULT_DEBIT_ACCOUNT_ID,
    SERVICE_IDS.YANDEX_PLUS,
    CATEGORY_IDS.ENTERTAINMENT,
    null,
    299,
    toIsoDate(addDays(now, 2)),
    'month',
    0,
    'low_balance',
    null
  )

  insertRecurringPayment.run(
    PAYMENT_IDS.MTS,
    DEFAULT_DEBIT_ACCOUNT_ID,
    SERVICE_IDS.MTS_CONNECTION,
    CATEGORY_IDS.TELECOM,
    null,
    3090,
    toIsoDate(addDays(now, 3)),
    'month',
    1,
    'expected',
    null
  )

  insertRecurringPayment.run(
    PAYMENT_IDS.KION,
    DEFAULT_DEBIT_ACCOUNT_ID,
    SERVICE_IDS.KION,
    CATEGORY_IDS.ENTERTAINMENT,
    null,
    249,
    toIsoDate(addDays(now, 4)),
    'month',
    0,
    'disabled',
    null
  )

  insertRecurringPayment.run(
    PAYMENT_IDS.ALPHA_LOAN,
    DEFAULT_DEBIT_ACCOUNT_ID,
    SERVICE_IDS.ALPHA_LOAN,
    CATEGORY_IDS.FINANCE,
    null,
    12500,
    toIsoDate(addDays(now, 6)),
    'month',
    1,
    'predicted',
    null
  )

  insertRecurringPayment.run(
    PAYMENT_IDS.START,
    DEFAULT_DEBIT_ACCOUNT_ID,
    SERVICE_IDS.START,
    CATEGORY_IDS.ENTERTAINMENT,
    null,
    399,
    toIsoDate(addDays(now, 5)),
    'month',
    0,
    'expected',
    null
  )

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
    'debt-mortgage-feb',
    PAYMENT_IDS.MORTGAGE_SBER,
    45000,
    'Февраль 2026',
    'unpaid',
    toIsoDateTime(addDays(now, -1))
  )

  const insertTransaction = db.prepare(
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
  )

  insertTransaction.run(
    randomUUID(),
    DEFAULT_DEBIT_ACCOUNT_ID,
    95000,
    toIsoDateTime(addDays(now, -1)),
    'Зарплата',
    'income',
    'success',
    null,
    null
  )

  insertTransaction.run(
    randomUUID(),
    DEFAULT_DEBIT_ACCOUNT_ID,
    -45000,
    toIsoDateTime(addDays(now, -2)),
    'Ипотека (Сбербанк)',
    'smartdebit',
    'failed',
    PAYMENT_IDS.MORTGAGE_SBER,
    'Февраль 2026'
  )

  insertTransaction.run(
    randomUUID(),
    DEFAULT_DEBIT_ACCOUNT_ID,
    -1250,
    toIsoDateTime(addDays(now, -3)),
    'Самокат',
    'purchase',
    'success',
    null,
    null
  )

  insertTransaction.run(
    randomUUID(),
    DEFAULT_DEBIT_ACCOUNT_ID,
    -299,
    toIsoDateTime(addDays(now, -3)),
    'Яндекс Плюс',
    'smartdebit',
    'success',
    PAYMENT_IDS.YANDEX_PLUS,
    'Март 2026'
  )

  insertTransaction.run(
    randomUUID(),
    DEFAULT_DEBIT_ACCOUNT_ID,
    -890,
    toIsoDateTime(addDays(now, -4)),
    'Яндекс Еда',
    'purchase',
    'success',
    null,
    null
  )

  insertTransaction.run(
    randomUUID(),
    DEFAULT_DEBIT_ACCOUNT_ID,
    -399,
    toIsoDateTime(addDays(now, -4)),
    'START Подписка',
    'smartdebit',
    'success',
    PAYMENT_IDS.START,
    'Март 2026'
  )

  insertTransaction.run(
    randomUUID(),
    DEFAULT_DEBIT_ACCOUNT_ID,
    -2340,
    toIsoDateTime(addDays(now, -5)),
    'Магнит',
    'purchase',
    'success',
    null,
    null
  )

  const insertNotification = db.prepare(
    `INSERT INTO "NOTIFICATION" (id, user_id, message, is_read, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )

  insertNotification.run(
    randomUUID(),
    DEFAULT_USER_ID,
    'Завтра списание 199 ₽ за Tinkoff Pro',
    0,
    toIsoDateTime(addDays(now, -1))
  )

  insertNotification.run(
    randomUUID(),
    DEFAULT_USER_ID,
    'Неоплаченный платеж: Ипотека (Сбербанк)',
    0,
    toIsoDateTime(now)
  )
}

function createDatabase() {
  ensureDatabaseDirectory()

  const db = new Database(DB_PATH)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
  db.exec(schema)

  seedDatabase(db)

  return db
}

module.exports = {
  DB_PATH,
  DEFAULT_USER_ID,
  DEFAULT_DEBIT_ACCOUNT_ID,
  addDays,
  addMonths,
  createDatabase,
  toIsoDate,
  toIsoDateTime,
}
