'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { getFYDates } from '@/lib/utils'
import { Shield, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react'

interface ScoreComponent {
  label: string
  score: number
  maxScore: number
  detail: string
  status: 'good' | 'warning' | 'critical'
}

export function HealthScore() {
  const [totalScore, setTotalScore] = useState(0)
  const [components, setComponents] = useState<ScoreComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [improvement, setImprovement] = useState('')

  const calculate = useCallback(async () => {
    try {
      const { start, end } = getFYDates()
      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]

      // Fetch all data needed
      const [
        { count: totalTxns },
        { count: categorisedTxns },
        { count: reviewedTxns },
        { count: personalTxns },
        { count: withReceipts },
        { count: overThreshold },
        { count: anomalies },
        { data: basPeriods },
      ] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true }).gte('date', startStr).lte('date', endStr),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).not('account_id', 'is', null).gte('date', startStr).lte('date', endStr),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('is_reviewed', true).gte('date', startStr).lte('date', endStr),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('is_personal', true).gte('date', startStr).lte('date', endStr),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).not('receipt_url', 'is', null).gte('date', startStr).lte('date', endStr),
        // Substantiation threshold: expenses > $82.50 without receipts
        supabase.from('transactions').select('id', { count: 'exact', head: true }).is('receipt_url', null).lt('amount', -82.50).gte('date', startStr).lte('date', endStr),
        supabase.from('anomalies').select('id', { count: 'exact', head: true }).eq('is_dismissed', false),
        supabase.from('bas_periods').select('status').order('start_date', { ascending: false }).limit(4),
      ])

      const total = totalTxns ?? 0
      const categorised = categorisedTxns ?? 0
      const reviewed = reviewedTxns ?? 0
      const personal = personalTxns ?? 0
      const receipts = withReceipts ?? 0
      const needReceipts = overThreshold ?? 0
      const unresolvedAnomalies = anomalies ?? 0

      // Score components (out of 100)
      const scores: ScoreComponent[] = []

      // 1. Categorisation Completeness (30 points)
      const nonPersonal = total - (personal ?? 0)
      const catPct = nonPersonal > 0 ? categorised / nonPersonal : 1
      const catScore = Math.round(catPct * 30)
      scores.push({
        label: 'Categorisation',
        score: catScore,
        maxScore: 30,
        detail: nonPersonal > 0 ? `${categorised}/${nonPersonal} transactions categorised` : 'No transactions yet',
        status: catPct >= 0.9 ? 'good' : catPct >= 0.7 ? 'warning' : 'critical',
      })

      // 2. Review Completeness (20 points)
      const revPct = total > 0 ? reviewed / total : 1
      const revScore = Math.round(revPct * 20)
      scores.push({
        label: 'Review Status',
        score: revScore,
        maxScore: 20,
        detail: total > 0 ? `${reviewed}/${total} transactions reviewed` : 'No transactions yet',
        status: revPct >= 0.9 ? 'good' : revPct >= 0.7 ? 'warning' : 'critical',
      })

      // 3. Receipt Coverage (20 points)
      const receiptPct = needReceipts > 0 ? Math.max(0, 1 - (needReceipts - receipts) / needReceipts) : 1
      const receiptScore = Math.round(Math.min(1, receiptPct) * 20)
      scores.push({
        label: 'Receipt Coverage',
        score: receiptScore,
        maxScore: 20,
        detail: needReceipts > 0 ? `${needReceipts} expenses over $82.50 need receipts` : 'All covered',
        status: receiptPct >= 0.8 ? 'good' : receiptPct >= 0.5 ? 'warning' : 'critical',
      })

      // 4. BAS Readiness (15 points)
      const lodgedCount = basPeriods?.filter((p) => p.status === 'lodged' || p.status === 'paid').length ?? 0
      const basTotal = basPeriods?.length ?? 0
      const basPct = basTotal > 0 ? lodgedCount / basTotal : 0
      const basScore = Math.round(basPct * 15)
      scores.push({
        label: 'BAS Compliance',
        score: basScore,
        maxScore: 15,
        detail: `${lodgedCount}/${basTotal} quarters lodged`,
        status: basPct >= 0.75 ? 'good' : basPct >= 0.5 ? 'warning' : 'critical',
      })

      // 5. Data Quality (15 points) — based on anomalies
      const anomalyPenalty = Math.min(15, unresolvedAnomalies * 3)
      const qualityScore = 15 - anomalyPenalty
      scores.push({
        label: 'Data Quality',
        score: qualityScore,
        maxScore: 15,
        detail: unresolvedAnomalies > 0 ? `${unresolvedAnomalies} unresolved anomalies` : 'No issues detected',
        status: unresolvedAnomalies === 0 ? 'good' : unresolvedAnomalies <= 2 ? 'warning' : 'critical',
      })

      const finalScore = scores.reduce((s, c) => s + c.score, 0)
      setComponents(scores)
      setTotalScore(finalScore)

      // Generate improvement suggestion
      const worstComponent = scores.reduce((worst, c) =>
        (c.score / c.maxScore) < (worst.score / worst.maxScore) ? c : worst
      )
      if (worstComponent.status !== 'good') {
        const suggestions: Record<string, string> = {
          'Categorisation': 'Categorise uncategorised transactions to improve your score',
          'Review Status': 'Review pending transactions to ensure accuracy',
          'Receipt Coverage': 'Upload receipts for expenses over $82.50',
          'BAS Compliance': 'Prepare and lodge your BAS for open quarters',
          'Data Quality': 'Review and resolve flagged anomalies',
        }
        setImprovement(suggestions[worstComponent.label] || '')
      }
    } catch (err) {
      console.error('Health score error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { calculate() }, [calculate])

  // Score colour
  const scoreColor = totalScore >= 80 ? 'text-accent-green' : totalScore >= 50 ? 'text-accent-amber' : 'text-accent-red'
  const ringColor = totalScore >= 80 ? '#00D47E' : totalScore >= 50 ? '#FFB020' : '#FF4D6A'

  // SVG ring
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (totalScore / 100) * circumference

  if (loading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-secondary p-5">
        <div className="flex items-center gap-4">
          <div className="skeleton h-28 w-28 rounded-full" />
          <div className="flex-1">
            <div className="skeleton mb-2 h-4 w-32" />
            <div className="skeleton mb-2 h-3 w-48" />
            <div className="skeleton h-3 w-40" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-secondary p-5" data-stagger style={{ animationDelay: '300ms' }}>
      <div className="mb-4 flex items-start gap-5">
        {/* Score Ring */}
        <div className="relative shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#2A2A3C" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('font-financial text-2xl font-bold', scoreColor)}>{totalScore}</span>
            <span className="text-[9px] font-medium text-text-tertiary">/ 100</span>
          </div>
        </div>

        {/* Summary */}
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Shield className={cn('h-4 w-4', scoreColor)} aria-hidden="true" />
            <h3 className="text-sm font-semibold text-text-primary">Financial Health</h3>
          </div>
          <p className={cn('text-xs font-medium', scoreColor)}>
            {totalScore >= 80 ? 'Excellent' : totalScore >= 60 ? 'Good' : totalScore >= 40 ? 'Needs Attention' : 'Critical'}
          </p>
          {improvement && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-text-secondary">
              <TrendingUp className="h-3 w-3 text-accent-amber" aria-hidden="true" />
              {improvement}
            </p>
          )}
        </div>
      </div>

      {/* Component Breakdown */}
      <div className="space-y-2">
        {components.map((c) => (
          <div key={c.label} className="flex items-center gap-3">
            {c.status === 'good' ? (
              <CheckCircle className="h-3.5 w-3.5 shrink-0 text-accent-green" aria-hidden="true" />
            ) : (
              <AlertCircle className={cn('h-3.5 w-3.5 shrink-0', c.status === 'warning' ? 'text-accent-amber' : 'text-accent-red')} aria-hidden="true" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-text-secondary">{c.label}</span>
                <span className="font-financial text-[11px] text-text-tertiary">{c.score}/{c.maxScore}</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-bg-elevated">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', {
                    'bg-accent-green': c.status === 'good',
                    'bg-accent-amber': c.status === 'warning',
                    'bg-accent-red': c.status === 'critical',
                  })}
                  style={{ width: `${(c.score / c.maxScore) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
