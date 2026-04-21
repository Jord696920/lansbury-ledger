'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatCurrency, getCurrentFY } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getCurrentQuarter } from '@/lib/constants'
import { Plus, Bell, TrendingUp, TrendingDown, X, LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { signOut } from '@/app/login/actions'
import type { ComplianceEvent } from '@/types/database'

export function Topbar() {
  const [gstPosition, setGstPosition] = useState(0)
  const [gstLoaded, setGstLoaded] = useState(false)
  const [events, setEvents] = useState<ComplianceEvent[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showAccount, setShowAccount] = useState(false)

  const loadGstPosition = useCallback(async () => {
    try {
      const quarter = getCurrentQuarter()
      const startStr = quarter.start.toISOString().split('T')[0]
      const endStr = quarter.end.toISOString().split('T')[0]

      // Try BAS period data first (authoritative for lodged/paid quarters)
      const { data: basPeriod } = await supabase
        .from('bas_periods')
        .select('gst_collected, gst_credits, net_gst, status')
        .eq('start_date', startStr)
        .single()

      if (basPeriod && basPeriod.net_gst != null && basPeriod.status !== 'open') {
        setGstPosition(basPeriod.net_gst)
        setGstLoaded(true)
        return
      }

      // For open quarters, estimate from invoices GST + any transaction credits
      const { data: invoices } = await supabase
        .from('invoices')
        .select('gst_amount')
        .gte('issue_date', startStr)
        .lte('issue_date', endStr)
        .neq('status', 'void')

      const collected = invoices?.reduce((s, inv) => s + (inv.gst_amount ?? 0), 0) ?? 0

      const { data: transactions } = await supabase
        .from('transactions')
        .select('gst_amount, account:accounts(type)')
        .gte('date', startStr)
        .lte('date', endStr)
        .eq('is_personal', false)
        .not('account_id', 'is', null)

      let credits = 0
      if (transactions) {
        for (const t of transactions) {
          const acct = t.account as unknown as { type: string } | null
          if (acct?.type === 'expense') credits += Math.abs(t.gst_amount || 0)
        }
      }

      setGstPosition(collected - credits)
      setGstLoaded(true)
    } catch {
      setGstLoaded(true)
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('compliance_events')
        .select('*')
        .in('status', ['due_soon', 'overdue'])
        .order('due_date')
        .limit(10)
      setEvents((data as ComplianceEvent[]) || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    loadGstPosition()
    loadNotifications()
  }, [loadGstPosition, loadNotifications])

  const isOwing = gstPosition > 0
  const notifCount = events.length

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-subtle bg-bg-primary px-6">
      {/* Left */}
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-bg-elevated px-3 py-1.5 text-sm font-bold text-text-primary">
          {getCurrentFY()}
        </div>

        {/* GST Position — clickable, links to /gst */}
        <Link
          href="/gst"
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 ${
            gstLoaded
              ? isOwing
                ? 'bg-surface-red text-accent-red'
                : 'bg-surface-green text-accent-green'
              : 'bg-bg-elevated text-text-tertiary'
          }`}
        >
          {isOwing ? <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />}
          <span className="font-financial">
            {gstLoaded
              ? `GST: ${isOwing ? 'Owe' : 'Credit'} ${formatCurrency(Math.abs(gstPosition))}`
              : 'GST: Loading...'
            }
          </span>
        </Link>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <Link
          href="/invoices?action=new"
          className="btn-press flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent-primary-light"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Quick Add
        </Link>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative rounded-lg p-2 text-text-tertiary transition-colors hover:bg-bg-elevated hover:text-text-secondary"
            aria-label={`Notifications${notifCount > 0 ? ` (${notifCount} pending)` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {notifCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-red text-[10px] font-bold text-white">
                {notifCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifs && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-border-subtle bg-bg-primary shadow-lg">
                <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                  <p className="text-xs font-semibold text-text-primary">Notifications</p>
                  <button onClick={() => setShowNotifs(false)} className="text-text-tertiary hover:text-text-secondary" aria-label="Close notifications">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {events.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-text-tertiary">No pending notifications</p>
                  ) : (
                    events.map((ev) => (
                      <Link
                        key={ev.id}
                        href="/gst"
                        onClick={() => setShowNotifs(false)}
                        className="flex items-start gap-3 border-b border-border-subtle/50 px-4 py-3 transition-colors last:border-0 hover:bg-bg-elevated"
                      >
                        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ev.status === 'overdue' ? 'bg-accent-red' : 'bg-accent-amber'}`} />
                        <div>
                          <p className="text-xs font-medium text-text-primary">{ev.title}</p>
                          <p className="text-[11px] text-text-tertiary">{ev.description}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <ThemeToggle />

        <div className="relative">
          <button
            onClick={() => setShowAccount(!showAccount)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple text-xs font-bold text-white"
            aria-label="Account menu"
          >
            JL
          </button>
          {showAccount && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAccount(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-border-subtle bg-bg-primary shadow-lg">
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-text-primary hover:bg-bg-elevated"
                  >
                    <LogOut className="h-3.5 w-3.5 text-text-tertiary" />
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
