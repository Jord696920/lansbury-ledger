'use client'

import Link from 'next/link'
import { AlertCircle, FileText, Receipt, Bot, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActionItem {
  icon: React.ReactNode
  label: string
  href: string
  variant: 'warning' | 'danger' | 'info' | 'purple'
  count?: number
}

interface ActionItemsProps {
  uncategorisedCount: number
  overdueCount: number
  anomalyCount: number
  basDueDays?: number
  eofyDays?: number
}

const variantStyles = {
  warning: 'border-accent-amber/20 bg-surface-amber text-accent-amber',
  danger: 'border-accent-red/20 bg-surface-red text-accent-red',
  info: 'border-accent-blue/20 bg-surface-blue text-accent-blue',
  purple: 'border-accent-purple/20 bg-surface-purple text-accent-purple',
}

export function ActionItems({ uncategorisedCount, overdueCount, anomalyCount, basDueDays, eofyDays }: ActionItemsProps) {
  const items: ActionItem[] = []

  if (uncategorisedCount > 0) {
    items.push({
      icon: <Receipt className="h-4 w-4" />,
      label: `${uncategorisedCount} transaction${uncategorisedCount !== 1 ? 's' : ''} need categorisation`,
      href: '/transactions?filter=uncategorised',
      variant: 'warning',
    })
  }

  if (basDueDays !== undefined && basDueDays <= 30) {
    items.push({
      icon: <Calendar className="h-4 w-4" />,
      label: `BAS Q3 due in ${basDueDays} day${basDueDays !== 1 ? 's' : ''}`,
      href: '/gst',
      variant: basDueDays <= 7 ? 'danger' : 'warning',
    })
  }

  if (overdueCount > 0) {
    items.push({
      icon: <FileText className="h-4 w-4" />,
      label: `${overdueCount} invoice${overdueCount !== 1 ? 's' : ''} overdue`,
      href: '/invoices?filter=overdue',
      variant: 'danger',
    })
  }

  if (anomalyCount > 0) {
    items.push({
      icon: <Bot className="h-4 w-4" />,
      label: `AI detected ${anomalyCount} anomal${anomalyCount !== 1 ? 'ies' : 'y'}`,
      href: '/transactions?tab=anomalies',
      variant: 'purple',
    })
  }

  if (eofyDays !== undefined && eofyDays <= 90) {
    items.push({
      icon: <AlertCircle className="h-4 w-4" />,
      label: `${eofyDays} days to EOFY — Review tax position`,
      href: '/tax',
      variant: 'danger',
    })
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-secondary p-5">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Action Items</h3>
        <p className="text-sm text-text-tertiary">All clear — nothing needs your attention right now.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-secondary p-5">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Action Items</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all hover:brightness-110',
              variantStyles[item.variant]
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            <span className="ml-auto text-xs opacity-60">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
