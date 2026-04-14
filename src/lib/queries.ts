import { supabase } from './supabase'
import { getFYDates } from './utils'
import { TAX_BRACKETS_FY2526, SBITO_RATE, SBITO_CAP } from './constants'
import type { Account, Transaction, Invoice, BASPeriod, ComplianceEvent, BusinessProfile, Anomaly, HistoricalPeriod, HistoricalExpenseCategory, Claim } from '@/types/database'

export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, code, name, type, tax_code, parent_id, business_use_pct, ato_label, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw new Error(`Failed to fetch accounts: ${error.message}`)
  return data as Account[]
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const { data, error } = await supabase
    .from('business_profile')
    .select('*')
    .limit(1)
    .single()
  if (error) throw new Error(`Failed to fetch business profile: ${error.message}`)
  return data as BusinessProfile
}

export async function getTransactions(filters?: {
  startDate?: string
  endDate?: string
  accountId?: string
  isReviewed?: boolean
  isPersonal?: boolean
  limit?: number
}): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*, account:accounts(id, code, name, type, tax_code, business_use_pct)')
    .order('date', { ascending: false })

  if (filters?.startDate) query = query.gte('date', filters.startDate)
  if (filters?.endDate) query = query.lte('date', filters.endDate)
  if (filters?.accountId) query = query.eq('account_id', filters.accountId)
  if (filters?.isReviewed !== undefined) query = query.eq('is_reviewed', filters.isReviewed)
  if (filters?.isPersonal !== undefined) query = query.eq('is_personal', filters.isPersonal)
  if (filters?.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`)
  return data as Transaction[]
}

export async function getInvoices(status?: string): Promise<Invoice[]> {
  let query = supabase
    .from('invoices')
    .select('*, lines:invoice_lines(id, description, quantity, unit_price, gst_amount, total)')
    .order('issue_date', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch invoices: ${error.message}`)
  return data as Invoice[]
}

export async function getBASPeriods(): Promise<BASPeriod[]> {
  const { data, error } = await supabase
    .from('bas_periods')
    .select('*')
    .order('start_date', { ascending: false })
  if (error) throw new Error(`Failed to fetch BAS periods: ${error.message}`)
  return data as BASPeriod[]
}

export async function getComplianceEvents(): Promise<ComplianceEvent[]> {
  const { data, error } = await supabase
    .from('compliance_events')
    .select('*')
    .order('due_date')
  if (error) throw new Error(`Failed to fetch compliance events: ${error.message}`)
  return data as ComplianceEvent[]
}

export async function getAnomalies(dismissed = false): Promise<Anomaly[]> {
  const { data, error } = await supabase
    .from('anomalies')
    .select('*')
    .eq('is_dismissed', dismissed)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to fetch anomalies: ${error.message}`)
  return data as Anomaly[]
}

export async function getHistoricalPeriods(fy: string, periodType?: 'annual' | 'monthly'): Promise<HistoricalPeriod[]> {
  let query = supabase
    .from('historical_periods')
    .select('*')
    .eq('financial_year', fy)
    .order('start_date')
  if (periodType) query = query.eq('period_type', periodType)
  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch historical periods: ${error.message}`)
  return data as HistoricalPeriod[]
}

export async function getHistoricalExpenseCategories(fy: string): Promise<HistoricalExpenseCategory[]> {
  const { data, error } = await supabase
    .from('historical_expense_categories')
    .select('*')
    .eq('financial_year', fy)
    .order('amount', { ascending: false })
  if (error) throw new Error(`Failed to fetch historical expense categories: ${error.message}`)
  return data as HistoricalExpenseCategory[]
}

export async function getClaims(): Promise<Claim[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to fetch claims: ${error.message}`)
  return data as Claim[]
}

/** Dashboard summary — derives revenue from invoices, expenses from transactions or BAS */
export async function getDashboardSummary() {
  const { start, end } = getFYDates()
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  // Revenue: always derive from invoices (the authoritative income source)
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total, subtotal, gst_amount, status, issue_date')
    .gte('issue_date', startStr)
    .lte('issue_date', endStr)
    .neq('status', 'void')

  let revenue = 0
  let invoiceGst = 0
  let overdueCount = 0
  if (invoices) {
    for (const inv of invoices) {
      revenue += inv.total
      invoiceGst += inv.gst_amount ?? 0
      if (inv.status === 'overdue') overdueCount++
    }
  }

  // Expenses: from transactions if available, otherwise estimate from BAS credits
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, gst_amount, business_use_pct, is_personal, account:accounts(type, code)')
    .gte('date', startStr)
    .lte('date', endStr)

  let expenses = 0
  let gstCredits = 0
  const hasTransactions = transactions && transactions.length > 0

  if (hasTransactions) {
    for (const t of transactions!) {
      if (t.is_personal) continue
      const acct = t.account as unknown as { type: string; code: string } | null
      const bizPct = (t.business_use_pct ?? 100) / 100
      const gst = Math.abs(t.gst_amount ?? 0)
      if (acct?.type === 'expense') {
        expenses += Math.abs(t.amount) * bizPct
        gstCredits += gst * bizPct
      }
    }
  } else {
    // Estimate from BAS credits for current FY quarters
    const { data: basPeriods } = await supabase
      .from('bas_periods')
      .select('gst_credits')
      .gte('start_date', startStr)
      .lte('end_date', endStr)
    if (basPeriods) {
      for (const p of basPeriods) {
        gstCredits += p.gst_credits ?? 0
      }
      // Estimate expenses as credits × 11 (reverse the 1/11 GST calc)
      expenses = gstCredits * 11
    }
  }

  const gstCollected = invoiceGst
  const netGST = gstCollected - gstCredits

  const { count: uncategorisedCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .is('account_id', null)
    .eq('is_personal', false)

  const { count: anomalyCount } = await supabase
    .from('anomalies')
    .select('id', { count: 'exact', head: true })
    .eq('is_dismissed', false)

  const netProfit = revenue - expenses
  const estimatedTax = calculateIncomeTax(netProfit)

  return {
    revenue,
    expenses,
    netProfit,
    gstCollected,
    gstCredits,
    netGST,
    estimatedTax,
    effectiveRate: netProfit > 0 ? (estimatedTax / netProfit) * 100 : 0,
    overdueCount,
    uncategorisedCount: uncategorisedCount ?? 0,
    anomalyCount: anomalyCount ?? 0,
  }
}

/** ATO individual tax rates — uses bracket table from constants */
export function calculateIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0
  for (const bracket of TAX_BRACKETS_FY2526) {
    if (taxableIncome <= bracket.max) {
      return bracket.base + (taxableIncome - bracket.min + 1) * bracket.rate
    }
  }
  // Fallback for highest bracket
  const top = TAX_BRACKETS_FY2526[TAX_BRACKETS_FY2526.length - 1]
  return top.base + (taxableIncome - top.min + 1) * top.rate
}

/** Small Business Income Tax Offset (s61-500 ITAA 1997) */
export function calculateSBITO(taxOnBusinessIncome: number): number {
  return Math.min(taxOnBusinessIncome * SBITO_RATE, SBITO_CAP)
}
