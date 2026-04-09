'use client'

import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { CHART } from '@/lib/constants'

interface MonthlyData {
  month: string
  revenue: number
  expenses: number
}

export const RevenueExpenseChart = memo(function RevenueExpenseChart({ data }: { data: MonthlyData[] }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">Revenue vs Expenses</h3>
      <div className="h-[280px]">
        {data.every((d) => d.revenue === 0 && d.expenses === 0) ? (
          <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
            Import transactions to see your revenue and expense trends
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2}>
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.colors.green} stopOpacity={1} />
                  <stop offset="100%" stopColor={CHART.colors.green} stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.colors.red} stopOpacity={1} />
                  <stop offset="100%" stopColor={CHART.colors.red} stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: CHART.text, fontSize: CHART.textSize }} axisLine={{ stroke: CHART.axis }} tickLine={false} />
              <YAxis tick={{ fill: CHART.text, fontSize: CHART.textSize }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={CHART.tooltip} formatter={(value) => formatCurrency(Number(value))} labelStyle={{ color: CHART.text }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: CHART.text }} />
              <Bar dataKey="revenue" name="Revenue" fill="url(#greenGrad)" radius={[4, 4, 0, 0]} animationDuration={800} />
              <Bar dataKey="expenses" name="Expenses" fill="url(#redGrad)" radius={[4, 4, 0, 0]} animationDuration={800} animationBegin={200} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
})
