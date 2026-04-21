-- ============================================================================
-- 20260421_rls_lockdown.sql
-- ============================================================================
-- Closes the wide-open RLS state. Before this migration, every public.*
-- table allowed at least SELECT to {public} (which includes the unauth'd
-- `anon` role used by the browser anon key), and several tables
-- (invoices, invoice_lines, transactions, documents, household_members)
-- allowed full ALL access to anon. Storage buckets had the same hole.
--
-- This is a single-user app. With Supabase Auth + cookie sessions wired up
-- (see src/proxy.ts, src/lib/supabase.ts), Jordan's browser holds the
-- `authenticated` role; the unauth'd `anon` role should see nothing.
--
-- Policy after this migration:
--   - public.* tables: SELECT/INSERT/UPDATE/DELETE allowed to `authenticated`
--   - public.* tables: ALL allowed to `service_role` (used by API routes)
--   - storage.objects (receipts): public SELECT (unguessable URLs in <img>),
--     INSERT/UPDATE/DELETE only to `authenticated`
--   - storage.objects (documents): SELECT/INSERT/UPDATE/DELETE only to
--     `authenticated`
--
-- Apply manually:
--   psql "$DATABASE_URL" -f supabase/migrations/20260421_rls_lockdown.sql
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- public schema: drop existing wide-open policies and replace
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY[
    'accounts', 'anomalies', 'assets', 'bank_rules', 'bas_periods',
    'business_profile', 'claims', 'clients', 'compliance_events',
    'deduction_rules', 'documents', 'historical_expense_categories',
    'historical_periods', 'household_members', 'invoice_lines',
    'invoices', 'transactions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop every existing policy on the table (idempotent).
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- Make sure RLS is on (already is, but defensive).
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- authenticated: full access (single user).
    EXECUTE format($p$
      CREATE POLICY auth_select ON public.%I
        FOR SELECT TO authenticated USING (true)
    $p$, t);
    EXECUTE format($p$
      CREATE POLICY auth_insert ON public.%I
        FOR INSERT TO authenticated WITH CHECK (true)
    $p$, t);
    EXECUTE format($p$
      CREATE POLICY auth_update ON public.%I
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true)
    $p$, t);
    EXECUTE format($p$
      CREATE POLICY auth_delete ON public.%I
        FOR DELETE TO authenticated USING (true)
    $p$, t);

    -- service_role: full access (for createServiceClient in API routes).
    EXECUTE format($p$
      CREATE POLICY svc_all ON public.%I
        FOR ALL TO service_role USING (true) WITH CHECK (true)
    $p$, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- storage.objects: drop wide-open receipt/document policies and replace
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS receipts_public_read ON storage.objects;
DROP POLICY IF EXISTS receipts_upload      ON storage.objects;
DROP POLICY IF EXISTS receipts_update      ON storage.objects;
DROP POLICY IF EXISTS receipts_delete      ON storage.objects;
DROP POLICY IF EXISTS documents_read       ON storage.objects;
DROP POLICY IF EXISTS documents_upload     ON storage.objects;
DROP POLICY IF EXISTS documents_update     ON storage.objects;
DROP POLICY IF EXISTS documents_delete     ON storage.objects;

-- receipts bucket is public=true so direct URLs render in <img>.
-- Keep public SELECT (URLs are unguessable UUIDs); writes require auth.
CREATE POLICY receipts_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'receipts');

CREATE POLICY receipts_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY receipts_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts')
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY receipts_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts');

-- documents bucket is private — auth required for everything.
CREATE POLICY documents_auth_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY documents_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY documents_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY documents_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents');

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification (read-only, run after committing):
--
--   SELECT tablename, policyname, roles, cmd
--   FROM pg_policies WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
--
-- Expected: every public.* table has 5 policies (auth_select, auth_insert,
-- auth_update, auth_delete, svc_all), no policies pointing to {public}.
-- ---------------------------------------------------------------------------
