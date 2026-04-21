-- 20260421 — Household settings: monthly costs + member incomes
--
-- The Household page hardcoded six monthly cost values inside the React
-- component (mortgage, groceries, etc) and the household_members table
-- had annual_income NULL for all three rows. This migration:
--   1. Adds business_profile.monthly_costs (JSONB) so the household
--      page can read its cost breakdown from the DB and so Settings
--      can edit it later without a code change.
--   2. Seeds the values currently hardcoded in the page so behaviour
--      is unchanged on first run.
--   3. Backfills annual_income on household_members from the certified
--      FY2024-25 figures (Jordan $63,833 sole-trader, Bethany $172,808
--      PAYG, Rory dependent).

BEGIN;

ALTER TABLE business_profile
  ADD COLUMN IF NOT EXISTS monthly_costs JSONB
    DEFAULT '{
      "mortgage": 2800,
      "groceries": 1200,
      "utilities": 350,
      "insurance": 200,
      "subscriptions": 150,
      "kids": 400
    }'::jsonb;

UPDATE business_profile
SET monthly_costs = '{
  "mortgage": 2800,
  "groceries": 1200,
  "utilities": 350,
  "insurance": 200,
  "subscriptions": 150,
  "kids": 400
}'::jsonb
WHERE monthly_costs IS NULL;

-- Backfill member incomes. Match by name (case-insensitive on first
-- name) since the existing rows were created by the seed script and
-- there's no stable external id.
UPDATE household_members
SET annual_income = 63833.00
WHERE LOWER(name) LIKE 'jordan%'
  AND annual_income IS NULL;

UPDATE household_members
SET annual_income = 172808.00
WHERE LOWER(name) LIKE 'bethany%'
  AND annual_income IS NULL;

-- Rory is a dependent — leave annual_income as NULL but make it explicit
-- via notes/metadata if the column exists.

COMMIT;
