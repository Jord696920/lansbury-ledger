-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_financial_hub.sql
-- Financial Hub: Budgets, Recurring Expenses, Email Receipts
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Budgets ──────────────────────────────────────────────────────────────────
-- Monthly/quarterly/annual spend targets per account category.
-- Actuals are derived at query time from the transactions table.
CREATE TABLE IF NOT EXISTS budgets (
  id           uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id   uuid          REFERENCES accounts(id) ON DELETE SET NULL,
  category_name text         NOT NULL,
  period_type  text          NOT NULL DEFAULT 'monthly'
                             CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  period_start date          NOT NULL,
  period_end   date          NOT NULL,
  amount       numeric(12,2) NOT NULL CHECK (amount >= 0),
  notes        text,
  created_at   timestamptz   DEFAULT now(),
  updated_at   timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budgets_period  ON budgets(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_budgets_account ON budgets(account_id) WHERE account_id IS NOT NULL;

-- ── Recurring Expenses ────────────────────────────────────────────────────────
-- Subscriptions and regular bills with next-due tracking.
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id               uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text          NOT NULL,
  description      text,
  vendor_name      text,
  amount           numeric(12,2) NOT NULL CHECK (amount >= 0),
  gst_included     boolean       NOT NULL DEFAULT true,
  account_id       uuid          REFERENCES accounts(id) ON DELETE SET NULL,
  frequency        text          NOT NULL DEFAULT 'monthly'
                                 CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annual')),
  next_due_date    date          NOT NULL,
  last_paid_date   date,
  business_use_pct numeric(5,2)  NOT NULL DEFAULT 100
                                 CHECK (business_use_pct BETWEEN 0 AND 100),
  is_active        boolean       NOT NULL DEFAULT true,
  payment_method   text
                   CHECK (payment_method IN ('direct_debit', 'credit_card', 'bank_transfer', 'manual')),
  notes            text,
  created_at       timestamptz   DEFAULT now(),
  updated_at       timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_due
  ON recurring_expenses(next_due_date)
  WHERE is_active = true;

-- ── Email Receipts ────────────────────────────────────────────────────────────
-- Pasted or forwarded expense emails parsed by Claude.
-- Stores raw body + AI-extracted fields + match status.
CREATE TABLE IF NOT EXISTS email_receipts (
  id                 uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  email_subject      text,
  email_from         text,
  email_date         timestamptz,
  raw_body           text          NOT NULL,
  parsed_vendor      text,
  parsed_amount      numeric(12,2),
  parsed_gst         numeric(12,2),
  parsed_date        date,
  parsed_description text,
  parsed_category    text,
  transaction_id     uuid          REFERENCES transactions(id) ON DELETE SET NULL,
  account_id         uuid          REFERENCES accounts(id)    ON DELETE SET NULL,
  business_use_pct   numeric(5,2)  DEFAULT 100,
  status             text          NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'matched', 'ignored', 'created')),
  ai_confidence      numeric(5,2),
  ai_raw_response    text,
  created_at         timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_receipts_status ON email_receipts(status);
CREATE INDEX IF NOT EXISTS idx_email_receipts_date   ON email_receipts(parsed_date DESC);
