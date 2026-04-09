'use client'

import { memo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { PALETTE, CHART } from '@/lib/constants'

interface CategoryData {
  name: string
  value: number
}

export const ExpenseBreakdownChart = memo(function ExpenseBreakdownChart({ data }: { data: CategoryData[] }) {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const top8 = sorted.slice(0, 8)
  const otherTotal = sorted.slice(8).reduce((sum, d) => sum + d.value, 0)
  const chartData = otherTotal > 0 ? [...top8, { name: 'Other', value: otherTotal }] : top8

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-secondary p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">Expense Breakdown</h3>
      <div className="h-[280px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
            Categorise transactions to see your expense breakdown
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                animationDuration={800}
                animationBegin={300}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={CHART.tooltip}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: '11px', paddingLeft: '16px' }}
                formatter={(value) => <span style={{ color: CHART.text }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
})
