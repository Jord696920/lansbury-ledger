'use client'

import { useState, useEffect } from 'react'
import { getUpcomingRecurring } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'
import { differenceInDays, format, parseISO } from 'date-fns'
import { RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type { RecurringExpense } from '@/types/database'

function urgencyColor(days: number): string {
  if (days <= 0)  return 'text-accent-red'
  if (days <= 7)  return 'text-accent-red'
  if (days <= 14) return 'text-accent-amber'
  return 'text-text-secondary'
}

export function UpcomingExpenses() {
  const [items, setItems] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUpcomingRecurring(30)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!loading && items.length === 0) return null

  const today = new Date()

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Due in 30 Days
        </h3>
        <Link href="/cash-flow" className="flex items-center gap-1 text-xs text-accent-primary hover:underline">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map(rec => {
            const days = differenceInDays(parseISO(rec.next_due_date), today)
            return (
              <div
                key={rec.id}
                className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-text-primary">{rec.name}</p>
                    <p className={`text-[10px] ${urgencyColor(days)}`}>
                      {days < 0
                        ? `${Math.abs(days)}d overdue`
                        : days === 0
                          ? 'Due today'
                          : `${days}d — ${format(parseISO(rec.next_due_date), 'd MMM')}`
                      }
                    </p>
                  </div>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <p className="font-financial text-xs font-semibold text-text-primary">{formatCurrency(rec.amount)}</p>
                  {days <= 7 && <AlertTriangle className="ml-auto h-3 w-3 text-accent-red" />}
                </div>
              </div>
            )
          })}
          {items.length > 5 && (
            <Link href="/cash-flow" className="block text-center text-[10px] text-text-tertiary hover:text-accent-primary pt-1">
              +{items.length - 5} more upcoming
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
