'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { MetricCard } from '@/components/ui/metric-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Receipt, TrendingUp, TrendingDown, Fuel, AlertTriangle, CheckCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { BASPeriod, Transaction } from '@/types/database'

export default function GSTPage() {
  const [basPeriods, setBASPeriods] = useState<BASPeriod[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<BASPeriod | null>(null)
  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [gstCollected, setGstCollected] = useState(0)
  const [gstCredits, setGstCredits] = useState(0)
  const [fuelTaxCredits, setFuelTaxCredits] = useState(0)
  const [validationIssues, setValidationIssues] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: periods } = await supabase
      .from('bas_periods')
      .select('*')
      .order('start_date', { ascending: false })
    const allPeriods = (periods as BASPeriod[]) || []
    setBASPeriods(allPeriods)

    // Select current open period
    const openPeriod = allPeriods.find((p) => p.status === 'open')
    if (openPeriod) {
      setSelectedPeriod(openPeriod)
      await loadPeriodData(openPeriod)
    }
    setLoading(false)
  }

  async function loadPeriodData(period: BASPeriod) {
    const { data: txns } = await supabase
      .from('transactions')
      .select('*, account:accounts(*)')
      .gte('date', period.start_date)
      .lte('date', period.end_date)
      .eq('is_personal', false)
      .order('date', { ascending: false })

    const transactions = (txns as Transaction[]) || []
    setPeriodTransactions(transactions)

    // Calculate GST position
    let collected = 0
    let credits = 0
    let fuelTotal = 0
    const issues: string[] = []

    const uncategorised = transactions.filter((t) => !t.account_id)
    if (uncategorised.length > 0) {
      issues.push(`${uncategorised.length} transactions are uncategorised — categorise before finalising`)
    }

    for (const t of transactions) {
      if (!t.account) continue
      const gst = Math.abs(t.gst_amount ?? 0)
      const bizPct = (t.business_use_pct ?? 100) / 100

      if (t.account.type === 'income') {
        collected += gst
      } else if (t.account.type === 'expense') {
        credits += gst * bizPct

        // Track fuel for FTC
        if (t.account.code === '6-1010') {
          fuelTotal += Math.abs(t.amount) * bizPct
        }

        // Validation: GST claimed on GST-Free items
        if (t.account.tax_code === 'GST-Free' && gst > 0) {
          issues.push(`GST claimed on "${t.description}" which is marked GST-Free — review`)
        }
      }
    }

    // Estimate fuel tax credits (light vehicle rate ~18.8c/litre, avg fuel price ~$1.85/litre)
    const estimatedLitres = fuelTotal / 1.85
    const ftc = estimatedLitres * 0.188

    setGstCollected(collected)
    setGstCredits(credits)
    setFuelTaxCredits(Math.round(ftc * 100) / 100)
    setValidationIssues(issues)
  }

  const netGST = gstCollected - gstCredits - fuelTaxCredits

  // Chart data for quarterly comparison — handle null gst_collected for FY2024-25
  const chartData = basPeriods.map((p) => ({
    period: p.period_label.split(' ')[0],
    collected: p.gst_collected ?? 0,
    credits: p.gst_credits ?? 0,
    net: (p.gst_collected ?? 0) - (p.gst_credits ?? 0),
  })).reverse()

  const basStatusVariant = (status: string) => {
    switch (status) {
      case 'open': return 'info' as const
      case 'prepared': return 'warning' as const
      case 'lodged': return 'success' as const
      case 'paid': return 'success' as const
      default: return 'neutral' as const
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">GST / BAS Tracker</h1>
        <p className="text-sm text-text-secondary">Manage your Business Activity Statements</p>
      </div>

      {/* GST Position Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="GST Collected (1A)"
          value={gstCollected}
          icon={TrendingUp}
          accent="red"
          loading={loading}
        />
        <MetricCard
          title="GST Credits (1B)"
          value={gstCredits}
          icon={TrendingDown}
          accent="green"
          loading={loading}
        />
        <MetricCard
          title="Fuel Tax Credits"
          value={fuelTaxCredits}
          icon={Fuel}
          accent="blue"
          loading={loading}
        />
        <MetricCard
          title="Net GST Position"
          value={netGST}
          icon={Receipt}
          accent={netGST > 0 ? 'red' : 'green'}
          loading={loading}
        />
      </div>

      {/* Period Selector & BAS Worksheet */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* BAS Periods List */}
        <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">BAS Periods</h3>
          <div className="space-y-2">
            {basPeriods.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedPeriod(p); loadPeriodData(p) }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  selectedPeriod?.id === p.id
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-secondary hover:bg-bg-elevated'
                )}
              >
                <span>{p.period_label}</span>
                <StatusBadge label={p.status} variant={basStatusVariant(p.status)} size="sm" />
              </button>
            ))}
          </div>
        </div>

        {/* BAS Worksheet */}
        <div className="col-span-2 rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            BAS Worksheet — {selectedPeriod?.period_label || 'Select a period'}
          </h3>

          {selectedPeriod && (
            <div className="space-y-3">
              {/* BAS Line Items */}
              <div className="rounded-lg bg-bg-primary p-4">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-border-subtle/50">
                      <td className="py-2 text-text-secondary">G1 — Total sales (inc GST)</td>
                      <td className="py-2 text-right font-financial font-medium text-text-primary">
                        {formatCurrency(periodTransactions.filter((t) => t.account?.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0))}
                      </td>
                    </tr>
                    <tr className="border-b border-border-subtle/50">
                      <td className="py-2 text-text-secondary">1A — GST on sales</td>
                      <td className="py-2 text-right font-financial font-medium text-accent-red">{formatCurrency(gstCollected)}</td>
                    </tr>
                    <tr className="border-b border-border-subtle/50">
                      <td className="py-2 text-text-secondary">1B — GST on purchases</td>
                      <td className="py-2 text-right font-financial font-medium text-accent-green">{formatCurrency(gstCredits)}</td>
                    </tr>
                    <tr className="border-b border-border-subtle/50">
                      <td className="py-2 text-text-secondary">7C — Fuel Tax Credits</td>
                      <td className="py-2 text-right font-financial font-medium text-accent-blue">{formatCurrency(fuelTaxCredits)}</td>
                    </tr>
                    <tr className="border-t-2 border-border-subtle">
                      <td className="py-3 font-semibold text-text-primary">Net Amount {netGST > 0 ? 'Owing' : 'Refundable'}</td>
                      <td className={cn('py-3 text-right font-financial text-lg font-bold', netGST > 0 ? 'text-accent-red' : 'text-accent-green')}>
                        {formatCurrency(Math.abs(netGST))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Validation Issues */}
              {validationIssues.length > 0 && (
                <div className="rounded-lg border border-accent-amber/20 bg-surface-amber p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-accent-amber">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Validation Issues ({validationIssues.length})
                  </p>
                  {validationIssues.map((issue, i) => (
                    <p key={i} className="text-xs text-accent-amber/80">• {issue}</p>
                  ))}
                </div>
              )}

              {validationIssues.length === 0 && periodTransactions.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-accent-green/20 bg-surface-green p-3 text-xs text-accent-green">
                  <CheckCircle className="h-3.5 w-3.5" />
                  All transactions categorised. Ready to prepare BAS.
                </div>
              )}

              {/* Period Transactions */}
              <div>
                <p className="mb-2 text-xs font-medium text-text-tertiary">
                  {periodTransactions.length} transactions in period
                </p>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border-subtle">
                  {periodTransactions.slice(0, 20).map((t) => (
                    <div key={t.id} className="flex items-center justify-between border-b border-border-subtle/50 px-3 py-2 text-xs last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-financial text-text-tertiary">{formatDate(t.date)}</span>
                        <span className="text-text-primary">{t.description}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-text-tertiary">{t.account?.name || 'Uncategorised'}</span>
                        <span className={cn('font-financial', t.amount > 0 ? 'text-accent-green' : 'text-text-primary')}>
                          {formatCurrency(t.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quarterly Comparison Chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Quarterly GST Comparison</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-border-subtle)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '12px' }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Bar dataKey="collected" name="Collected" fill="var(--color-accent-red)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="credits" name="Credits" fill="var(--color-accent-green)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
