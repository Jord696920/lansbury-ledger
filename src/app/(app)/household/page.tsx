'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { getDashboardSummary, calculateIncomeTax, calculateSBITO } from '@/lib/queries'
import { MEDICARE_LEVY_RATE, getEOFYDate } from '@/lib/constants'
import { Home, Heart, TrendingUp, Wallet, PiggyBank, Coffee, ShieldCheck } from 'lucide-react'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import type { Invoice, HouseholdMonthlyCosts } from '@/types/database'

// Used only as a safety fallback when business_profile.monthly_costs is
// NULL (pre-migration databases). After the household_settings migration
// runs, the DB-seeded values are the source of truth.
const FALLBACK_monthlyCosts: HouseholdMonthlyCosts = {
  mortgage: 2800,
  groceries: 1200,
  utilities: 350,
  insurance: 200,
  subscriptions: 150,
  kids: 400,
}

export default function HouseholdPage() {
  const [loading, setLoading] = useState(true)
  const [revenue, setRevenue] = useState(0)
  const [deductions, setDeductions] = useState(0)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [noDeductionData, setNoDeductionData] = useState(false)
  const [monthlyCosts, setMonthlyCosts] = useState<HouseholdMonthlyCosts>(FALLBACK_monthlyCosts)

  useEffect(() => {
    async function load() {
      const [summary, { data: inv }, { data: profile }] = await Promise.all([
        getDashboardSummary(),
        supabase.from('invoices').select('*').neq('status', 'void'),
        supabase.from('business_profile').select('monthly_costs').limit(1).maybeSingle(),
      ])
      setRevenue(summary.revenue)
      setDeductions(summary.expenses)
      setNoDeductionData(summary.expensesSource === 'none')
      setInvoices(inv ?? [])
      const dbCosts = (profile as { monthly_costs?: HouseholdMonthlyCosts | null } | null)?.monthly_costs
      if (dbCosts) setMonthlyCosts(dbCosts)
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()
  const taxableIncome = revenue - deductions
  const incomeTax = calculateIncomeTax(taxableIncome)
  const sbito = calculateSBITO(incomeTax)
  const medicare = taxableIncome * MEDICARE_LEVY_RATE
  const totalTax = incomeTax + medicare - sbito
  const takeHome = revenue - deductions - totalTax

  // Monthly average take-home (based on months elapsed in FY)
  const fyStart = new Date(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1, 6, 1)
  const monthsElapsed = Math.max(1, (now.getFullYear() - fyStart.getFullYear()) * 12 + (now.getMonth() - fyStart.getMonth()) + 1)
  const monthlyTakeHome = takeHome / monthsElapsed

  // Total household costs
  const totalMonthlyCosts = Object.values(monthlyCosts).reduce((s, v) => s + v, 0)
  const monthlyFreedom = monthlyTakeHome - totalMonthlyCosts
  const runwayMonths = monthlyTakeHome > 0 ? Math.floor(takeHome / totalMonthlyCosts) : 0

  // Monthly trend — last 6 months of invoice revenue
  const monthlyTrend = useMemo(() => {
    const months: { month: string; revenue: number; afterTax: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i)
      const ms = startOfMonth(d).toISOString().split('T')[0]
      const me = endOfMonth(d).toISOString().split('T')[0]
      const rev = invoices
        .filter((inv) => inv.issue_date >= ms && inv.issue_date <= me)
        .reduce((s, inv) => s + inv.total, 0)
      // Rough after-tax estimate (using effective rate)
      const effectiveRate = taxableIncome > 0 ? totalTax / taxableIncome : 0.2
      const afterTax = rev * (1 - effectiveRate)
      months.push({ month: format(d, 'MMM'), revenue: Math.round(rev), afterTax: Math.round(afterTax) })
    }
    return months
  }, [invoices, now, taxableIncome, totalTax])

  // EOFY
  const eofy = getEOFYDate()
  const eofyDays = Math.max(0, Math.ceil((eofy.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Home className="h-6 w-6 text-accent-pink" />
          <h1 className="text-2xl font-bold text-text-primary">Household Impact</h1>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          How the business flows through to the Lansbury household — for Bethany
        </p>
      </div>

      {noDeductionData && (
        <div className="rounded-lg border border-accent-amber/30 bg-surface-amber px-3 py-2 text-xs text-text-primary">
          <span className="font-semibold">Worst-case take-home.</span> No transactions categorised yet — deductions read as $0, so tax shown is the maximum (and take-home the minimum). Real numbers will appear once bank CSVs are imported.
        </div>
      )}

      {/* Hero Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-4">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-accent-green" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Take-Home Pay</span>
          </div>
          <p className="font-financial text-2xl font-bold text-accent-green">{formatCurrency(monthlyTakeHome)}</p>
          <p className="text-[11px] text-text-tertiary">/month average (after tax)</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-4">
          <div className="mb-2 flex items-center gap-2">
            <Coffee className="h-4 w-4 text-accent-amber" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Household Costs</span>
          </div>
          <p className="font-financial text-2xl font-bold text-accent-amber">{formatCurrency(totalMonthlyCosts)}</p>
          <p className="text-[11px] text-text-tertiary">/month estimated</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-4">
          <div className="mb-2 flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-accent-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Monthly Freedom</span>
          </div>
          <p className={cn('font-financial text-2xl font-bold', monthlyFreedom >= 0 ? 'text-accent-green' : 'text-accent-red')}>
            {formatCurrency(monthlyFreedom)}
          </p>
          <p className="text-[11px] text-text-tertiary">{monthlyFreedom >= 0 ? 'surplus after costs' : 'shortfall'}</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent-cyan" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Runway</span>
          </div>
          <p className="font-financial text-2xl font-bold text-accent-cyan">{runwayMonths}</p>
          <p className="text-[11px] text-text-tertiary">months of costs covered by FY earnings</p>
        </div>
      </div>

      {/* Money Flow Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Where does it go? */}
        <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Where Your Revenue Goes</h3>
          <div className="space-y-2.5">
            {[
              { label: 'Business Expenses', amount: deductions / monthsElapsed, color: 'bg-accent-blue', pct: deductions / revenue },
              { label: 'Tax + Medicare', amount: totalTax / monthsElapsed, color: 'bg-accent-red', pct: totalTax / revenue },
              { label: 'Household Costs', amount: totalMonthlyCosts, color: 'bg-accent-amber', pct: (totalMonthlyCosts * monthsElapsed) / revenue },
              { label: 'Savings / Discretionary', amount: Math.max(0, monthlyFreedom), color: 'bg-accent-green', pct: Math.max(0, monthlyFreedom * monthsElapsed) / revenue },
            ].map((item, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{item.label}</span>
                  <span className="font-financial font-medium text-text-primary">
                    {formatCurrency(item.amount)}/mo
                    <span className="ml-1.5 text-text-tertiary">({(item.pct * 100).toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', item.color)}
                    style={{ width: `${Math.min(item.pct * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Household Cost Breakdown */}
        <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Monthly Household Costs</h3>
          <div className="space-y-2">
            {Object.entries(monthlyCosts).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2">
                <span className="text-xs capitalize text-text-secondary">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="font-financial text-xs font-medium text-text-primary">{formatCurrency(val)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border-subtle px-3 pt-2">
              <span className="text-xs font-semibold text-text-primary">Total</span>
              <span className="font-financial text-sm font-bold text-accent-amber">{formatCurrency(totalMonthlyCosts)}</span>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-text-tertiary">
            Edit these in Settings to match your actual costs for more accurate projections.
          </p>
        </div>
      </div>

      {/* Monthly Take-Home Trend */}
      <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Monthly Take-Home Trend</h3>
        <div className="flex items-end gap-2" style={{ height: 140 }}>
          {monthlyTrend.map((m, i) => {
            const maxRev = Math.max(...monthlyTrend.map((x) => x.revenue), 1)
            const barH = (m.revenue / maxRev) * 120
            const afterTaxH = (m.afterTax / maxRev) * 120
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative flex w-full justify-center" style={{ height: 120 }}>
                  <div
                    className="absolute bottom-0 w-4/5 rounded-t bg-accent-primary/20"
                    style={{ height: barH }}
                  />
                  <div
                    className="absolute bottom-0 w-4/5 rounded-t bg-accent-green"
                    style={{ height: afterTaxH }}
                  />
                </div>
                <span className="text-[10px] text-text-tertiary">{m.month}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-text-tertiary">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-4 rounded bg-accent-primary/20" />
            Gross Revenue
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-4 rounded bg-accent-green" />
            After Tax (est.)
          </div>
        </div>
      </div>

      {/* Bethany's quick summary */}
      <div className="rounded-2xl border border-border-subtle bg-surface-pink p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-accent-pink" />
          <h3 className="text-sm font-semibold text-text-primary">The Simple Version</h3>
        </div>
        <div className="mt-3 space-y-2 text-sm text-text-secondary">
          <p>
            The business has earned <span className="font-financial font-semibold text-accent-green">{formatCurrency(revenue)}</span> this financial year.
          </p>
          <p>
            After business costs and tax, that leaves about <span className="font-financial font-semibold text-text-primary">{formatCurrency(monthlyTakeHome)}/month</span> take-home pay.
          </p>
          <p>
            With household costs of <span className="font-financial font-semibold text-accent-amber">{formatCurrency(totalMonthlyCosts)}/month</span>,
            {monthlyFreedom >= 0
              ? <> there&apos;s <span className="font-financial font-semibold text-accent-green">{formatCurrency(monthlyFreedom)}</span> left over each month.</>
              : <> we&apos;re <span className="font-financial font-semibold text-accent-red">{formatCurrency(Math.abs(monthlyFreedom))}</span> short each month.</>
            }
          </p>
          {eofyDays <= 120 && (
            <p className="text-accent-amber">
              Tax time is in {eofyDays} days — estimated tax bill: <span className="font-financial font-semibold">{formatCurrency(totalTax)}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
