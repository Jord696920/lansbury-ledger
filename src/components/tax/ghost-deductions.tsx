'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { Ghost, DollarSign, AlertCircle } from 'lucide-react'

interface GhostDeduction {
  code: string
  name: string
  atoLabel: string | null
  estimatedSaving: number
  hint: string
}

// Common sole-trader deductions with ATO benchmarks / average claims
// These are typical annual amounts for motor vehicle retailers (ANZSIC 4614)
const DEDUCTION_HINTS: Record<string, { avg: number; hint: string }> = {
  '6-1010': { avg: 4500, hint: 'Fuel & oil for business vehicle — keep fuel receipts or log card transactions' },
  '6-1020': { avg: 2000, hint: 'Vehicle rego, insurance, CTP — deductible at your business-use %' },
  '6-1030': { avg: 1200, hint: 'Tyres, servicing, repairs — keep all mechanic invoices' },
  '6-1060': { avg: 3000, hint: 'Vehicle depreciation — claim effective life or instant write-off if eligible' },
  '6-2010': { avg: 800, hint: 'Accountant, tax agent, bookkeeping fees — claim this app too' },
  '6-2020': { avg: 400, hint: 'Bank fees, merchant fees, Stripe fees — check monthly statements' },
  '6-2030': { avg: 600, hint: 'Insurance (public liability, professional indemnity, tools)' },
  '6-2040': { avg: 3000, hint: 'Internet + mobile — claim business-use % of monthly plans' },
  '6-2050': { avg: 1500, hint: 'Computer equipment, software subscriptions (SaaS), peripherals' },
  '6-2060': { avg: 500, hint: 'Stationery, printer ink, office supplies' },
  '6-2070': { avg: 400, hint: 'Postage, courier, freight for business' },
  '6-3010': { avg: 2400, hint: 'Home office running costs — claim actual method or fixed rate (67c/hr)' },
  '6-3020': { avg: 1500, hint: 'Home office occupancy — rent/mortgage interest × floor area %' },
  '6-4010': { avg: 1000, hint: 'Advertising, marketing, Facebook/Google Ads for car buying' },
  '6-4020': { avg: 800, hint: 'Travel accommodation, flights, meals for business trips (50% meal limit)' },
  '6-5010': { avg: 1200, hint: 'Training, courses, seminars related to your current business' },
}

export function GhostDeductions() {
  const [ghosts, setGhosts] = useState<GhostDeduction[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPotential, setTotalPotential] = useState(0)

  useEffect(() => {
    async function scan() {
      // Get all expense accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, name, ato_label')
        .eq('type', 'expense')
        .eq('is_active', true)

      if (!accounts) { setLoading(false); return }

      // Get accounts that have transactions
      const { data: usedAccounts } = await supabase
        .from('transactions')
        .select('account_id')
        .not('account_id', 'is', null)
        .eq('is_personal', false)

      const usedIds = new Set((usedAccounts ?? []).map((t) => t.account_id))

      // Also check if there are deductions in invoices (some accounts might be claimed via BAS)
      // For now, flag any expense account with a known hint that has zero transactions
      const found: GhostDeduction[] = []
      let potential = 0

      for (const acct of accounts) {
        const hint = DEDUCTION_HINTS[acct.code]
        if (!hint) continue
        if (usedIds.has(acct.id)) continue

        // Estimate tax saving at marginal rate (assume ~30% for mid-range sole trader)
        const saving = Math.round(hint.avg * 0.30)
        potential += saving

        found.push({
          code: acct.code,
          name: acct.name,
          atoLabel: acct.ato_label,
          estimatedSaving: saving,
          hint: hint.hint,
        })
      }

      // Sort by biggest potential saving first
      found.sort((a, b) => b.estimatedSaving - a.estimatedSaving)

      setGhosts(found)
      setTotalPotential(potential)
      setLoading(false)
    }
    scan()
  }, [])

  if (loading) return <div className="skeleton h-48 rounded-xl" />

  if (ghosts.length === 0) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-green p-5">
        <div className="flex items-center gap-3">
          <Ghost className="h-5 w-5 text-accent-green" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">No Ghost Deductions</h3>
            <p className="text-xs text-text-secondary">All common deduction categories have recorded expenses. Nice work.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Ghost className="h-5 w-5 text-accent-purple" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Ghost Deductions</h3>
            <p className="text-[11px] text-text-tertiary">Deductions you may be missing — based on ATO benchmarks for your industry</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-financial text-lg font-bold text-accent-green">{formatCurrency(totalPotential)}</p>
          <p className="text-[10px] text-text-tertiary">potential tax saving</p>
        </div>
      </div>

      <div className="space-y-2">
        {ghosts.map((g) => (
          <div key={g.code} className="rounded-lg bg-bg-elevated px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-accent-purple" />
                <span className="text-xs font-medium text-text-primary">{g.name}</span>
                <span className="text-[10px] text-text-tertiary">{g.code}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3 w-3 text-accent-green" />
                <span className="font-financial text-xs font-semibold text-accent-green">
                  ~{formatCurrency(g.estimatedSaving)} saving
                </span>
              </div>
            </div>
            <p className="mt-1 pl-5.5 text-[11px] text-text-secondary">{g.hint}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-text-tertiary">
        Estimates based on industry averages at ~30% marginal rate. Actual deductions depend on your records and ATO substantiation rules.
      </p>
    </div>
  )
}
