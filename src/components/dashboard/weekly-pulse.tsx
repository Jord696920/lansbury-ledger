'use client'

import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Zap, TrendingUp, TrendingDown, Minus, FileText, CalendarClock, Receipt, AlertTriangle } from 'lucide-react'
import { subDays, format } from 'date-fns'
import type { Invoice } from '@/types/database'

interface WeeklyPulseProps {
  invoices: Invoice[]
  monthRevenue: number
  monthTarget: number
  lastYearRevenue: number
  daysLeft: number
  basDueDays: number
  basDueDate: Date
  eofyDays: number
  uncategorisedCount: number
}

export function WeeklyPulse({
  invoices,
  monthRevenue,
  monthTarget,
  lastYearRevenue,
  daysLeft,
  basDueDays,
  basDueDate,
  eofyDays,
  uncategorisedCount,
}: WeeklyPulseProps) {
  const now = new Date()
  const weekAgo = subDays(now, 7).toISOString().split('T')[0]
  const todayStr = now.toISOString().split('T')[0]

  const weekInvoices = useMemo(
    () => invoices.filter((inv) => inv.issue_date >= weekAgo && inv.issue_date <= todayStr && inv.status !== 'void'),
    [invoices, weekAgo, todayStr]
  )
  const weekRevenue = weekInvoices.reduce((s, inv) => s + inv.total, 0)

  // YoY comparison
  const yoyPct = lastYearRevenue > 0 ? ((monthRevenue / lastYearRevenue - 1) * 100) : null
  const yoyUp = yoyPct !== null && yoyPct > 0
  const yoyDown = yoyPct !== null && yoyPct < 0

  // Next action — pick the most urgent
  const nextAction = useMemo(() => {
    if (basDueDays <= 14)
      return { icon: Receipt, text: `BAS due ${format(basDueDate, 'd MMM')} — ${basDueDays}d`, color: 'text-accent-red' }
    if (eofyDays <= 30)
      return { icon: CalendarClock, text: `EOFY in ${eofyDays} days — review tax position`, color: 'text-accent-red' }
    if (basDueDays <= 30)
      return { icon: Receipt, text: `BAS due ${format(basDueDate, 'd MMM')} — ${basDueDays}d`, color: 'text-accent-amber' }
    if (uncategorisedCount > 0)
      return { icon: AlertTriangle, text: `${uncategorisedCount} uncategorised transactions`, color: 'text-accent-amber' }
    if (eofyDays <= 90)
      return { icon: CalendarClock, text: `${eofyDays} days to EOFY — start planning`, color: 'text-accent-amber' }
    if (monthRevenue < monthTarget && daysLeft > 0) {
      const needed = formatCurrency(Math.max(0, monthTarget - monthRevenue))
      return { icon: TrendingUp, text: `${needed} to hit target — ${daysLeft}d left`, color: 'text-text-secondary' }
    }
    return { icon: Zap, text: 'All clear — keep the momentum going', color: 'text-accent-green' }
  }, [basDueDays, basDueDate, eofyDays, uncategorisedCount, monthRevenue, monthTarget, daysLeft])

  const ActionIcon = nextAction.icon

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm overflow-hidden">
      <div className="flex">
        {/* Navy left accent */}
        <div className="w-1 shrink-0 bg-[#1e3a5f]" />

        <div className="flex-1 px-4 py-3 lg:px-5 lg:py-4">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-accent-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Weekly Pulse</span>
          </div>

          <div className="space-y-1.5 text-xs">
            {/* Line 1: This week's invoices */}
            <div className="flex items-center gap-2 text-text-secondary">
              <FileText className="h-3 w-3 shrink-0 text-text-tertiary" />
              <span>
                <span className="font-semibold text-text-primary">{weekInvoices.length}</span> invoice{weekInvoices.length !== 1 ? 's' : ''} this week
                {weekRevenue > 0 && <span className="text-text-tertiary"> · {formatCurrency(weekRevenue)}</span>}
              </span>
            </div>

            {/* Line 2: Month progress */}
            <div className="flex items-center gap-2 text-text-secondary">
              <TrendingUp className="h-3 w-3 shrink-0 text-text-tertiary" />
              <span>
                {formatCurrency(monthRevenue)} of {formatCurrency(monthTarget)}
                <span className="ml-1 text-text-tertiary">
                  ({Math.round((monthRevenue / monthTarget) * 100)}%)
                </span>
                {monthRevenue >= monthTarget && <span className="ml-1 font-semibold text-accent-green">Hit!</span>}
              </span>
            </div>

            {/* Line 3: YoY */}
            <div className="flex items-center gap-2 text-text-secondary">
              {yoyUp ? <TrendingUp className="h-3 w-3 shrink-0 text-accent-green" /> :
               yoyDown ? <TrendingDown className="h-3 w-3 shrink-0 text-accent-red" /> :
               <Minus className="h-3 w-3 shrink-0 text-text-tertiary" />}
              <span>
                {yoyPct !== null ? (
                  <>
                    <span className={yoyUp ? 'font-semibold text-accent-green' : yoyDown ? 'font-semibold text-accent-red' : ''}>
                      {yoyUp ? '+' : ''}{yoyPct.toFixed(0)}%
                    </span>
                    {' vs same month last year'}
                  </>
                ) : (
                  'No prior year data for comparison'
                )}
              </span>
            </div>

            {/* Line 4: Next action */}
            <div className={`flex items-center gap-2 font-medium ${nextAction.color}`}>
              <ActionIcon className="h-3 w-3 shrink-0" />
              <span>{nextAction.text}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
