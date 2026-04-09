'use client'

import { memo, useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts'
import { CHART } from '@/lib/constants'
import type { Invoice } from '@/types/database'
import { subMonths, startOfMonth, endOfMonth, format, addMonths } from 'date-fns'

interface RevenueForecastProps {
  invoices: Invoice[]
}

export const RevenueForecast = memo(function RevenueForecast({ invoices }: RevenueForecastProps) {
  const data = useMemo(() => {
    const now = new Date()

    // Historical: last 12 months
    const historical: { month: string; actual: number; forecast?: number; upper?: number; lower?: number }[] = []
    const monthlyRevenues: number[] = []

    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i)
      const ms = startOfMonth(d).toISOString().split('T')[0]
      const me = endOfMonth(d).toISOString().split('T')[0]
      const rev = invoices
        .filter((inv) => inv.issue_date >= ms && inv.issue_date <= me && inv.status !== 'void')
        .reduce((s, inv) => s + inv.total, 0)
      historical.push({ month: format(d, 'MMM yy'), actual: Math.round(rev) })
      monthlyRevenues.push(rev)
    }

    // Calculate trailing averages for forecast
    const last6 = monthlyRevenues.slice(-6)
    const avg6 = last6.reduce((s, v) => s + v, 0) / last6.length
    const stdDev = Math.sqrt(last6.reduce((s, v) => s + (v - avg6) ** 2, 0) / last6.length)

    // Forecast: next 3 months
    const forecast: typeof historical = []
    for (let i = 1; i <= 3; i++) {
      const d = addMonths(now, i)
      forecast.push({
        month: format(d, 'MMM yy'),
        actual: undefined as unknown as number,
        forecast: Math.round(avg6),
        upper: Math.round(avg6 + stdDev),
        lower: Math.round(Math.max(0, avg6 - stdDev)),
      })
    }

    return { chartData: [...historical, ...forecast], avg6, stdDev, monthlyRevenues }
  }, [invoices])

  // Stats
  const avgPerVehicle = invoices.length > 0
    ? invoices.reduce((s, inv) => s + inv.total, 0) / invoices.length
    : 0

  const bestMonth = data.monthlyRevenues.length > 0 ? Math.max(...data.monthlyRevenues) : 0
  const worstMonth = data.monthlyRevenues.length > 0 ? Math.min(...data.monthlyRevenues.filter(v => v > 0)) : 0

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-secondary p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Revenue Forecast</h3>
          <p className="text-[11px] text-text-tertiary">
            Trending at {formatCurrency(data.avg6)}/month (6mo avg)
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-text-tertiary">
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 rounded bg-accent-green" />
            Actual
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 rounded bg-accent-cyan" style={{ borderStyle: 'dashed' }} />
            Forecast
          </div>
        </div>
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: CHART.text, fontSize: 10 }} axisLine={{ stroke: CHART.axis }} tickLine={false} />
            <YAxis tick={{ fill: CHART.text, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '12px' }}
              formatter={(value) => formatCurrency(Number(value))}
            />
            <ReferenceLine y={10000} stroke="#FFB020" strokeDasharray="6 4" strokeWidth={1} label={{ value: '$10K target', fill: '#FFB020', fontSize: 9, position: 'right' }} />
            <Area dataKey="upper" stroke="none" fill="rgba(34, 211, 238, 0.08)" />
            <Area dataKey="lower" stroke="none" fill="var(--color-bg-secondary)" />
            <Line dataKey="actual" stroke="#00D47E" strokeWidth={2} dot={{ fill: '#00D47E', r: 3 }} connectNulls={false} />
            <Line dataKey="forecast" stroke="#22D3EE" strokeWidth={2} strokeDasharray="6 4" dot={{ fill: '#22D3EE', r: 3 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Quick stats */}
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border-subtle pt-3">
        <div>
          <p className="text-[10px] text-text-tertiary">Avg / Vehicle</p>
          <p className="font-financial text-sm font-semibold text-text-primary">{formatCurrency(avgPerVehicle)}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-tertiary">Best Month</p>
          <p className="font-financial text-sm font-semibold text-accent-green">{formatCurrency(bestMonth)}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-tertiary">Worst Month</p>
          <p className="font-financial text-sm font-semibold text-accent-amber">{formatCurrency(worstMonth)}</p>
        </div>
      </div>
    </div>
  )
})
