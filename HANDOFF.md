# HANDOFF — `fixes/state-of-rod` branch

Branch contains 10 commits implementing every item from the State of Rod
audit. Most fixes are pure code (already tested). Two pieces require
manual work from you before merging to `main`: **(1) create your auth
user**, and **(2) apply three SQL migrations**. Skip neither — the auth
gate and the RLS lockdown only take effect once both are done.

---

## Commits in this branch

| Hash      | Topic |
|-----------|-------|
| `17d3d17` | C1  — Invoice counter (uses MAX+1, no more collisions) |
| `e8879cf` | C2/C5 — Rod Says + Categorise schema/model fixes |
| `46734b7` | C3  — Time Machine sourced from DB |
| `dc7ed42` | C3  — Time Machine financial_year key fix |
| `4c50230` | C4  — Dashboard drops fake expenses estimate |
| `bb73eb6` | C6  — Dead receipt state + 8 legacy folders removed |
| `a527839` | C7  — Historical P&L backfill **(SQL — apply manually)** |
| `09a17ca` | C8  — Household monthly costs + member income backfill **(SQL — apply manually)** |
| `f0478b4` | C9  — Supabase Auth + `proxy.ts` session guard |
| `aa76a8e` | C10 — RLS lockdown **(SQL — apply manually)** + atomic invoice delete |

---

## Step 1 — Create your auth user

The login page at `/login` calls `supabase.auth.signInWithPassword()`.
There's no sign-up screen — you create yourself in Supabase.

1. Open Supabase dashboard → project `vmjjngqcrvubgetaapru` → **Authentication** → **Users**.
2. **Add user** → **Create new user**.
3. Email: `lansbury2002@gmail.com`. Password: anything strong; you'll
   use it on the `/login` page.
4. Confirm immediately (no email verification needed for a single-user app).

**If you skip this step:** the proxy bounces you to `/login` and you can't
sign in.

---

## Step 2 — Apply the three SQL migrations

All three live in `supabase/migrations/`. Apply in this order — the RLS
one last (so the data backfills run as service_role, before the policy
change starts gating writes).

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260421_historical_pnl_backfill.sql
psql "$DATABASE_URL" -f supabase/migrations/20260421_household_settings.sql
psql "$DATABASE_URL" -f supabase/migrations/20260421_rls_lockdown.sql
```

Or paste each into the Supabase SQL editor.

### What each one does

**`20260421_historical_pnl_backfill.sql`** — adds the missing
$4,400 motor vehicle (c/km) and $600 accounting line items to the
FY2024-25 P&L. Brings annual `expenses` to $54,690.80 and `net_profit`
to $59,054.65 (matches the certified return). Spreads the $5,000
across 12 monthly rows so the dashboard doesn't show a sudden June
spike.

**`20260421_household_settings.sql`** — adds
`business_profile.monthly_costs` JSONB (defaults from your existing
hardcoded numbers) and backfills Jordan ($63,833) and Bethany
($172,808) annual incomes on `household_members` via name LIKE match.
After this runs, the Household page reads from the DB instead of
hardcoded constants.

**`20260421_rls_lockdown.sql`** — drops every wide-open `to public`
policy and replaces with `authenticated`-only policies (plus
`service_role` for API routes). Storage objects locked the same way:
`receipts` keeps public SELECT for `<img src>`, all writes require auth;
`documents` is auth-only end-to-end.

### Verify the lockdown took

After applying, run this in the SQL editor:

```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Every public table should show 5 policies (`auth_select`, `auth_insert`,
`auth_update`, `auth_delete`, `svc_all`) and **no policy with
`{public}` in the roles column**. If you see a `{public}` row,
something didn't drop — re-run the migration (it's idempotent).

---

## Step 3 — Smoke test before merging

After steps 1 and 2:

1. `npm run dev` → open `http://localhost:3000`.
2. You should bounce to `/login`. Sign in with the user from step 1.
3. Land on `/dashboard`. Header should show GST + FY chip; everything
   loads.
4. Open `/invoices` → create a draft invoice. Confirm the number is
   `INV-000472` (the next slot above the last one in the DB).
5. Open `/time-machine` → FY2024-25 row should show $59,054 net
   business income (matches the certified return now).
6. Open `/household` → monthly costs and member incomes should match
   what you'd expect (no longer hardcoded).
7. Click the avatar (top-right) → **Sign out**. You should bounce to
   `/login`.
8. **Optional sanity check:** in a private window, try to fetch
   `https://vmjjngqcrvubgetaapru.supabase.co/rest/v1/invoices?select=id`
   with the anon key as `apikey` header. Should return `[]` (RLS
   blocking) — before the lockdown this would have returned all 469.

---

## Step 4 — Rotate keys (recommended)

Before this branch, the anon key gave full read on every table and full
write on invoices/transactions/documents/household_members. Anyone who
saw the key (committed to a deployed bundle) had effective superuser
on your data.

**Rotate the anon key in Supabase dashboard → Project Settings → API
Keys.** Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in:
- `.env.local`
- Vercel project env vars (Production + Preview)

Also rotate `SUPABASE_SERVICE_ROLE_KEY` if it ever sat in a client
bundle (it shouldn't have, but worth a fresh one).

---

## Step 5 — Merge

Once steps 1–4 are clean:

```bash
git checkout main
git merge --no-ff fixes/state-of-rod
git push origin main
```

Vercel auto-deploys. Confirm the prod deploy passes Smoke Test #2 (sign
in with your new user) before closing this off.

---

## What's NOT in this branch

The audit had 20 items; the 10 commits above cover the must-fixes (C1–C10).
Anything labelled "polish" or "later" in the audit has been left for a
follow-up branch — they're not security or correctness bugs.

A few specific things deferred:

- **Server actions for write paths**: the audit suggested moving 11
  client-side `supabase.from(...).insert/update/delete` calls behind
  server actions for audit logging. RLS lockdown closes the security
  gap; the server-action refactor is a quality move, not a security one,
  and didn't fit the C1–C10 budget. Worth doing later when you want
  audit trails on Mark Paid / Void / Delete.
- **PWA offline behaviour**: not touched. Service worker still ships
  the old anon-key bundle until you redeploy after step 4.
