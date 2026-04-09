# Security Audit — Lansbury Ledger

**Date:** 9 April 2026
**Auditor:** Claude Code (automated)
**Scope:** Full project — secrets, env vars, API routes, client-side exposure, dependencies, RLS

---

## Summary

| Severity | Count |
|----------|:-----:|
| CRITICAL | 0 |
| HIGH | 4 |
| MEDIUM | 3 |
| LOW | 2 |

---

## Findings

### HIGH-1: No authentication on API routes

**Files:** `src/app/api/ai/rod-says/route.ts`, `src/app/api/ai/categorise/route.ts`, `src/app/api/ai/deduction-check/route.ts`, `src/app/api/send-invoice/route.ts`

All 4 API routes have **zero authentication**. Anyone who discovers the URLs can:
- Burn Anthropic API credits (rod-says, categorise, deduction-check)
- Send arbitrary emails via `/api/send-invoice` (accepts any `to` address)
- Modify transaction records via `/api/ai/categorise` (writes to DB with service role key)

**Status:** NOT FIXED — requires architectural decision (session auth, API key, or rate limiting).

**Recommendation:** Add authentication middleware. At minimum, add a shared secret header check. Ideally integrate Supabase Auth and validate the session JWT on every API route.

---

### HIGH-2: All source code is uncommitted

Only the initial Create Next App scaffold is committed (19 files). The entire application — all components, API routes, lib files, types, hooks — is **untracked**. One disk failure = total loss of the application.

**Status:** NOT FIXED — Jordan needs to commit the codebase.

**Recommendation:** Immediately commit all source code. Exclude `data/`, `scripts/` (contain migration data), and ensure `.env*` stays gitignored.

---

### HIGH-3: RLS status unknown — no schema tracked

The `supabase/` directory is empty. No migration files, no schema definitions. Cannot verify whether Row Level Security is enabled on any table.

**Status:** NOT FIXED — requires manual check in Supabase Dashboard.

**Recommendation:**
1. Go to Supabase Dashboard > Table Editor > each table > RLS tab
2. Verify RLS is **enabled** on: `invoices`, `invoice_lines`, `transactions`, `accounts`, `bas_periods`, `business_profile`, `clients`, `deduction_rules`, `anomalies`
3. If this is a single-user app with no auth, RLS may not be critical — but the anon key is public, so any browser with the key can read/write without RLS

---

### HIGH-4: No `.env.example` file

No template exists for required environment variables. Anyone deploying this app (or Jordan setting up a new machine) has no reference for what's needed.

**Status:** FIXED — `.env.example` created (see below).

---

### MEDIUM-1: Hardcoded fallback bank details in client-side code

**Files:**
- `src/components/invoices/invoice-pdf.ts:266-267` — BSB `084-402`, Account `18-675-1952`
- `src/components/invoices/invoice-detail.tsx:86` — Same values in email body template

Real bank details are used as fallback values when profile data isn't loaded. These render in the browser (client-side component).

**Status:** NOT FIXED — these are Jordan's real bank details and may be intentional defaults for invoice PDFs. However, they should ideally come from the database profile only, with an error state if profile fails to load.

**Recommendation:** Remove hardcoded bank details. Show "Bank details not configured" error if profile is null.

---

### MEDIUM-2: Send invoice API accepts arbitrary email recipients

**File:** `src/app/api/send-invoice/route.ts:16`

The `to` field from the request body is passed directly to `nodemailer` with no validation. Combined with HIGH-1 (no auth), this is an open email relay.

**Status:** NOT FIXED — depends on HIGH-1 auth fix.

**Recommendation:** Validate that `to` is in a whitelist of known client emails, or require auth.

---

### MEDIUM-3: Categorise API auto-writes to DB without auth

**File:** `src/app/api/ai/categorise/route.ts:82-107`

Uses `createServiceClient()` (service role key) to write AI suggestions and auto-categorise transactions. Since there's no auth on the route, any caller can trigger DB writes.

**Status:** NOT FIXED — depends on HIGH-1 auth fix.

---

### LOW-1: Data directory not explicitly gitignored

**Path:** `data/zoho/Invoice.csv` (346KB, 465 invoices)

The CSV contains invoice data (amounts, dates, client names). While `.gitignore` currently excludes it implicitly (it's untracked and not in any committed directory), there's no explicit rule preventing accidental commit.

**Status:** FIXED — added `data/` to `.gitignore`.

---

### LOW-2: Migration script contains service role key reference

**File:** `scripts/migrate-zoho.ts:16`

Uses `process.env.SUPABASE_SERVICE_ROLE_KEY` — acceptable for a one-time migration script, but should not be committed to a public repo.

**Status:** OK — script reads from `.env.local`, no hardcoded values.

---

## Secrets Scan Results

| Check | Result |
|-------|--------|
| Supabase keys in source code | CLEAN |
| Supabase keys in git history | CLEAN |
| Anthropic API keys in source code | CLEAN |
| Anthropic API keys in git history | CLEAN |
| `.env` files committed to git | CLEAN |
| `.env.local` in `.gitignore` | YES (`.env*` pattern) |
| Service role key in client code | CLEAN (server-only via `createServiceClient()`) |
| `NEXT_PUBLIC_` prefix on service role key | CLEAN (not prefixed) |
| npm audit vulnerabilities | 0 found |
| Hardcoded passwords/tokens in source | CLEAN |

---

## Credential Rotation Required

Even though no secrets were found in committed code or git history, the keys in `.env.local` should be rotated as a precaution since:
- The repo has been worked on without commits (keys may have been shared via other channels)
- This audit is a good milestone to establish a clean baseline

### Manual Actions Required (Jordan):

1. **Rotate Supabase anon key:** Dashboard > Settings > API > Rotate anon key
2. **Rotate Supabase service role key:** Same location > Rotate service role key
3. **Update `.env.local`** with new values
4. **Update Vercel environment variables:** Dashboard > Project > Settings > Environment Variables
5. **Verify RLS** is enabled on all tables (see HIGH-3)
6. **Commit the codebase** (see HIGH-2)
7. **Redeploy** after all updates

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| 1 | Commit all source code to git immediately |
| 2 | Add authentication to all API routes |
| 3 | Verify RLS is enabled on all Supabase tables |
| 4 | Rotate Supabase keys |
| 5 | Remove hardcoded bank detail fallbacks |
| 6 | Add email recipient validation to send-invoice |

---

*End of audit.*
