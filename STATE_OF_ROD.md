# STATE OF ROD

**Audit date:** 21 Apr 2026
**Auditor:** Claude (read-only, evidence-based)
**Branch:** `pwa-conversion` (24 ahead of origin) on commit `90a9dcc`
**Scope:** Full repo + Supabase project `vmjjngqcrvubgetaapru` + live site `https://lansbury-ledger.vercel.app`

---

## One paragraph

Rod is further along than a half-finished side project and less safe than a live tax tool should be. 469 real invoices totalling **$293,128** sit in Supabase with clean internal integrity; the UI renders 13 routes; 106 Vitest cases pass; `tsc` and `eslint` are green. But the site is **publicly accessible with no auth**, the **anon key scrapes Jordan's BSB + account number in one curl** (live-verified today), **five tables are writable by any visitor**, the **invoice counter is set to collide on the next Create**, and the **Time Machine compares against a fabricated $165,324 FY24-25 revenue** using the wrong tax brackets — telling Jordan he paid ~$1,275 more tax than he actually did. This is not an app you tell Jacqui about on Monday. Fix the four Critical issues first; the rest is tidy-up.

---

## Headline status

| Area | State | One-liner |
|------|-------|-----------|
| **Security** | 🔴 Broken | No auth, live bank-detail leak via anon key, 5 tables writable by anyone |
| **Invoicing** | 🟡 Works except create | 469 invoices ok; next Create will collide on `INV-000468` |
| **GST/BAS** | 🔴 Empty | Q3 FY25-26 due in 7 days; `bas_periods` row has all zeros |
| **Tax module** | 🟡 Works, wrong inputs | Math is right; historical P&L feeds it $5k short |
| **Time Machine** | 🔴 Fabricated | FY24-25 revenue $165,324 (actual $113,745) + wrong bracket rates |
| **Reports** | 🟡 Renders | Overstates FY24-25 net profit by $5,000 |
| **Transactions** | ⚪ No data | Table empty, CSV import works, nothing imported |
| **Documents** | ⚪ No data | Table empty, uploader works |
| **Household** | 🟡 Fake numbers | Monthly costs hardcoded; edit button goes nowhere |
| **Claims** | 🟡 Read-only | Telstra TIO visible; Advance Stage button silently fails |
| **Settings** | 🟡 Read-only | Save button silently fails (RLS) |
| **Rod Says (AI)** | 🔴 Broken | Wrong column name + 405 on prod |
| **Build** | 🟢 Green | tsc 0 errors, eslint 0, 106/106 tests pass |

Legend: 🔴 blocking, 🟡 working with caveats, 🟢 fine, ⚪ no data yet

---

## Top 5 things that matter

1. **Bank details leak via anon key (Critical, S-01).** Live reproducible today — `curl https://vmjjngqcrvubgetaapru.supabase.co/rest/v1/business_profile?select=bank_bsb,bank_account -H "apikey: <anon>"` returns BSB `084-402`, account `18-675-1952`. Fix: RLS policy on `business_profile` → service-role only, proxy reads through a server route. One SQL statement + one API endpoint.
2. **Five tables writable by any visitor (Critical, S-02).** `invoices`, `invoice_lines`, `transactions`, `documents`, `household_members` — anyone with DevTools can DELETE every invoice. Fix: tighten RLS to service-role writes, build `/api/invoice/*` proxy routes for the four client actions that currently write directly (Create, Mark Paid, Void, Delete).
3. **No auth on any page (Critical, S-03).** `/dashboard` returns 200 with full P&L to anyone. Fix: Supabase Auth session check in `src/middleware.ts`, single `(app)` layout guard. A couple of hours.
4. **Invoice counter collision on next Create (Critical, D-01).** `business_profile.invoice_next_number = 468`; actual max = `INV-000471`. Click "Create" → unique-constraint error or silent overwrite. Fix: one SQL `UPDATE business_profile SET invoice_next_number = 472` — then switch the counter to a Postgres sequence or `MAX(invoice_number)+1` computed at insert.
5. **Time Machine compares to fiction (Critical, F-01/F-02).** Hardcoded FY24-25 revenue is $165,324 vs certified $113,745, and tax brackets are pre-Stage-3 (19% / 32.5% instead of 16% / 30%). The "what-if" tool is lying to you by $51k on revenue and $1,275 on tax. Fix: replace hardcoded constants with reads from `historical_periods` + remove local `TAX_BRACKETS_FY2425` (use FY25-26 brackets — they're identical post-Stage-3).

---

## Critical findings

### S-01 — Live bank detail leak
Evidence: `.audit-scratch/04-smoke-test.md` shows curl response `[{"bank_bsb":"084-402","bank_account":"18-675-1952"}]` using the anon key from `.env.local`. Contradicts CLAUDE.md:236.

### S-02 — Anon writes on five tables
RLS policy `qual=true` for `ALL` command on `invoices`, `invoice_lines`, `transactions`, `documents`, `household_members`. Evidence: `.audit-scratch/01b-db-inventory.md` → RLS policies section.

### S-03 — No auth
No `src/middleware.ts`. `src/app/(app)/layout.tsx:1-40` has no session check. Production URL returns HTTP 200 for `/dashboard`.

### F-01 — Time Machine wrong FY24-25 brackets
`src/app/(app)/time-machine/page.tsx:21-27` uses 19/32.5/37/45% brackets. FY24-25 used 16/30/37/45% (Stage 3 cuts live 1 Jul 2024). Jordan's $63,833 renders as $11,212 tax vs actual $9,937.90.

### F-02 — Time Machine wrong FY24-25 revenue
`time-machine/page.tsx:13` — hardcoded `revenue: 165324`. Certified $113,745.45. Delta $51,579.

### D-01 — Invoice counter collision
`business_profile.invoice_next_number = 468`; `MAX(invoice_number) = INV-000471`. Non-atomic read-then-write at `invoice-form.tsx:132-136`.

---

## High findings

### F-03 — FY24-25 historical expenses $5,000 short
`historical_expense_categories` sums to $49,690.80. CLAUDE.md certifies $54,691. Missing categories: motor c/km $4,400 + accounting $600. Every module that reads `historical_periods` / `historical_expense_categories` overstates FY24-25 net profit by $5,000.

### F-04 — Dashboard expenses = `gstCredits × 11` fallback
`src/lib/queries.ts:181-182`. Ignores GST-free purchases. Coincidentally close to certified for FY24-25 (within 2%) — will drift on any year with different expense mix.

### D-02 — Rod Says AI is broken
`src/app/api/ai/rod-says/route.ts:31,63` selects `customer_name`; the column is `client_name` (see `types/database.ts:72`). Production returns 405 on POST — deploy is likely behind `pwa-conversion`.

### D-03 — Claims Advance Stage silently fails
`src/app/(app)/claims/page.tsx:74` → anon `.update('claims')`. RLS = service-role only. Button does nothing; no error shown.

### D-04 — Settings Save silently fails
`src/app/(app)/settings/page.tsx:27-36` → same pattern. Business profile can't be edited from the UI.

---

## Medium findings

- **D-05 — Household monthly costs hardcoded** (`household/page.tsx:12-19`). UI text says "Edit these in Settings" — Settings has no editor.
- **D-06 — `household_members.annual_income` NULL for all 3**. Certified incomes ($63,833 / $172,808) never loaded.
- **D-07 — `transactions` + `documents` tables empty**. Modules render blank state; CSV import works, never used.
- **D-08 — Categorise API auto-assign bug**. `categorise/route.ts:43` doesn't select `id`, so `account_id` auto-assignment at line 124 always resolves to `undefined`.
- **S-05 — API routes rate-limited but not auth-gated**. `src/lib/api-guard.ts` is same-origin + 20 req/60s. Comment admits it's not auth.

---

## Low / Notes

- **F-05 — Tax calculators inconsistent on `+1`**. Main calc compensates for `min=18201`; Time Machine's `calculateTaxFY2425` (line 33) does not. Minor rounding, dwarfed by F-01.
- **F-07 — Money as floats**. Fine at $300k scale; consider `decimal.js` only if scaling 10×.
- **T-01 — Two AI routes on outdated Sonnet**. `categorise` and `deduction-check` use `claude-sonnet-4-20250514`; current is `claude-sonnet-4-6` or `claude-haiku-4-5-20251001`.
- **T-02 — `vehicle_method` = logbook in DB**, c/km in CLAUDE.md. Stale field or a decision-to-make.
- **Dead directories** — `src/app/{dashboard,invoices,gst,...}` (8 empty folders) are cruft from pre-(app)-route scaffolding. LOW.
- **Receipt-capture dead state** — `(app)/layout.tsx:18` sets state that's never rendered.

---

## More complete than you remember

- **469 real invoices**, 100% paid, internal totals add up to the cent. Zero orphans. Zoho migration is solid.
- **106 Vitest cases** across tax, GST, quarter boundaries, CSV parsers (CBA / NAB / Westpac / Suncorp / Generic). FY boundary flip tests handle July 1 correctly.
- **Audit-risk score component** already codes ATO benchmarks (50% deduction ratio, income variance CV) — defensible under audit.
- **PWA plumbing** in place via Serwist; service worker + install prompt + offline page. Not broken.
- **API routes have defensive layers** — `api-guard.ts` does same-origin + rate limit, `send-invoice` does email-regex + clients-table allowlist + 10 MB PDF cap.
- **ATO tax brackets FY25-26 in `constants.ts:43-49`** are correct to the cent; base amounts verified by the bracket-integrity test.

---

## Less complete than prompts suggest

- **No auth**. Anywhere. "Production" is a public dashboard of Jordan's finances.
- **No bank CSV imported** despite a Transactions module, CSV parser with 5 bank formats, rule-based categorisation, and an AI categoriser. Zero rows in `transactions`.
- **No documents uploaded**. 0 rows.
- **BAS Q3 FY25-26 not prepared** (due 28 Apr 2026 — 7 days). 36 invoices totalling $19,883 inc GST sit in `invoices` but nothing is linked to the `bas_periods` row.
- **PAYG instalment variation** not checked — income is declining, instalments likely overstated (CLAUDE.md:187 flags this).
- **Super carry-forward balance** — CLAUDE.md:185 says URGENT, no trace of a check anywhere.
- **Historical monthly P&L is fabricated** — all 12 months in `historical_periods` show exactly the same expenses (`$4,141.74` = $49,690.80 ÷ 12). Monthly charts in the app are not real monthly data.
- **Only 1 migration file on disk vs 8 applied in Supabase** — reproducible schema does not exist. If someone nukes the Supabase project, the schema is lost.

---

## Known gaps (audit didn't cover)

- **Interactive browser tests** — no click-throughs. The module verdicts in `.audit-scratch/02-modules.md` come from code-reading, not running the app against Jordan's data in a browser session.
- **PWA behaviour on Android** — Jordan's primary device. Install flow, service-worker caching, offline invoice-drafting not tested.
- **SMTP send** — not triggered (would have billed credentials).
- **Anthropic API consumption patterns** — categorise + deduction-check not exercised against Jordan's data; token use not measured.
- **Cost/perf** — no Lighthouse run, no bundle-size audit, no cold-start timing on Vercel functions.

---

## Suggested 4-week roadmap

> Fix the bleeding first, then the fibs, then the gaps.

### Week 1 — Stop the bleeding
1. Lock down RLS: `business_profile` → service-role SELECT only; `invoices/invoice_lines/transactions/documents/household_members` → service-role ALL. **(S-01, S-02)**
2. Build proxy `/api/invoice/{create|update|mark-paid|delete}` routes using `createServiceClient` + `guardApiRoute`. Wire the four client actions in `invoice-detail.tsx` + `invoice-form.tsx` to hit them. **(S-02)**
3. Add Supabase Auth: sign-in page, `src/middleware.ts` session check, `(app)/layout.tsx` redirect-if-no-user. Single-user login for Jordan. **(S-03)**
4. Fix invoice counter: `UPDATE business_profile SET invoice_next_number = 472`. Change `invoice-form.tsx:132-136` to recompute from `MAX(invoice_number)+1` in a transaction. **(D-01)**
5. Lodge Q3 BAS (it's due). Prepare the `bas_periods` row from the 36 Q3 invoices. **(Compliance, not code)**

### Week 2 — Stop the lies
6. Backfill `historical_expense_categories` with motor c/km $4,400 + accounting $600. Add a "source = certified-tax-return" flag. **(F-03)**
7. Replace `expenses = gstCredits × 11` with a real transactions-based calc, or hide the fallback behind "estimate" copy. **(F-04)**
8. Rip Time Machine's hardcoded `FY2425` object and local `TAX_BRACKETS_FY2425`. Source revenue from `historical_periods`. Use the shared `calculateIncomeTax`. **(F-01, F-02)**
9. Fix Rod Says: rename `customer_name` → `client_name` in `rod-says/route.ts`. Redeploy. **(D-02)**
10. Fix Claims Advance Stage + Settings Save — either RLS + proxy route (like step 2) or an admin-only local endpoint. **(D-03, D-04)**

### Week 3 — Fill the holes
11. Import 3 months of bank CSV into `transactions` via the existing `/transactions` page. Run the rule categoriser. Spot-check vs Jordan's records. **(D-07)**
12. Upload 10 key documents to the Vault (BAS lodgements, tax return, insurance COI). **(D-07)**
13. Load `household_members.annual_income` + move `MONTHLY_COSTS` into a new `household_expenses` table editable from Settings. **(D-05, D-06)**
14. Swap outdated Sonnet 4.0 calls → `claude-sonnet-4-6` in `categorise` + `deduction-check`. **(T-01)**
15. Fix categorise auto-assign bug: add `id` to the SELECT in `categorise/route.ts:43`. **(D-08)**

### Week 4 — Tidy + document
16. Dump Supabase schema via `supabase db dump` into the migrations folder. Commit. **(migration drift)**
17. Delete 8 empty legacy app-router folders. **(cruft)**
18. Remove receipt-capture dead state from `(app)/layout.tsx:18`. **(cruft)**
19. Commit `AUDIT.md` / `REPORT.md` / `LOCAL_LLM.md` / `rod-overnight-run.md` into `docs/archive/` or delete — they've sat untracked since 19 Apr.
20. Merge the 11 stale `overnight/*` and `design-*` branches or close them.

---

## Appendices

- `./.audit-scratch/01-inventory.md` — repo + stack + routes + env + components
- `./.audit-scratch/01b-db-inventory.md` — Supabase tables + RLS + data integrity spot-checks
- `./.audit-scratch/02-modules.md` — per-module health (13 pages + 4 APIs + libs)
- `./.audit-scratch/03-cross-cutting.md` — this audit's cross-cutting findings with IDs
- `./.audit-scratch/04-smoke-test.md` — live curl evidence (bank-detail leak, 405 on rod-says)
- `./.audit-scratch/05-build-health.md` — tsc, eslint, vitest, git state

---

*End of report. Plain English. No corporate fluff. Evidence tied to file:line or curl output.*
