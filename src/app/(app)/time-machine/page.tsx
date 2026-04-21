'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { calculateIncomeTax, calculateSBITO } from '@/lib/queries'
import { MEDICARE_LEVY_RATE } from '@/lib/constants'
import { Clock, ArrowRight, TrendingUp, TrendingDown, Equal } from 'lucide-react'
import type { Invoice, BASPeriod, HistoricalPeriod } from '@/types/database'

export default function TimeMachinePage() {
  const [loading, setLoading] = useState(true)
  const [currentInvoices, setCurrentInvoices] = useState<Invoice[]>([])
  const [currentBAS, setCurrentBAS] = useState<BASPeriod[]>([])
  const [historicalAnnual, setHistoricalAnnual] = useState<HistoricalPeriod | null>(null)
  const [scenarioExpenses, setScenarioExpenses] = useState(0)

  useEffect(() => {
    async function load() {
      const [{ data: inv }, { data: bas }, { data: hist }] = await Promise.all([
        supabase.from('invoices').select('*').neq('status', 'void'),
        supabase.from('bas_periods').select('*').order('start_date', { ascending: true }),
        supabase
          .from('historical_periods')
          .select('*')
          .eq('financial_year', '2024-25')
          .eq('period_type', 'annual')
          .maybeSingle(),
      ])
      setCurrentInvoices(inv ?? [])
      setCurrentBAS(bas ?? [])
      setHistoricalAnnual((hist as HistoricalPeriod | null) ?? null)
      setLoading(false)
    }
    load()
  }, [])

  // FY2025-26 current figures (from invoices)
  const fy2526Revenue = useMemo(() => {
    return currentInvoices
      .filter((inv) => inv.issue_date >= '2025-07-01' && inv.issue_date <= '2026-06-30')
      .reduce((s, inv) => s + inv.total, 0)
  }, [currentInvoices])

  // FY2025-26 expenses estimated from BAS credits
  const fy2526Expenses = useMemo(() => {
    return currentBAS
      .filter((p) => p.start_date >= '2025-07-01' && (p.status === 'lodged' || p.status === 'paid'))
      .reduce((s, p) => s + (p.gst_credits ?? 0) * 11, 0)
  }, [currentBAS])

  // FY2024-25 — certified figures from historical_periods.
  // Stage 3 cuts took effect 1 Jul 2024, so FY24-25 and FY25-26 share the
  // same bracket table (0/16/30/37/45). Both years use calculateIncomeTax.
  const fy2425Revenue = historicalAnnual?.income ?? 0
  const fy2425Deductions = historicalAnnual?.expenses ?? 0
  const fy2425Taxable = Math.max(0, fy2425Revenue - fy2425Deductions)
  const fy2425Tax = calculateIncomeTax(fy2425Taxable)
  const fy2425Medicare = fy2425Taxable * MEDICARE_LEVY_RATE
  const fy2425Sbito = calculateSBITO(fy2425Tax)
  const fy2425NetTax = fy2425Tax + fy2425Medicare - fy2425Sbito
  const fy2425TakeHome = fy2425Revenue - fy2425Deductions - fy2425NetTax

  // FY2025-26 projections (annualized from YTD)
  const now = new Date()
  const fyStart = new Date(2025, 6, 1)
  const monthsElapsed = Math.max(1, (now.getFullYear() - fyStart.getFullYear()) * 12 + (now.getMonth() - fyStart.getMonth()) + 1)
  const projectedRevenue = (fy2526Revenue / monthsElapsed) * 12
  const projectedExpenses = fy2526Expenses > 0 ? (fy2526Expenses / monthsElapsed) * 12 : fy2425Deductions // fallback
  const projectedTaxable = Math.max(0, projectedRevenue - projectedExpenses - scenarioExpenses)
  const projectedTax = calculateIncomeTax(projectedTaxable)
  const projectedMedicare = projectedTaxable * MEDICARE_LEVY_RATE
  const projectedSbito = calculateSBITO(projectedTax)
  const projectedNetTax = projectedTax + projectedMedicare - projectedSbito
  const projectedTakeHome = projectedRevenue - projectedExpenses - scenarioExpenses - projectedNetTax

  // Comparisons
  const revDiff = projectedRevenue - fy2425Revenue
  const taxDiff = projectedNetTax - fy2425NetTax
  const takeHomeDiff = projectedTakeHome - fy2425TakeHome

  function DiffBadge({ value, flip }: { value: number; flip?: boolean }) {
    const positive = flip ? value < 0 : value > 0
    const color = positive ? 'text-accent-green' : value === 0 ? 'text-text-tertiary' : 'text-accent-red'
    const Icon = positive ? TrendingUp : value === 0 ? Equal : TrendingDown
    return (
      <span className={cn('flex items-center gap-1 font-financial text-xs font-semibold', color)}>
        <Icon className="h-3 w-3" />
        {value > 0 ? '+' : ''}{formatCurrency(value)}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-64 rounded-lg" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-accent-purple" />
          <h1 className="text-2xl font-bold text-text-primary">Time Machine</h1>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          Compare FY2024-25 (certified) with FY2025-26 (projected) — see how your year is tracking
        </p>
      </div>

      {/* Side-by-side comparison */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="py-3 text-left text-xs font-semibold text-text-tertiary"></th>
              <th className="py-3 text-right text-xs font-semibold text-text-tertiary">FY2024-25</th>
              <th className="py-3 text-center text-text-tertiary"><ArrowRight className="mx-auto h-3 w-3" /></th>
              <th className="py-3 text-right text-xs font-semibold text-accent-primary">FY2025-26 (proj.)</th>
              <th className="py-3 text-right text-xs font-semibold text-text-tertiary">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            <tr>
              <td className="py-2.5 text-text-secondary">Gross Revenue</td>
              <td className="py-2.5 text-right font-financial text-text-primary">{formatCurrency(fy2425Revenue)}</td>
              <td></td>
              <td className="py-2.5 text-right font-financial font-semibold text-text-primary">{formatCurrency(projectedRevenue)}</td>
              <td className="py-2.5 text-right"><DiffBadge value={revDiff} /></td>
            </tr>
            <tr>
              <td className="py-2.5 text-text-secondary">Deductions</td>
              <td className="py-2.5 text-right font-financial text-text-primary">{formatCurrency(fy2425Deductions)}</td>
              <td></td>
              <td className="py-2.5 text-right font-financial text-text-primary">{formatCurrency(projectedExpenses + scenarioExpenses)}</td>
              <td className="py-2.5 text-right"><DiffBadge value={(projectedExpenses + scenarioExpenses) - fy2425Deductions} flip /></td>
            </tr>
            <tr>
              <td className="py-2.5 font-medium text-text-primary">Taxable Income</td>
              <td className="py-2.5 text-right font-financial font-semibold text-text-primary">{formatCurrency(fy2425Taxable)}</td>
              <td></td>
              <td className="py-2.5 text-right font-financial font-semibold text-accent-primary">{formatCurrency(projectedTaxable)}</td>
              <td></td>
            </tr>
            <tr>
              <td className="py-2.5 text-text-secondary">Income Tax</td>
              <td className="py-2.5 text-right font-financial text-text-primary">{formatCurrency(fy2425Tax)}</td>
              <td></td>
              <td className="py-2.5 text-right font-financial text-text-primary">{formatCurrency(projectedTax)}</td>
              <td></td>
            </tr>
            <tr>
              <td className="py-2.5 text-text-secondary">+ Medicare (2%)</td>
              <td className="py-2.5 text-right font-financial text-text-primary">{formatCurrency(fy2425Medicare)}</td>
              <td></td>
              <td className="py-2.5 text-right font-financial text-text-primary">{formatCurrency(projectedMedicare)}</td>
              <td></td>
            </tr>
            <tr>
              <td className="py-2.5 text-accent-green">- SBITO</td>
              <td className="py-2.5 text-right font-financial text-accent-green">-{formatCurrency(fy2425Sbito)}</td>
              <td></td>
              <td className="py-2.5 text-right font-financial text-accent-green">-{formatCurrency(projectedSbito)}</td>
              <td></td>
            </tr>
            <tr className="border-t-2 border-border-subtle">
              <td className="py-2.5 font-semibold text-accent-red">Net Tax Payable</td>
              <td className="py-2.5 text-right font-financial font-bold text-accent-red">{formatCurrency(fy2425NetTax)}</td>
              <td></td>
              <td className="py-2.5 text-right font-financial font-bold text-accent-red">{formatCurrency(projectedNetTax)}</td>
              <td className="py-2.5 text-right"><DiffBadge value={taxDiff} flip /></td>
            </tr>
            <tr>
              <td className="py-2.5 font-semibold text-accent-green">Take-Home</td>
              <td className="py-2.5 text-right font-financial font-bold text-accent-green">{formatCurrency(fy2425TakeHome)}</td>
              <td></td>
              <td className="py-2.5 text-right font-financial font-bold text-accent-green">{formatCurrency(projectedTakeHome)}</td>
              <td className="py-2.5 text-right"><DiffBadge value={takeHomeDiff} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* What-If overlay */}
      <div className="rounded-2xl border border-border-subtle bg-surface-purple p-5">
        <h3 className="mb-1 text-sm font-semibold text-text-primary">
          <Clock className="mb-0.5 mr-1.5 inline h-4 w-4 text-accent-purple" />
          What If — Time Machine Scenarios
        </h3>
        <p className="mb-4 text-[11px] text-text-tertiary">
          What if you had additional deductions this year? See how it changes the comparison.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Buy a $15K car for the business', value: 15000 },
            { label: 'Max super top-up ($30K)', value: 30000 },
            { label: 'Prepay 12mo expenses ($5K)', value: 5000 },
          ].map((scenario) => (
            <button
              key={scenario.label}
              onClick={() => setScenarioExpenses((prev) => prev === scenario.value ? 0 : scenario.value)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left text-xs transition-all',
                scenarioExpenses === scenario.value
                  ? 'border-accent-purple bg-accent-purple/10 text-accent-purple'
                  : 'border-border-subtle text-text-secondary hover:bg-bg-elevated'
              )}
            >
              <p className="font-medium">{scenario.label}</p>
              <p className="mt-0.5 font-financial text-text-tertiary">
                Saves ~{formatCurrency(scenario.value * 0.30)} in tax
              </p>
            </button>
          ))}
        </div>

        {scenarioExpenses > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="font-financial text-xs text-text-tertiary">Active scenario adds {formatCurrency(scenarioExpenses)} in deductions</span>
            <button
              onClick={() => setScenarioExpenses(0)}
              className="rounded bg-bg-elevated px-2 py-0.5 text-[10px] text-text-secondary hover:text-text-primary"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Key insight */}
      <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
        <h3 className="mb-2 text-sm font-semibold text-text-primary">Key Insight</h3>
        <p className="text-sm text-text-secondary">
          {revDiff > 0 ? (
            <>
              Revenue is tracking <span className="font-financial font-semibold text-accent-green">{formatCurrency(revDiff)} higher</span> than
              last year. {taxDiff > 0
                ? <>But tax will also be <span className="font-financial font-semibold text-accent-red">{formatCurrency(taxDiff)} more</span> — consider maximising deductions before June 30.</>
                : <>And thanks to the new FY2025-26 brackets, your tax position has improved.</>
              }
            </>
          ) : revDiff < 0 ? (
            <>
              Revenue is tracking <span className="font-financial font-semibold text-accent-amber">{formatCurrency(Math.abs(revDiff))} lower</span> than
              last year with {12 - monthsElapsed} months remaining. You need <span className="font-financial">{formatCurrency((fy2425Revenue - fy2526Revenue) / Math.max(1, 12 - monthsElapsed))}/month</span> to match last year.
            </>
          ) : (
            <>Revenue is tracking exactly in line with last year.</>
          )}
        </p>
        <p className="mt-2 text-[10px] text-text-tertiary">
          FY2024-25 figures are certified from lodged BAS. FY2025-26 is projected from {monthsElapsed} month{monthsElapsed !== 1 ? 's' : ''} of data (annualized).
        </p>
      </div>
    </div>
  )
}
