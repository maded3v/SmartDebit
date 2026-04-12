PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "USER" (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  is_smartdebit_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_smartdebit_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ACCOUNT" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Debit', 'Savings', 'Deposit')),
  balance REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RUB',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES "USER" (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "CATEGORY" (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  hex_color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "SERVICE_DICTIONARY" (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  provider_name TEXT,
  mcc_code TEXT,
  logo_url TEXT,
  default_is_mandatory INTEGER NOT NULL DEFAULT 0 CHECK (default_is_mandatory IN (0, 1))
);

CREATE TABLE IF NOT EXISTS "RECURRING_PAYMENT" (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  service_id INTEGER,
  category_id INTEGER,
  custom_name TEXT,
  amount REAL NOT NULL CHECK (amount > 0),
  next_charge_date TEXT NOT NULL,
  periodicity TEXT NOT NULL DEFAULT 'month' CHECK (periodicity IN ('week', 'month', 'year')),
  is_mandatory INTEGER NOT NULL DEFAULT 0 CHECK (is_mandatory IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'expected' CHECK (
    status IN (
      'active',
      'expected',
      'predicted',
      'low_balance',
      'overdue',
      'cancelled',
      'disabled',
      'frozen'
    )
  ),
  frozen_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES "ACCOUNT" (id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES "SERVICE_DICTIONARY" (id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES "CATEGORY" (id) ON DELETE SET NULL,
  CHECK (service_id IS NOT NULL OR custom_name IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS "TRANSACTION" (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  merchant_name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  recurring_payment_id TEXT,
  billing_period TEXT,
  FOREIGN KEY (account_id) REFERENCES "ACCOUNT" (id) ON DELETE CASCADE,
  FOREIGN KEY (recurring_payment_id) REFERENCES "RECURRING_PAYMENT" (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "DEBT_RECORD" (
  id TEXT PRIMARY KEY,
  recurring_payment_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  period_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unpaid', 'paid')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recurring_payment_id) REFERENCES "RECURRING_PAYMENT" (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "NOTIFICATION" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES "USER" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_user_id
  ON "ACCOUNT" (user_id);

CREATE INDEX IF NOT EXISTS idx_recurring_payment_account
  ON "RECURRING_PAYMENT" (account_id);

CREATE INDEX IF NOT EXISTS idx_recurring_payment_status_date
  ON "RECURRING_PAYMENT" (status, next_charge_date);

CREATE INDEX IF NOT EXISTS idx_transaction_account_date
  ON "TRANSACTION" (account_id, date);

CREATE INDEX IF NOT EXISTS idx_debt_record_status
  ON "DEBT_RECORD" (status);

CREATE INDEX IF NOT EXISTS idx_notification_user_created
  ON "NOTIFICATION" (user_id, created_at);
