'use client'

import { useState, useEffect, useMemo } from 'react'
import { MetricCard } from '@/components/ui/metric-card'
import { RevenueExpenseChart } from '@/components/dashboard/revenue-expense-chart'
import { RevenueForecast } from '@/components/dashboard/revenue-forecast'
import { RecentInvoices } from '@/components/dashboard/recent-activity'
import { HealthScore } from '@/components/dashboard/health-score'
import { RodSays } from '@/components/dashboard/rod-says'
import { getDashboardSummary, getInvoices, getBASPeriods } from '@/lib/queries'
import { getEOFYDate, getCurrentQuarter } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { useAnimatedNumber } from '@/hooks/use-animated-number'
import { DollarSign, TrendingUp, Receipt, Calculator, Target, CalendarClock, ArrowRight } from 'lucide-react'
import { differenceInDays, format, subMonths, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns'
import Link from 'next/link'
import type { Invoice, BASPeriod } from '@/types/database'

const MONTHLY_TARGET = 10000

interface Summary {
  revenue: number
  expenses: number
  netProfit: number
  netGST: number
  estimatedTax: number
  effectiveRate: number
  uncategorisedCount: number
  overdueCount: number
  anomalyCount: number
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [basPeriods, setBasPeriods] = useState<BASPeriod[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, inv, bas] = await Promise.all([
          getDashboardSummary(),
          getInvoices(),
          getBASPeriods(),
        ])
        setSummary(s)
        setInvoices(inv)
        setBasPeriods(bas)
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Current month revenue from invoices
  const now = new Date()
  const monthStart = startOfMonth(now).toISOString().split('T')[0]
  const monthEnd = endOfMonth(now).toISOString().split('T')[0]
  const thisMonthInvoices = useMemo(
    () => invoices.filter((inv) => inv.issue_date >= monthStart && inv.issue_date <= monthEnd && inv.status !== 'void'),
    [invoices, monthStart, monthEnd]
  )
  const monthRevenue = thisMonthInvoices.reduce((s, inv) => s + inv.total, 0)
  const monthRemaining = Math.max(0, MONTHLY_TARGET - monthRevenue)
  const monthProgress = Math.min(100, (monthRevenue / MONTHLY_TARGET) * 100)
  const today = now.getDate()
  const daysInMonth = getDaysInMonth(now)
  const daysLeft = daysInMonth - today
  const dailyRunRate = daysLeft > 0 ? monthRemaining / daysLeft : 0

  // Same month last year
  const lastYearStart = format(subMonths(startOfMonth(now), 12), 'yyyy-MM-dd')
  const lastYearEnd = format(endOfMonth(subMonths(now, 12)), 'yyyy-MM-dd')
  const lastYearRevenue = useMemo(
    () => invoices.filter((inv) => inv.issue_date >= lastYearStart && inv.issue_date <= lastYearEnd && inv.status !== 'void').reduce((s, inv) => s + inv.total, 0),
    [invoices, lastYearStart, lastYearEnd]
  )

  // Monthly chart data from invoices
  const monthlyData = useMemo(() => {
    const months: { month: string; revenue: number; expenses: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i)
      const ms = startOfMonth(d).toISOString().split('T')[0]
      const me = endOfMonth(d).toISOString().split('T')[0]
      const rev = invoices
        .filter((inv) => inv.issue_date >= ms && inv.issue_date <= me && inv.status !== 'void')
        .reduce((s, inv) => s + inv.total, 0)
      months.push({ month: format(d, 'MMM'), revenue: rev, expenses: 0 })
    }
    return months
  }, [invoices, now])

  // EOFY
  const eofyDate = getEOFYDate()
  const eofyDays = Math.max(0, differenceInDays(eofyDate, now))
  const eofyColor = eofyDays > 60 ? 'text-accent-green' : eofyDays > 30 ? 'text-accent-amber' : 'text-accent-red'

  // BAS
  const quarter = getCurrentQuarter()
  const basQuarterEnd = quarter.end
  const basDueDate = new Date(basQuarterEnd.getFullYear(), basQuarterEnd.getMonth() + 1, 28)
  const basDueDays = Math.max(0, differenceInDays(basDueDate, now))

  // Animated hero number
  const animatedRevenue = useAnimatedNumber(loading ? 0 : monthRevenue, 1200)

  // SVG ring for target
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(monthProgress, 100) / 100) * circumference
  const ringColor = monthProgress >= 100 ? '#00D47E' : monthProgress >= 60 ? '#FFB020' : '#6B8AFF'

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header — hidden on mobile (mobile topbar shows title) */}
      <div className="hidden items-center justify-between lg:flex">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Command Centre</h1>
          <p className="text-sm text-text-secondary">FY2025-26 · Jordan Lansbury</p>
        </div>
        {eofyDays <= 120 && (
          <Link
            href="/tax"
            className={`flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-xs font-semibold transition-colors hover:bg-bg-elevated ${eofyColor}`}
          >
            <CalendarClock className="h-4 w-4" />
            {eofyDays} days to EOFY
          </Link>
        )}
      </div>

      {/* ROW 1 — Monthly Target Hero */}
      <div className="rounded-xl border border-border-subtle bg-bg-secondary p-4 lg:p-6" data-stagger>
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-8">
          {/* Ring — smaller on mobile */}
          <div className="relative shrink-0">
            <svg width="120" height="120" viewBox="0 0 140 140" className="-rotate-90 lg:h-[140px] lg:w-[140px]">
              <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--color-bg-elevated)" strokeWidth="10" />
              <circle
                cx="70" cy="70" r={radius} fill="none" stroke={ringColor} strokeWidth="10"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={loading ? circumference : strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-financial text-lg font-bold text-text-primary">
                {Math.round(monthProgress)}%
              </span>
              <span className="text-[10px] text-text-tertiary">of target</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 text-center lg:text-left">
            <div className="mb-1 flex items-center justify-center gap-2 lg:justify-start">
              <Target className="h-4 w-4 text-accent-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                {format(now, 'MMMM yyyy')} Target
              </span>
            </div>
            <p className="font-financial text-2xl font-bold text-text-primary lg:text-3xl">
              {formatCurrency(animatedRevenue)}
            </p>
            <p className="mt-1 text-xs text-text-secondary lg:text-sm">
              of {formatCurrency(MONTHLY_TARGET)} target
              {monthProgress < 100 && daysLeft > 0 && (
                <span className="ml-1 text-text-tertiary lg:ml-2">
                  · {formatCurrency(dailyRunRate)}/day for {daysLeft}d
                </span>
              )}
              {monthProgress >= 100 && (
                <span className="ml-2 font-semibold text-accent-green">Target exceeded!</span>
              )}
            </p>
            {lastYearRevenue > 0 && (
              <p className="mt-1 text-[11px] text-text-tertiary lg:mt-2 lg:text-xs">
                Last year: {formatCurrency(lastYearRevenue)}
                {monthRevenue > lastYearRevenue
                  ? <span className="ml-1 text-accent-green">+{((monthRevenue / lastYearRevenue - 1) * 100).toFixed(0)}%</span>
                  : monthRevenue < lastYearRevenue
                    ? <span className="ml-1 text-accent-red">{((monthRevenue / lastYearRevenue - 1) * 100).toFixed(0)}%</span>
                    : null
                }
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-text-tertiary lg:mt-1 lg:text-xs">
              {thisMonthInvoices.length} invoice{thisMonthInvoices.length !== 1 ? 's' : ''} this month
            </p>
          </div>
        </div>
      </div>

      {/* ROW 2 — Metric Cards: 2×2 mobile, 4-across desktop */}
      <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        <MetricCard title="Revenue YTD" value={summary?.revenue ?? 0} icon={DollarSign} accent="green" loading={loading} index={0} />
        <MetricCard title="Net Profit YTD" value={summary?.netProfit ?? 0} icon={TrendingUp} accent="blue" loading={loading} index={1} />
        <MetricCard title="GST Position" value={summary?.netGST ?? 0} icon={Receipt} accent={(summary?.netGST ?? 0) > 0 ? 'red' : 'green'} loading={loading} index={2} />
        <MetricCard title="Est. Tax Liability" value={summary?.estimatedTax ?? 0} icon={Calculator} accent="amber" loading={loading} index={3} />
      </div>

      {/* ROW 3 — Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <div className="skeleton h-[340px] rounded-xl" />
            <div className="skeleton h-[340px] rounded-xl" />
          </>
        ) : (
          <>
            <RevenueExpenseChart data={monthlyData} />
            <RevenueForecast invoices={invoices} />
          </>
        )}
      </div>

      {/* Health Score + Rod Says */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HealthScore />
          <RodSays />
        </div>
      )}

      {/* ROW 4 — Action Items + EOFY */}
      <div className="grid grid-cols-1 gap-3 lg:gap-4 lg:grid-cols-2">
        {/* Needs Attention */}
        <div className="rounded-xl border border-border-subtle bg-bg-secondary p-4 lg:p-5">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Needs Attention</h3>
          <div className="space-y-2">
            {thisMonthInvoices.length === 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-surface-amber px-3 py-2.5 text-xs text-accent-amber">
                <Target className="h-4 w-4 shrink-0" />
                No invoices this month — are you tracking?
              </div>
            )}
            {basDueDays <= 30 && (
              <Link href="/gst" className="flex items-center justify-between rounded-lg bg-surface-blue px-3 py-2.5 text-xs text-accent-primary hover:brightness-110">
                <div className="flex items-center gap-3">
                  <Receipt className="h-4 w-4 shrink-0" />
                  BAS Q3 due {format(basDueDate, 'd MMMM')} ({basDueDays} days)
                </div>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {eofyDays <= 120 && (
              <Link href="/tax" className="flex items-center justify-between rounded-lg bg-surface-amber px-3 py-2.5 text-xs text-accent-amber hover:brightness-110">
                <div className="flex items-center gap-3">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  EOFY in {eofyDays} days — review tax position
                </div>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {(summary?.uncategorisedCount ?? 0) > 0 && (
              <Link href="/transactions" className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2.5 text-xs text-text-secondary hover:text-text-primary">
                <span>{summary?.uncategorisedCount} uncategorised transactions</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {thisMonthInvoices.length > 0 && basDueDays > 30 && eofyDays > 120 && (summary?.uncategorisedCount ?? 0) === 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-surface-green px-3 py-2.5 text-xs text-accent-green">
                All good — nothing needs immediate attention.
              </div>
            )}
          </div>
        </div>

        {/* EOFY Countdown */}
        {eofyDays <= 120 && (
          <div className="rounded-xl border border-border-subtle bg-bg-secondary p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">EOFY 2025-26</h3>
            <div className="mb-4 flex items-baseline gap-3">
              <span className={`font-financial text-4xl font-bold ${eofyColor}`}>{eofyDays}</span>
              <span className="text-sm text-text-tertiary">days remaining</span>
            </div>
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-xs text-text-tertiary">
                <span>FY Progress</span>
                <span>{Math.round(((365 - eofyDays) / 365) * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                <div
                  className="h-full rounded-full bg-accent-primary transition-all duration-700"
                  style={{ width: `${((365 - eofyDays) / 365) * 100}%` }}
                />
              </div>
            </div>
            {summary && (
              <p className="mb-4 text-xs text-text-secondary">
                Estimated tax: <span className="font-financial font-semibold text-text-primary">{formatCurrency(summary.estimatedTax)}</span>
              </p>
            )}
            <div className="flex gap-2">
              <Link href="/deductions" className="btn-press flex-1 rounded-lg border border-border-subtle px-3 py-2 text-center text-xs font-medium text-text-secondary hover:bg-bg-elevated">
                Review Deductions
              </Link>
              <Link href="/tax" className="btn-press flex-1 rounded-lg bg-accent-primary px-3 py-2 text-center text-xs font-semibold text-white hover:brightness-110">
                Tax Position
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ROW 5 — Recent Invoices */}
      <RecentInvoices invoices={invoices} />
    </div>
  )
}
