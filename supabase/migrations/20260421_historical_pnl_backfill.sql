-- 20260421 — FY2024-25 historical P&L backfill
--
-- The certified FY24-25 P&L (Kennedy McLaughlin, lodged 9 Apr 2026) shows
-- $54,691 of business expenses and $59,054 net business income. The current
-- historical_periods + historical_expense_categories rows are short by:
--   - Motor vehicle (c/km): $4,400  (5,000 km x $0.88 — Jordan's car)
--   - Accounting (Kennedy McLaughlin): $600
-- Total gap: $5,000.
--
-- This migration:
--   1. Adds account 6-1099 'Motor Vehicle (c/km)' so the historical row
--      has a valid account_code to point at. (Accounting Fees account
--      6-5010 already exists.)
--   2. Inserts the two missing historical_expense_categories rows.
--   3. Updates historical_periods FY2024-25 annual row to match the
--      certified totals. Also updates the 12 monthly rows to add
--      $5,000/12 = $416.67 each (uniform spread to keep monthly rollup
--      consistent with the certified annual; existing monthly numbers
--      were already a uniform spread).

BEGIN;

-- 1. Account row for Motor Vehicle (c/km). Idempotent on code.
INSERT INTO accounts (code, name, type, tax_code, business_use_pct, is_active, sort_order)
VALUES ('6-1099', 'Motor Vehicle (c/km)', 'expense', 'N/A', 100, true, 109)
ON CONFLICT (code) DO NOTHING;

-- 2. Missing FY2024-25 expense categories. Use NOT EXISTS to stay idempotent.
INSERT INTO historical_expense_categories (financial_year, category, amount, account_code)
SELECT 'FY2024-25', 'Motor vehicle (c/km)', 4400.00, '6-1099'
WHERE NOT EXISTS (
  SELECT 1 FROM historical_expense_categories
  WHERE financial_year = 'FY2024-25' AND category = 'Motor vehicle (c/km)'
);

INSERT INTO historical_expense_categories (financial_year, category, amount, account_code)
SELECT 'FY2024-25', 'Accounting', 600.00, '6-5010'
WHERE NOT EXISTS (
  SELECT 1 FROM historical_expense_categories
  WHERE financial_year = 'FY2024-25' AND category = 'Accounting'
);

-- 3. Restate the FY2024-25 annual row to match the certified totals.
UPDATE historical_periods
SET expenses   = 54690.80,
    net_profit = 59054.65
WHERE financial_year = 'FY2024-25'
  AND period_type = 'annual';

-- 4. Spread the $5,000 gap uniformly across the 12 monthly rows so the
--    monthly chart still rolls up to the annual figure. $5,000 / 12 =
--    $416.67 (last row absorbs the rounding residual).
UPDATE historical_periods
SET expenses   = expenses + 416.67,
    net_profit = net_profit - 416.67
WHERE financial_year = 'FY2024-25'
  AND period_type = 'monthly'
  AND start_date <> '2025-06-01';

UPDATE historical_periods
SET expenses   = expenses + 416.63,
    net_profit = net_profit - 416.63
WHERE financial_year = 'FY2024-25'
  AND period_type = 'monthly'
  AND start_date = '2025-06-01';

COMMIT;
