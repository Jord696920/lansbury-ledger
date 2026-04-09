'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Shield, Search, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeductionRule } from '@/types/database'

export default function DeductionsPage() {
  const [rules, setRules] = useState<DeductionRule[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRules()
  }, [])

  async function loadRules() {
    const { data } = await supabase.from('deduction_rules').select('*').order('category')
    setRules((data as DeductionRule[]) || [])
    setLoading(false)
  }

  const filtered = rules.filter((r) =>
    search === '' ||
    r.category.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Deduction Vault</h1>
        <p className="text-sm text-text-secondary">ATO deduction library & audit protection</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deduction categories..."
          className="w-full rounded-lg border border-border-subtle bg-bg-secondary py-2.5 pl-9 pr-4 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-accent-primary"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rule) => (
            <div key={rule.id} className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5 card-hover">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={cn('h-4 w-4', rule.is_grey_area ? 'text-accent-amber' : 'text-accent-green')} />
                  <h3 className="text-sm font-semibold text-text-primary">{rule.category}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {rule.ato_ruling && (
                    <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-medium text-accent-blue">
                      {rule.ato_ruling}
                    </span>
                  )}
                  {rule.is_grey_area ? (
                    <span className="flex items-center gap-1 rounded-full bg-surface-amber px-2 py-0.5 text-[10px] font-medium text-accent-amber">
                      <AlertTriangle className="h-3 w-3" />
                      Grey Area
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-surface-green px-2 py-0.5 text-[10px] font-medium text-accent-green">
                      <CheckCircle className="h-3 w-3" />
                      Clear
                    </span>
                  )}
                </div>
              </div>

              <p className="mb-3 text-sm text-text-secondary">{rule.description}</p>

              <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
                {rule.max_claim && (
                  <div className="rounded-lg bg-bg-primary p-2">
                    <span className="text-text-tertiary">Max Claim: </span>
                    <span className="font-medium text-text-primary">{rule.max_claim}</span>
                  </div>
                )}
                {rule.conditions && (
                  <div className="rounded-lg bg-bg-primary p-2">
                    <span className="text-text-tertiary">Conditions: </span>
                    <span className="text-text-secondary">{rule.conditions}</span>
                  </div>
                )}
                {rule.substantiation_required && (
                  <div className="rounded-lg bg-bg-primary p-2">
                    <span className="text-text-tertiary">Evidence: </span>
                    <span className="text-text-secondary">{rule.substantiation_required}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
