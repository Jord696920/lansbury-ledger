-- Migration: CSV import tracking + categorisation source column
-- Date: 2026-04-19
-- Status: FILE ONLY — NOT APPLIED. Review before running against Supabase.
--
-- Motivation (Phase 4 — rod-overnight-run.md):
-- 1. Track which rows came from which file-import batch (auditability).
-- 2. Record *how* a transaction was categorised (rule / manual / ai)
--    so we can report on rule accuracy and re-run categorisation safely.

-- --------------------------------------------------------------------
-- 1. transaction_imports — one row per uploaded CSV
-- --------------------------------------------------------------------
create table if not exists public.transaction_imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  bank text not null,
  row_count integer not null default 0,
  new_count integer not null default 0,
  duplicate_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'committed', 'reverted', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists idx_transaction_imports_created_at
  on public.transaction_imports (created_at desc);

-- --------------------------------------------------------------------
-- 2. transactions — link to import + record categorisation source
-- --------------------------------------------------------------------
alter table public.transactions
  add column if not exists import_id uuid references public.transaction_imports(id) on delete set null;

alter table public.transactions
  add column if not exists categorisation_source text
  check (categorisation_source in ('rule', 'manual', 'ai'));

create index if not exists idx_transactions_import_id
  on public.transactions (import_id) where import_id is not null;

create index if not exists idx_transactions_categorisation_source
  on public.transactions (categorisation_source) where categorisation_source is not null;

-- --------------------------------------------------------------------
-- 3. Backfill (optional — run manually if desired)
-- --------------------------------------------------------------------
-- Existing `import_batch_id` (text) rows predate this migration and will
-- not have a transaction_imports row. Leave them NULL; the app can still
-- read import_batch_id for legacy reference.
