'use client'

import { memo } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { useAnimatedNumber } from '@/hooks/use-animated-number'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { staggerDelay } from '@/lib/constants'

interface MetricCardProps {
  title: string
  value: number
  format?: 'currency' | 'percentage' | 'number'
  change?: number
  changeLabel?: string
  icon?: LucideIcon
  accent?: 'green' | 'red' | 'blue' | 'amber' | 'purple'
  loading?: boolean
  index?: number
}

const accentMap = {
  green: { bg: 'bg-surface-green', text: 'text-accent-green', gradient: 'from-accent-green/5 to-transparent' },
  red: { bg: 'bg-surface-red', text: 'text-accent-red', gradient: 'from-accent-red/5 to-transparent' },
  blue: { bg: 'bg-surface-blue', text: 'text-accent-blue', gradient: 'from-accent-blue/5 to-transparent' },
  amber: { bg: 'bg-surface-amber', text: 'text-accent-amber', gradient: 'from-accent-amber/5 to-transparent' },
  purple: { bg: 'bg-surface-purple', text: 'text-accent-purple', gradient: 'from-accent-purple/5 to-transparent' },
}

export const MetricCard = memo(function MetricCard({
  title,
  value,
  format = 'currency',
  change,
  changeLabel,
  icon: Icon,
  accent = 'green',
  loading,
  index = 0,
}: MetricCardProps) {
  const animatedValue = useAnimatedNumber(loading ? 0 : value, 800)
  const colors = accentMap[accent]

  if (loading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-secondary p-5">
        <div className="skeleton mb-3 h-4 w-24" />
        <div className="skeleton mb-2 h-8 w-32" />
        <div className="skeleton h-3 w-20" />
      </div>
    )
  }

  const displayValue = format === 'currency'
    ? formatCurrency(animatedValue)
    : format === 'percentage'
      ? `${animatedValue.toFixed(1)}%`
      : Math.round(animatedValue).toLocaleString()

  const isPositiveChange = change !== undefined && change > 0
  const isNegativeChange = change !== undefined && change < 0

  return (
    <div
      className={cn('card-hover relative overflow-hidden rounded-xl border border-border-subtle bg-bg-secondary p-5')}
      data-stagger
      style={{ animationDelay: staggerDelay(index) }}
    >
      {/* Subtle gradient background */}
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-50', colors.gradient)} />

      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{title}</p>
          {Icon && (
            <div className={cn('rounded-lg p-2', colors.bg)}>
              <Icon className={cn('h-4 w-4', colors.text)} aria-hidden="true" />
            </div>
          )}
        </div>

        <p className={cn(
          'font-financial text-2xl font-bold tracking-tight',
          value < 0 ? 'text-accent-red' : 'text-text-primary'
        )}>
          {displayValue}
        </p>

        {change !== undefined && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {isPositiveChange && <TrendingUp className="h-3 w-3 text-accent-green" aria-hidden="true" />}
            {isNegativeChange && <TrendingDown className="h-3 w-3 text-accent-red" aria-hidden="true" />}
            {!isPositiveChange && !isNegativeChange && <Minus className="h-3 w-3 text-text-tertiary" aria-hidden="true" />}
            <span className={cn(
              isPositiveChange ? 'text-accent-green' : isNegativeChange ? 'text-accent-red' : 'text-text-tertiary'
            )}>
              {change > 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
            {changeLabel && <span className="text-text-tertiary">{changeLabel}</span>}
          </div>
        )}
      </div>
    </div>
  )
})
