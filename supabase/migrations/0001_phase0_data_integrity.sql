-- Phase 0 — Data Integrity Guards
-- Locks the business_profile ABN and clients.email to the correct values only.
-- Adds audit_log and ai_interactions tables (used by Ask Rod 2.0 and the
-- integrity dashboard).
-- Run order: 0001_phase0_data_integrity.sql

begin;

-- ---------------------------------------------------------------------------
-- 0.1  ABN guard
-- Correct ABN: 18 650 448 336 (Jordan Lansbury, sole trader).
-- The 18 650 448 386 value appeared in a legacy tax-memory export and must
-- never be persisted.  We normalise stored values to the digits-only form
-- '18650448336' to avoid whitespace drift.
-- ---------------------------------------------------------------------------

update business_profile
set abn = '18650448336'
where replace(abn, ' ', '') = '18650448336';

alter table business_profile
  drop constraint if exists business_profile_abn_check;

alter table business_profile
  add constraint business_profile_abn_check
  check (replace(abn, ' ', '') = '18650448336');

-- ---------------------------------------------------------------------------
-- 0.3  Client email guard
-- The legacy sales@seqautomotive.com.au address was retired in Apr 2026.
-- All inbound client correspondence now flows through seqautomotive@gmail.com.
-- ---------------------------------------------------------------------------

update clients
set email = 'seqautomotive@gmail.com'
where lower(email) = 'sales@seqautomotive.com.au';

alter table clients
  drop constraint if exists clients_email_not_legacy;

alter table clients
  add constraint clients_email_not_legacy
  check (email is null or lower(email) <> 'sales@seqautomotive.com.au');

-- ---------------------------------------------------------------------------
-- Audit log — every write operation on sensitive tables.
-- Read by the /admin/integrity dashboard and by Ask Rod for provenance.
-- ---------------------------------------------------------------------------

create table if not exists audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor text,
  table_name text not null,
  row_id text,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb
);

create index if not exists audit_log_table_row_idx
  on audit_log (table_name, row_id, occurred_at desc);

create index if not exists audit_log_occurred_at_idx
  on audit_log (occurred_at desc);

-- ---------------------------------------------------------------------------
-- Ask Rod interaction log — prerequisite for Phase 3.4 guardrails.
-- Every Ask Rod call records prompt, tool uses, and cited sources.
-- ---------------------------------------------------------------------------

create table if not exists ai_interactions (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  model text not null,
  page_context text,
  prompt text not null,
  response text,
  tool_uses jsonb,
  cited_sources jsonb,
  confidence numeric,
  latency_ms integer,
  tokens_in integer,
  tokens_out integer
);

create index if not exists ai_interactions_occurred_at_idx
  on ai_interactions (occurred_at desc);

-- ---------------------------------------------------------------------------
-- BAS variance — Phase 0.2 ground-truth for later amendments.
-- Populated whenever a reconciliation run detects drift between the lodged
-- figures and the sum of underlying transactions.
-- ---------------------------------------------------------------------------

create table if not exists bas_variance (
  id bigserial primary key,
  bas_period_id uuid not null references bas_periods(id) on delete cascade,
  detected_at timestamptz not null default now(),
  field text not null,
  lodged_value numeric not null,
  reconciled_value numeric not null,
  variance numeric generated always as (reconciled_value - lodged_value) stored,
  note text,
  resolved_at timestamptz,
  resolution_note text
);

create unique index if not exists bas_variance_period_field_open_idx
  on bas_variance (bas_period_id, field)
  where resolved_at is null;

commit;
