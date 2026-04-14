'use client'

import { useState, useEffect } from 'react'
import { getClaims } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Shield, Calendar, AlertTriangle, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Claim, ClaimStageEntry } from '@/types/database'

const STAGES = [
  { key: 'filed', label: 'Filed' },
  { key: 'ruling', label: 'Ruling' },
  { key: 'awaiting_payment', label: 'Awaiting Payment' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'received', label: 'Received' },
]

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClaims().then((data) => { setClaims(data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="skeleton h-96 w-full rounded-xl" />

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary lg:text-2xl">Claims</h1>
        <p className="text-[11px] text-text-tertiary lg:text-sm lg:text-text-secondary">Active claims & disputes</p>
      </div>

      {claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-bg-primary p-12 text-center shadow-sm">
          <Shield className="mb-3 h-10 w-10 text-text-tertiary" />
          <p className="text-sm text-text-secondary">No active claims</p>
        </div>
      ) : (
        claims.map((claim) => <ClaimCard key={claim.id} claim={claim} onUpdate={() => getClaims().then(setClaims)} />)
      )}
    </div>
  )
}

function ClaimCard({ claim, onUpdate }: { claim: Claim; onUpdate: () => void }) {
  const [updating, setUpdating] = useState(false)
  const currentStageIndex = STAGES.findIndex((s) => s.key === claim.current_stage)
  const components = claim.components ?? {}
  const daysUntilCheckin = claim.next_checkin_date
    ? Math.ceil((new Date(claim.next_checkin_date).getTime() - Date.now()) / 86400000)
    : null

  async function advanceStage() {
    if (currentStageIndex >= STAGES.length - 1) return
    setUpdating(true)
    const nextStage = STAGES[currentStageIndex + 1]
    const newHistory: ClaimStageEntry = { stage: nextStage.key, date: new Date().toISOString().split('T')[0] }
    const updatedHistory = [...(claim.stage_history || []), newHistory]

    const updates: Record<string, unknown> = {
      current_stage: nextStage.key,
      stage_history: updatedHistory,
    }
    if (nextStage.key === 'received') {
      updates.status = 'settled'
      updates.received_date = new Date().toISOString().split('T')[0]
      updates.total_received = claim.total_claimed
    }

    await supabase.from('claims').update(updates).eq('id', claim.id)
    setUpdating(false)
    onUpdate()
  }

  const isReceived = claim.current_stage === 'received'

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary lg:text-lg">{claim.claim_name}</h2>
          <p className="mt-0.5 text-[11px] text-text-tertiary">Ref: {claim.reference}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'rounded-full px-3 py-1 text-[11px] font-semibold',
            isReceived ? 'bg-surface-green text-accent-green' : 'bg-surface-amber text-accent-amber'
          )}>
            {isReceived ? 'Settled' : 'Pending'}
          </span>
          <span className="font-financial text-lg font-bold text-text-primary">{formatCurrency(claim.total_claimed ?? 0)}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-5 flex items-center gap-0">
        {STAGES.map((stage, i) => {
          const isComplete = i <= currentStageIndex
          const isCurrent = i === currentStageIndex
          const histEntry = (claim.stage_history || []).find((h) => h.stage === stage.key)
          return (
            <div key={stage.key} className="flex flex-1 flex-col items-center">
              {/* Line + dot */}
              <div className="flex w-full items-center">
                {i > 0 && <div className={cn('h-0.5 flex-1', isComplete ? 'bg-accent-green' : 'bg-border-subtle')} />}
                <div className={cn(
                  'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 lg:h-7 lg:w-7',
                  isComplete ? 'border-accent-green bg-accent-green' : 'border-border-subtle bg-bg-primary'
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Clock className="h-3 w-3 text-text-tertiary" />
                  )}
                </div>
                {i < STAGES.length - 1 && <div className={cn('h-0.5 flex-1', i < currentStageIndex ? 'bg-accent-green' : 'bg-border-subtle')} />}
              </div>
              {/* Label */}
              <span className={cn(
                'mt-1.5 text-center text-[9px] font-medium leading-tight lg:text-[10px]',
                isCurrent ? 'text-accent-primary font-semibold' : isComplete ? 'text-accent-green' : 'text-text-tertiary'
              )}>
                {stage.label}
              </span>
              {histEntry && (
                <span className="text-[8px] text-text-tertiary lg:text-[9px]">{histEntry.date}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Components */}
      <div className="mt-5 rounded-xl bg-bg-secondary p-3 lg:p-4">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Components</h4>
        <div className="space-y-1.5">
          {Object.entries(components).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
              <span className="font-financial font-medium text-text-primary">{formatCurrency(Number(value))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Check-in + Actions */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {daysUntilCheckin !== null && !isReceived && (
            <p className={cn(
              'flex items-center gap-1.5 text-xs font-medium',
              daysUntilCheckin <= 0 ? 'text-accent-red' : daysUntilCheckin <= 7 ? 'text-accent-amber' : 'text-text-secondary'
            )}>
              <Calendar className="h-3.5 w-3.5" />
              Next check-in: {formatDate(claim.next_checkin_date!)}
              {daysUntilCheckin <= 0 && ' (overdue!)'}
              {daysUntilCheckin > 0 && ` (${daysUntilCheckin}d)`}
            </p>
          )}
          {claim.notes && (
            <p className="mt-1 text-[11px] text-text-tertiary leading-relaxed">{claim.notes}</p>
          )}
        </div>
        {!isReceived && (
          <button
            onClick={advanceStage}
            disabled={updating}
            className="btn-press flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 active:scale-95"
          >
            {updating ? 'Updating...' : `Mark as ${STAGES[currentStageIndex + 1]?.label ?? 'Next'}`}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
        {isReceived && (
          <Link
            href="/tax"
            className="flex items-center gap-2 rounded-lg bg-surface-amber px-4 py-2 text-sm font-semibold text-accent-amber hover:opacity-90"
          >
            <AlertTriangle className="h-4 w-4" />
            Assessable income — review tax position
          </Link>
        )}
      </div>
    </div>
  )
}
