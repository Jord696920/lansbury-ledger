import { supabase } from './supabase'
import type { BASPeriod } from '@/types/database'

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info'

export interface CheckResult {
  id: string
  title: string
  status: CheckStatus
  detail: string
  expected?: string
  actual?: string
  variance?: number
  rows?: Array<Record<string, string | number>>
}

const LEGACY_EMAIL = 'sales@seqautomotive.com.au'
const CORRECT_EMAIL = 'seqautomotive@gmail.com'
const CORRECT_ABN_DIGITS = '18650448336'

// Certified FY2024-25 P&L (Kennedy McLaughlin, lodged 9 Apr 2026).
const CERTIFIED_FY2425 = {
  revenueInc: 113745.45,
  expensesInc: 49690.80,
  netProfit: 64054.65,
} as const

function money(n: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(n)
}

function near(a: number, b: number, tolerance = 0.02): boolean {
  return Math.abs(a - b) <= tolerance
}

export async function checkBusinessProfileAbn(): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('business_profile')
    .select('abn, business_name')
    .limit(1)
    .single()
  if (error) {
    return {
      id: 'abn',
      title: 'Business ABN matches master reference',
      status: 'fail',
      detail: `Failed to load business_profile: ${error.message}`,
    }
  }
  const stored = (data?.abn ?? '').replace(/\s+/g, '')
  const ok = stored === CORRECT_ABN_DIGITS
  return {
    id: 'abn',
    title: 'Business ABN matches master reference',
    status: ok ? 'pass' : 'fail',
    expected: '18 650 448 336',
    actual: data?.abn ?? '(none)',
    detail: ok
      ? `ABN locked to the correct value for ${data?.business_name ?? 'Jordan Lansbury'}.`
      : 'Stored ABN does not match the master reference. Run migration 0001.',
  }
}

export async function checkClientEmails(): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, email')
  if (error) {
    return {
      id: 'client-emails',
      title: 'No client uses the retired SEQ email',
      status: 'fail',
      detail: `Failed to load clients: ${error.message}`,
    }
  }
  const offenders = (data ?? []).filter(
    (c) => (c.email ?? '').toLowerCase() === LEGACY_EMAIL
  )
  return {
    id: 'client-emails',
    title: 'No client uses the retired SEQ email',
    status: offenders.length === 0 ? 'pass' : 'fail',
    expected: CORRECT_EMAIL,
    actual: offenders.length === 0 ? 'none found' : `${offenders.length} offender(s)`,
    detail:
      offenders.length === 0
        ? 'All client emails are clean. CHECK constraint enforces this at the DB level.'
        : 'Legacy email detected. Migration 0001 will reject further writes.',
    rows: offenders.map((c) => ({ id: c.id, name: c.name, email: c.email ?? '' })),
  }
}

export interface QuarterReconciliation {
  period: BASPeriod
  collected: { lodged: number; reconciled: number; variance: number }
  credits: { lodged: number; reconciled: number; variance: number }
  net: { lodged: number; reconciled: number; variance: number }
  invoiceCount: number
  billCount: number
}

export async function reconcileBasQuarters(): Promise<QuarterReconciliation[]> {
  const { data: periods } = await supabase
    .from('bas_periods')
    .select('*')
    .order('start_date', { ascending: true })
  if (!periods?.length) return []

  const out: QuarterReconciliation[] = []
  for (const p of periods as BASPeriod[]) {
    const [{ data: invoices }, { data: txns }] = await Promise.all([
      supabase
        .from('invoices')
        .select('gst_amount, status')
        .gte('issue_date', p.start_date)
        .lte('issue_date', p.end_date)
        .neq('status', 'void'),
      supabase
        .from('transactions')
        .select('gst_amount, business_use_pct, is_personal, account:accounts(type)')
        .gte('date', p.start_date)
        .lte('date', p.end_date),
    ])

    const collectedReconciled = (invoices ?? []).reduce(
      (sum, inv) => sum + (inv.gst_amount ?? 0),
      0
    )

    let creditsReconciled = 0
    for (const t of txns ?? []) {
      if (t.is_personal) continue
      const acct = t.account as unknown as { type?: string } | null
      if (acct?.type !== 'expense') continue
      const gst = Math.abs(t.gst_amount ?? 0)
      const bizPct = (t.business_use_pct ?? 100) / 100
      creditsReconciled += gst * bizPct
    }

    const netReconciled = collectedReconciled - creditsReconciled
    out.push({
      period: p,
      collected: {
        lodged: p.gst_collected ?? 0,
        reconciled: collectedReconciled,
        variance: collectedReconciled - (p.gst_collected ?? 0),
      },
      credits: {
        lodged: p.gst_credits ?? 0,
        reconciled: creditsReconciled,
        variance: creditsReconciled - (p.gst_credits ?? 0),
      },
      net: {
        lodged: p.net_gst ?? 0,
        reconciled: netReconciled,
        variance: netReconciled - (p.net_gst ?? 0),
      },
      invoiceCount: invoices?.length ?? 0,
      billCount: txns?.length ?? 0,
    })
  }
  return out
}

export async function checkBasReconciliation(): Promise<CheckResult> {
  const quarters = await reconcileBasQuarters()
  if (!quarters.length) {
    return {
      id: 'bas-recon',
      title: 'BAS quarters reconcile to underlying transactions',
      status: 'info',
      detail: 'No BAS periods seeded yet.',
    }
  }
  // Warn when collected or credits drift by >$1 or when transactions are empty
  // for a lodged quarter (can't reconcile without the underlying data).
  const offenders = quarters.filter(
    (q) =>
      Math.abs(q.collected.variance) > 1 ||
      Math.abs(q.credits.variance) > 1 ||
      (q.period.status === 'lodged' && q.invoiceCount === 0 && q.billCount === 0)
  )
  return {
    id: 'bas-recon',
    title: 'BAS quarters reconcile to underlying transactions',
    status: offenders.length === 0 ? 'pass' : 'warn',
    detail:
      offenders.length === 0
        ? `All ${quarters.length} quarters reconcile within $1.`
        : `${offenders.length} of ${quarters.length} quarters have variance or missing source data — see detail table.`,
    rows: quarters.map((q) => ({
      quarter: q.period.period_label,
      status: q.period.status,
      invoices: q.invoiceCount,
      bills: q.billCount,
      collected_lodged: money(q.collected.lodged),
      collected_recon: money(q.collected.reconciled),
      credits_lodged: money(q.credits.lodged),
      credits_recon: money(q.credits.reconciled),
      net_variance: money(q.net.variance),
    })),
  }
}

export async function checkCertifiedFy2425(): Promise<CheckResult> {
  // FY2024-25 window: 1 Jul 2024 → 30 Jun 2025
  const start = '2024-07-01'
  const end = '2025-06-30'

  const [{ data: invoices }, { data: txns }] = await Promise.all([
    supabase
      .from('invoices')
      .select('total, status')
      .gte('issue_date', start)
      .lte('issue_date', end)
      .neq('status', 'void'),
    supabase
      .from('transactions')
      .select('amount, business_use_pct, is_personal, account:accounts(type)')
      .gte('date', start)
      .lte('date', end),
  ])

  const revenue = (invoices ?? []).reduce((s, i) => s + (i.total ?? 0), 0)
  let expenses = 0
  for (const t of txns ?? []) {
    if (t.is_personal) continue
    const acct = t.account as unknown as { type?: string } | null
    if (acct?.type !== 'expense') continue
    const bizPct = (t.business_use_pct ?? 100) / 100
    expenses += Math.abs(t.amount ?? 0) * bizPct
  }
  const net = revenue - expenses

  const ok =
    near(revenue, CERTIFIED_FY2425.revenueInc, 1) &&
    near(expenses, CERTIFIED_FY2425.expensesInc, 1) &&
    near(net, CERTIFIED_FY2425.netProfit, 1)

  return {
    id: 'certified-fy2425',
    title: 'FY2024-25 P&L matches Kennedy McLaughlin certificate',
    status: ok ? 'pass' : 'warn',
    expected: `${money(CERTIFIED_FY2425.revenueInc)} / ${money(CERTIFIED_FY2425.expensesInc)} / ${money(CERTIFIED_FY2425.netProfit)}`,
    actual: `${money(revenue)} / ${money(expenses)} / ${money(net)}`,
    detail: ok
      ? 'Revenue, expenses and net profit all match the certified figures.'
      : 'Reconstructed totals drift from the certified figures — investigate before lodging FY25-26.',
    rows: [
      { metric: 'Revenue (inc GST)', expected: money(CERTIFIED_FY2425.revenueInc), actual: money(revenue), variance: money(revenue - CERTIFIED_FY2425.revenueInc) },
      { metric: 'Expenses (inc GST)', expected: money(CERTIFIED_FY2425.expensesInc), actual: money(expenses), variance: money(expenses - CERTIFIED_FY2425.expensesInc) },
      { metric: 'Net profit', expected: money(CERTIFIED_FY2425.netProfit), actual: money(net), variance: money(net - CERTIFIED_FY2425.netProfit) },
    ],
  }
}

export async function checkInvoiceLineTotals(): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, subtotal, gst_amount, lines:invoice_lines(total)')
  if (error) {
    return {
      id: 'invoice-totals',
      title: 'Invoice totals equal sum of line items',
      status: 'fail',
      detail: `Failed to load invoices: ${error.message}`,
    }
  }
  const offenders: Array<Record<string, string | number>> = []
  for (const inv of data ?? []) {
    const lines = (inv.lines as unknown as Array<{ total: number }>) ?? []
    const lineSum = lines.reduce((s, l) => s + (l.total ?? 0), 0)
    if (lines.length && !near(lineSum, inv.total ?? 0, 0.05)) {
      offenders.push({
        invoice: inv.invoice_number,
        header_total: money(inv.total ?? 0),
        line_total: money(lineSum),
        variance: money(lineSum - (inv.total ?? 0)),
      })
    }
  }
  return {
    id: 'invoice-totals',
    title: 'Invoice totals equal sum of line items',
    status: offenders.length === 0 ? 'pass' : 'warn',
    detail:
      offenders.length === 0
        ? `All ${data?.length ?? 0} invoices balance to line items.`
        : `${offenders.length} invoice(s) have a header/line mismatch.`,
    rows: offenders,
  }
}

export async function checkDuplicateInvoiceNumbers(): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
  if (error) {
    return {
      id: 'invoice-dupes',
      title: 'Invoice numbers are unique',
      status: 'fail',
      detail: `Failed to load invoices: ${error.message}`,
    }
  }
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.invoice_number, (counts.get(row.invoice_number) ?? 0) + 1)
  }
  const dupes = [...counts.entries()].filter(([, n]) => n > 1)
  return {
    id: 'invoice-dupes',
    title: 'Invoice numbers are unique',
    status: dupes.length === 0 ? 'pass' : 'fail',
    detail:
      dupes.length === 0
        ? 'No duplicate invoice numbers.'
        : `${dupes.length} duplicated invoice number(s).`,
    rows: dupes.map(([num, n]) => ({ invoice_number: num, occurrences: n })),
  }
}

export async function checkOrphanBills(): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, description, amount, account_id, business_use_pct, receipt_url, is_personal, account:accounts(type)')
    .eq('is_personal', false)
  if (error) {
    return {
      id: 'orphan-bills',
      title: 'No orphan business bills',
      status: 'fail',
      detail: `Failed to load transactions: ${error.message}`,
    }
  }
  const offenders = (data ?? []).filter((t) => {
    const acct = t.account as unknown as { type?: string } | null
    if (acct?.type !== 'expense') return false
    return t.account_id == null || t.business_use_pct == null || !t.receipt_url
  })
  return {
    id: 'orphan-bills',
    title: 'No orphan business bills',
    status: offenders.length === 0 ? 'pass' : 'warn',
    detail:
      offenders.length === 0
        ? 'Every business expense has a category, business-use %, and receipt.'
        : `${offenders.length} expense transaction(s) missing category, business-use %, or receipt.`,
    rows: offenders.slice(0, 20).map((t) => ({
      date: t.date,
      description: t.description,
      amount: money(t.amount ?? 0),
      missing: [
        t.account_id == null ? 'category' : null,
        t.business_use_pct == null ? 'biz-use' : null,
        !t.receipt_url ? 'receipt' : null,
      ]
        .filter(Boolean)
        .join(', '),
    })),
  }
}

export async function checkUncategorised(): Promise<CheckResult> {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .is('account_id', null)
    .eq('is_personal', false)
  if (error) {
    return {
      id: 'uncategorised',
      title: 'Uncategorised transaction backlog',
      status: 'fail',
      detail: `Failed to count: ${error.message}`,
    }
  }
  const n = count ?? 0
  return {
    id: 'uncategorised',
    title: 'Uncategorised transaction backlog',
    status: n === 0 ? 'pass' : n < 10 ? 'warn' : 'fail',
    detail:
      n === 0
        ? 'Zero uncategorised business transactions.'
        : `${n} uncategorised business transaction(s). Queue for Rod's smart categorisation.`,
    actual: String(n),
    expected: '0',
  }
}

export async function runAllIntegrityChecks(): Promise<CheckResult[]> {
  const results = await Promise.all([
    checkBusinessProfileAbn(),
    checkClientEmails(),
    checkBasReconciliation(),
    checkCertifiedFy2425(),
    checkInvoiceLineTotals(),
    checkDuplicateInvoiceNumbers(),
    checkOrphanBills(),
    checkUncategorised(),
  ])
  return results
}

export function scoreFromChecks(checks: CheckResult[]): number {
  if (!checks.length) return 0
  const weight = { pass: 1, info: 1, warn: 0.6, fail: 0 }
  const total = checks.reduce((s, c) => s + weight[c.status], 0)
  return Math.round((total / checks.length) * 100)
}
