'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart3, FileText, DollarSign, Download, TrendingUp, TrendingDown,
  ChevronDown, Share2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { cn, formatCurrency, getCurrentFY } from '@/lib/utils'
import { CHART, PALETTE } from '@/lib/constants'
import {
  getHistoricalPeriods, getHistoricalExpenseCategories,
  getInvoices, getTransactions,
} from '@/lib/queries'
import type { HistoricalPeriod, HistoricalExpenseCategory, Invoice, Transaction } from '@/types/database'
import { format, startOfMonth, endOfMonth } from 'date-fns'

const AVAILABLE_FYS = ['FY2024-25', 'FY2025-26'] as const
type FY = (typeof AVAILABLE_FYS)[number]

function deriveLiveMonthly(invoices: Invoice[], transactions: Transaction[]) {
  const months: { label: string; income: number; expenses: number; netProfit: number }[] = []
  for (let m = 0; m < 12; m++) {
    const d = new Date(2025, 6 + m, 1)
    const ms = startOfMonth(d).toISOString().split('T')[0]
    const me = endOfMonth(d).toISOString().split('T')[0]
    const label = format(d, 'MMM yyyy')
    const income = invoices
      .filter((inv) => inv.issue_date >= ms && inv.issue_date <= me && inv.status !== 'void')
      .reduce((s, inv) => s + inv.total, 0)
    const expenses = transactions
      .filter((t) => !t.is_personal && t.date >= ms && t.date <= me)
      .reduce((s, t) => s + Math.abs(t.amount), 0)
    months.push({ label, income, expenses, netProfit: income - expenses })
  }
  return months
}

function deriveLiveCategories(transactions: Transaction[]) {
  const catMap = new Map<string, number>()
  for (const t of transactions) {
    if (t.is_personal) continue
    const name = t.account?.name ?? 'Uncategorised'
    catMap.set(name, (catMap.get(name) ?? 0) + Math.abs(t.amount))
  }
  return Array.from(catMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export default function ReportsPage() {
  const currentFY = getCurrentFY() as FY
  const [selectedFY, setSelectedFY] = useState<FY>(currentFY === 'FY2025-26' ? 'FY2025-26' : 'FY2024-25')
  const [loading, setLoading] = useState(true)

  const [historicalMonthly, setHistoricalMonthly] = useState<HistoricalPeriod[]>([])
  const [historicalAnnual, setHistoricalAnnual] = useState<HistoricalPeriod | null>(null)
  const [historicalCategories, setHistoricalCategories] = useState<HistoricalExpenseCategory[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [comparisonMonthly, setComparisonMonthly] = useState<HistoricalPeriod[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        if (selectedFY === 'FY2024-25') {
          const [monthly, annual, cats] = await Promise.all([
            getHistoricalPeriods('FY2024-25', 'monthly'),
            getHistoricalPeriods('FY2024-25', 'annual'),
            getHistoricalExpenseCategories('FY2024-25'),
          ])
          setHistoricalMonthly(monthly)
          setHistoricalAnnual(annual[0] ?? null)
          setHistoricalCategories(cats)
        } else {
          const [inv, txn, compMonthly] = await Promise.all([
            getInvoices(),
            getTransactions({ startDate: '2025-07-01', endDate: '2026-06-30' }),
            getHistoricalPeriods('FY2024-25', 'monthly'),
          ])
          setInvoices(inv.filter((i) => i.issue_date >= '2025-07-01' && i.issue_date <= '2026-06-30'))
          setTransactions(txn)
          setComparisonMonthly(compMonthly)
        }
        if (selectedFY === 'FY2024-25') {
          const inv = await getInvoices()
          setInvoices(inv.filter((i) => i.issue_date >= '2025-07-01' && i.issue_date <= '2026-06-30'))
          const txn = await getTransactions({ startDate: '2025-07-01', endDate: '2026-06-30' })
          setTransactions(txn)
        }
      } catch (err) {
        console.error('Reports load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedFY])

  const monthlyData = useMemo(() => {
    if (selectedFY === 'FY2024-25') {
      return historicalMonthly.map((p) => ({
        month: format(new Date(p.start_date + 'T00:00:00'), 'MMM'),
        income: Number(p.income),
        expenses: Number(p.expenses),
        netProfit: Number(p.net_profit),
      }))
    }
    return deriveLiveMonthly(invoices, transactions).map((m) => ({
      month: m.label.split(' ')[0],
      income: m.income,
      expenses: m.expenses,
      netProfit: m.netProfit,
    }))
  }, [selectedFY, historicalMonthly, invoices, transactions])

  const totals = useMemo(() => {
    if (selectedFY === 'FY2024-25' && historicalAnnual) {
      return {
        income: Number(historicalAnnual.income),
        expenses: Number(historicalAnnual.expenses),
        netProfit: Number(historicalAnnual.net_profit),
      }
    }
    return monthlyData.reduce(
      (acc, m) => ({ income: acc.income + m.income, expenses: acc.expenses + m.expenses, netProfit: acc.netProfit + m.netProfit }),
      { income: 0, expenses: 0, netProfit: 0 }
    )
  }, [selectedFY, historicalAnnual, monthlyData])

  const categoryData = useMemo(() => {
    if (selectedFY === 'FY2024-25') {
      return historicalCategories.map((c) => ({ name: c.category, value: Number(c.amount) }))
    }
    return deriveLiveCategories(transactions).map((c) => ({ name: c.category, value: c.amount }))
  }, [selectedFY, historicalCategories, transactions])

  const donutData = useMemo(() => {
    const sorted = [...categoryData].sort((a, b) => b.value - a.value)
    const top8 = sorted.slice(0, 8)
    const otherTotal = sorted.slice(8).reduce((sum, d) => sum + d.value, 0)
    return otherTotal > 0 ? [...top8, { name: 'Other', value: otherTotal }] : top8
  }, [categoryData])

  const yoyData = useMemo(() => {
    const monthLabels = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const lastYearMonthly = selectedFY === 'FY2025-26' ? comparisonMonthly : historicalMonthly
    const thisYearMonthly = selectedFY === 'FY2025-26'
      ? deriveLiveMonthly(invoices, transactions)
      : historicalMonthly

    return monthLabels.map((label, i) => {
      const ly = lastYearMonthly[i]
      const ty = selectedFY === 'FY2025-26' ? thisYearMonthly[i] : null
      return {
        month: label,
        'FY2024-25': ly ? Number(ly.income) : 0,
        'FY2025-26': ty ? ty.income : 0,
      }
    })
  }, [selectedFY, historicalMonthly, comparisonMonthly, invoices, transactions])

  const exportCSV = useCallback(() => {
    const rows = [['Month', 'Income', 'Expenses', 'Net Profit']]
    for (const m of monthlyData) {
      rows.push([m.month, m.income.toFixed(2), m.expenses.toFixed(2), m.netProfit.toFixed(2)])
    }
    rows.push(['TOTAL', totals.income.toFixed(2), totals.expenses.toFixed(2), totals.netProfit.toFixed(2)])
    rows.push([])
    rows.push(['Category', 'Amount'])
    for (const c of categoryData) {
      rows.push([c.name, c.value.toFixed(2)])
    }
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `PnL_${selectedFY}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [monthlyData, categoryData, totals, selectedFY])

  const generatePDFBlob = useCallback(async (): Promise<Blob> => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text(`Profit & Loss — ${selectedFY}`, 14, 22)
    doc.setFontSize(10)
    doc.text('Jordan Lansbury — ABN 18 650 448 336', 14, 30)
    doc.text(selectedFY === 'FY2024-25' ? 'Source: Kennedy McLaughlin (Certified)' : 'Source: Live data', 14, 36)

    doc.setFontSize(12)
    doc.text('Summary', 14, 48)
    autoTable(doc, {
      startY: 52,
      head: [['', 'Amount']],
      body: [
        ['Total Income', `$${totals.income.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`],
        ['Total Expenses', `$${totals.expenses.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`],
        ['Net Profit', `$${totals.netProfit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`],
      ],
      theme: 'striped',
    })

    const finalY1 = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY as number) ?? 80
    doc.text('Monthly Breakdown', 14, finalY1 + 10)
    autoTable(doc, {
      startY: finalY1 + 14,
      head: [['Month', 'Income', 'Expenses', 'Net Profit']],
      body: monthlyData.map((m) => [
        m.month,
        `$${m.income.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
        `$${m.expenses.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
        `$${m.netProfit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
      ]),
      theme: 'striped',
    })

    doc.addPage()
    doc.setFontSize(12)
    doc.text('Expense Categories', 14, 22)
    autoTable(doc, {
      startY: 26,
      head: [['Category', 'Amount', '% of Total']],
      body: categoryData.map((c) => [
        c.name,
        `$${c.value.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
        `${((c.value / totals.expenses) * 100).toFixed(1)}%`,
      ]),
      theme: 'striped',
    })

    return doc.output('blob')
  }, [monthlyData, categoryData, totals, selectedFY])

  const exportPDF = useCallback(async () => {
    const blob = await generatePDFBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `PnL_${selectedFY}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }, [generatePDFBlob, selectedFY])

  const sharePDF = useCallback(async () => {
    const blob = await generatePDFBlob()
    const filename = `Rod-PnL-${selectedFY}-${new Date().toISOString().split('T')[0]}.pdf`
    const file = new File([blob], filename, { type: 'application/pdf' })

    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: `P&L — ${selectedFY}`,
        text: `Profit & Loss report from Rod the Accountant`,
        files: [file],
      })
    } else {
      // Fallback: download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [generatePDFBlob, selectedFY])

  const profitMargin = totals.income > 0 ? (totals.netProfit / totals.income) * 100 : 0

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header — FY pill tabs (mobile-first: one-tap, no dropdown) */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary lg:text-2xl">Reports</h1>
            <p className="text-[11px] text-text-tertiary lg:text-sm lg:text-text-secondary">
              {selectedFY === 'FY2024-25' ? 'Certified — Kennedy McLaughlin' : 'Live data'}
            </p>
          </div>
          {/* Desktop export buttons */}
          <div className="hidden items-center gap-2 sm:flex">
            <button
              onClick={sharePDF}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-accent-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button
              onClick={exportCSV}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              onClick={exportPDF}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>

        {/* FY pill tabs */}
        <div className="mt-3 flex gap-2">
          {AVAILABLE_FYS.map((fy) => (
            <button
              key={fy}
              onClick={() => setSelectedFY(fy)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-all active:scale-95',
                selectedFY === fy
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'bg-bg-elevated text-text-secondary active:bg-bg-hover'
              )}
            >
              {fy}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-[220px] rounded-xl lg:h-[300px]" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2 lg:gap-3 lg:grid-cols-4">
            <SummaryCard label="Income" value={totals.income} icon={DollarSign} accent="green" />
            <SummaryCard label="Expenses" value={totals.expenses} icon={TrendingDown} accent="red" />
            <SummaryCard label="Net Profit" value={totals.netProfit} icon={TrendingUp} accent="blue" />
            <SummaryCard label="Margin" value={profitMargin} isPercent icon={BarChart3} accent="default" />
          </div>

          {/* Monthly P&L Chart — shorter on mobile */}
          <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-3 lg:p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary lg:mb-4">Monthly P&L — {selectedFY}</h3>
            <div className="h-[220px] lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: CHART.text, fontSize: 10 }} axisLine={{ stroke: CHART.axis }} tickLine={false} interval={0} />
                  <YAxis tick={{ fill: CHART.text, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip contentStyle={CHART.tooltip} formatter={(value) => formatCurrency(Number(value))} labelStyle={{ color: CHART.text }} />
                  <Legend wrapperStyle={{ fontSize: '10px', color: CHART.text }} />
                  <Bar dataKey="income" name="Income" fill={CHART.colors.green} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill={CHART.colors.red} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expense Breakdown — donut above, list below on mobile */}
          <div className="grid grid-cols-1 gap-3 lg:gap-4 lg:grid-cols-2">
            {/* Donut — legend below on mobile, right on desktop */}
            <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-3 lg:p-5">
              <h3 className="mb-3 text-sm font-semibold text-text-primary lg:mb-4">Expense Breakdown</h3>
              {donutData.length === 0 ? (
                <div className="flex h-[180px] items-center justify-center text-sm text-text-tertiary">
                  No expense data available
                </div>
              ) : (
                <>
                  {/* Mobile: centered donut, no inline legend */}
                  <div className="h-[200px] lg:hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" animationDuration={800}>
                          {donutData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={CHART.tooltip} formatter={(value) => formatCurrency(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Mobile: horizontal legend pills below donut */}
                  <div className="mt-2 flex flex-wrap gap-1.5 lg:hidden">
                    {donutData.map((d, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] text-text-secondary">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                        {d.name}
                      </span>
                    ))}
                  </div>
                  {/* Desktop: full donut with right legend */}
                  <div className="hidden h-[300px] lg:block">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" animationDuration={800}>
                          {donutData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={CHART.tooltip} formatter={(value) => formatCurrency(Number(value))} />
                        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '11px', paddingLeft: '16px' }} formatter={(value) => <span style={{ color: CHART.text }}>{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>

            {/* Category Table — bigger rows on mobile, hide % on small screens */}
            <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-3 lg:p-5">
              <h3 className="mb-3 text-sm font-semibold text-text-primary lg:mb-4">Categories</h3>
              <div className="max-h-[320px] overflow-y-auto scrollbar-none lg:max-h-[300px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-primary">
                    <tr className="border-b border-border-subtle text-left text-[10px] font-medium uppercase tracking-wider text-text-tertiary lg:text-[11px]">
                      <th className="pb-2">Category</th>
                      <th className="pb-2 text-right">Amount</th>
                      <th className="hidden pb-2 text-right sm:table-cell">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryData.map((c, i) => (
                      <tr key={i} className="border-b border-border-subtle/50">
                        <td className="py-2.5 text-text-primary lg:py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                            <span className="truncate">{c.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-financial text-text-primary lg:py-2">{formatCurrency(c.value)}</td>
                        <td className="hidden py-2 text-right text-text-tertiary sm:table-cell">
                          {totals.expenses > 0 ? ((c.value / totals.expenses) * 100).toFixed(1) : '0.0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="pt-2 text-text-primary">Total</td>
                      <td className="pt-2 text-right font-financial text-text-primary">{formatCurrency(totals.expenses)}</td>
                      <td className="hidden pt-2 text-right text-text-tertiary sm:table-cell">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Year-on-Year Comparison */}
          <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-3 lg:p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary lg:mb-4">Year-on-Year Revenue</h3>
            <div className="h-[240px] lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yoyData} barGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: CHART.text, fontSize: 9 }} axisLine={{ stroke: CHART.axis }} tickLine={false} interval={0} angle={-35} textAnchor="end" height={40} />
                  <YAxis tick={{ fill: CHART.text, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip contentStyle={CHART.tooltip} formatter={(value) => formatCurrency(Number(value))} labelStyle={{ color: CHART.text }} />
                  <Legend wrapperStyle={{ fontSize: '10px', color: CHART.text }} />
                  <Bar dataKey="FY2024-25" fill={CHART.colors.muted} radius={[3, 3, 0, 0]} opacity={0.5} />
                  <Bar dataKey="FY2025-26" fill={CHART.colors.blue} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Detail — cards on mobile, table on desktop */}
          <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-3 lg:p-5">
            <h3 className="mb-3 text-sm font-semibold text-text-primary lg:mb-4">Monthly Detail — {selectedFY}</h3>

            {/* Mobile: card stack */}
            <div className="space-y-2 lg:hidden">
              {monthlyData.map((m, i) => {
                const margin = m.income > 0 ? (m.netProfit / m.income) * 100 : 0
                return (
                  <div key={i} className="rounded-xl bg-bg-secondary p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-text-primary">{m.month}</span>
                      <span className={cn('font-financial text-sm font-bold', m.netProfit >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                        {formatCurrency(m.netProfit)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-4 text-[11px] text-text-tertiary">
                      <span>In <span className="font-financial text-text-secondary">{formatCurrency(m.income)}</span></span>
                      <span>Out <span className="font-financial text-text-secondary">{formatCurrency(m.expenses)}</span></span>
                      <span className="ml-auto">{margin.toFixed(0)}%</span>
                    </div>
                  </div>
                )
              })}
              {/* Mobile total card */}
              <div className="rounded-xl border border-border-active bg-bg-elevated p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-text-primary">TOTAL</span>
                  <span className="font-financial text-sm font-bold text-text-primary">{formatCurrency(totals.netProfit)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-4 text-[11px] text-text-tertiary">
                  <span>In <span className="font-financial font-semibold text-accent-green">{formatCurrency(totals.income)}</span></span>
                  <span>Out <span className="font-financial font-semibold text-accent-red">{formatCurrency(totals.expenses)}</span></span>
                  <span className="ml-auto font-semibold">{profitMargin.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Desktop: full table */}
            <div className="hidden lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                    <th className="pb-2">Month</th>
                    <th className="pb-2 text-right">Income</th>
                    <th className="pb-2 text-right">Expenses</th>
                    <th className="pb-2 text-right">Net Profit</th>
                    <th className="pb-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((m, i) => {
                    const margin = m.income > 0 ? (m.netProfit / m.income) * 100 : 0
                    return (
                      <tr key={i} className="border-b border-border-subtle/50">
                        <td className="py-2 font-medium text-text-primary">{m.month}</td>
                        <td className="py-2 text-right font-financial text-accent-green">{formatCurrency(m.income)}</td>
                        <td className="py-2 text-right font-financial text-accent-red">{formatCurrency(m.expenses)}</td>
                        <td className={cn('py-2 text-right font-financial font-semibold', m.netProfit >= 0 ? 'text-text-primary' : 'text-accent-red')}>
                          {formatCurrency(m.netProfit)}
                        </td>
                        <td className="py-2 text-right text-text-tertiary">{margin.toFixed(1)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="pt-3 text-text-primary">TOTAL</td>
                    <td className="pt-3 text-right font-financial text-accent-green">{formatCurrency(totals.income)}</td>
                    <td className="pt-3 text-right font-financial text-accent-red">{formatCurrency(totals.expenses)}</td>
                    <td className="pt-3 text-right font-financial text-text-primary">{formatCurrency(totals.netProfit)}</td>
                    <td className="pt-3 text-right text-text-tertiary">{profitMargin.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Mobile sticky export bar — above bottom tabs */}
      {!loading && (
        <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-20 border-t border-border-subtle bg-bg-primary/95 px-4 py-2 backdrop-blur-sm sm:hidden">
          <div className="flex gap-2">
            <button
              onClick={sharePDF}
              className="btn-press flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-primary py-2.5 text-sm font-semibold text-white active:opacity-90"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button
              onClick={exportCSV}
              className="btn-press flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2.5 text-sm text-text-secondary active:bg-bg-elevated"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={exportPDF}
              className="btn-press flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2.5 text-sm text-text-secondary active:bg-bg-elevated"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, accent, isPercent }: { label: string; value: number; icon: typeof DollarSign; accent: string; isPercent?: boolean }) {
  const accentColor = accent === 'green' ? 'text-accent-green' : accent === 'red' ? 'text-accent-red' : accent === 'blue' ? 'text-accent-primary' : 'text-text-primary'
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-3 lg:p-4">
      <div className="flex items-center gap-1.5 text-text-tertiary">
        <Icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" strokeWidth={1.5} />
        <span className="text-[10px] font-medium uppercase tracking-wider lg:text-[11px]">{label}</span>
      </div>
      <p className={cn('mt-1.5 font-financial text-lg font-bold lg:mt-2 lg:text-2xl', accentColor)}>
        {isPercent ? `${value.toFixed(1)}%` : formatCurrency(value)}
      </p>
    </div>
  )
}
