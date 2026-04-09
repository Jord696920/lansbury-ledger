'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react'

interface RiskFactor {
  label: string
  severity: 'low' | 'medium' | 'high'
  detail: string
  points: number
}

interface AuditRiskScoreProps {
  revenue: number
  deductions: number
}

export function AuditRiskScore({ revenue, deductions }: AuditRiskScoreProps) {
  const [score, setScore] = useState(0)
  const [factors, setFactors] = useState<RiskFactor[]>([])
  const [loading, setLoading] = useState(true)

  const calculate = useCallback(async () => {
    const riskFactors: RiskFactor[] = []
    let totalPoints = 0

    // 1. Deduction-to-income ratio
    const ratio = revenue > 0 ? deductions / revenue : 0
    if (ratio > 0.6) {
      const pts = ratio > 0.75 ? 25 : 15
      totalPoints += pts
      riskFactors.push({
        label: 'High deduction ratio',
        severity: ratio > 0.75 ? 'high' : 'medium',
        detail: `${(ratio * 100).toFixed(0)}% of income claimed as deductions (ATO benchmark: <50% for motor vehicle retailers)`,
        points: pts,
      })
    }

    // 2. Check BAS consistency
    const { data: basPeriods } = await supabase
      .from('bas_periods')
      .select('gst_collected, gst_credits, status')
      .in('status', ['lodged', 'paid'])

    if (basPeriods) {
      const overClaimed = basPeriods.filter((p) => {
        const collected = p.gst_collected ?? 0
        const credits = p.gst_credits ?? 0
        return collected > 0 && credits > collected
      })
      if (overClaimed.length > 0) {
        totalPoints += 20
        riskFactors.push({
          label: 'GST credit exceeds collection',
          severity: 'high',
          detail: `${overClaimed.length} quarter(s) where GST credits exceeded GST collected — may attract review`,
          points: 20,
        })
      }
    }

    // 3. Receipt coverage
    const { count: largeExpenses } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .lt('amount', -82.50)
      .is('receipt_url', null)
      .eq('is_personal', false)

    if ((largeExpenses ?? 0) > 5) {
      const pts = (largeExpenses ?? 0) > 20 ? 20 : 10
      totalPoints += pts
      riskFactors.push({
        label: 'Missing receipts',
        severity: pts > 10 ? 'high' : 'medium',
        detail: `${largeExpenses} expenses over $82.50 without receipts — ATO substantiation rules require records`,
        points: pts,
      })
    }

    // 4. Income volatility
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total, issue_date')
      .neq('status', 'void')

    if (invoices && invoices.length > 12) {
      // Group by calendar month
      const monthlyTotals = new Map<string, number>()
      for (const inv of invoices) {
        const month = inv.issue_date.substring(0, 7)
        monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + inv.total)
      }
      const values = Array.from(monthlyTotals.values())
      if (values.length >= 6) {
        const avg = values.reduce((s, v) => s + v, 0) / values.length
        const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length)
        const cv = avg > 0 ? stdDev / avg : 0
        if (cv > 0.5) {
          totalPoints += 10
          riskFactors.push({
            label: 'Income volatility',
            severity: 'medium',
            detail: `High month-to-month income variation (CV: ${(cv * 100).toFixed(0)}%) — may trigger income matching review`,
            points: 10,
          })
        }
      }
    }

    // 5. If everything looks good
    if (riskFactors.length === 0) {
      riskFactors.push({
        label: 'Clean position',
        severity: 'low',
        detail: 'No significant risk factors detected. Your return appears audit-safe.',
        points: 0,
      })
    }

    setScore(Math.min(100, totalPoints))
    setFactors(riskFactors)
    setLoading(false)
  }, [revenue, deductions])

  useEffect(() => { calculate() }, [calculate])

  const scoreColor = score <= 30 ? 'text-accent-green' : score <= 60 ? 'text-accent-amber' : 'text-accent-red'
  const ringColorHex = score <= 30 ? 'var(--color-accent-green)' : score <= 60 ? 'var(--color-accent-amber)' : 'var(--color-accent-red)'
  const label = score <= 30 ? 'Low Risk' : score <= 60 ? 'Moderate Risk' : 'High Risk'

  const radius = 44
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  if (loading) {
    return <div className="skeleton h-64 rounded-xl" />
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
      <div className="mb-4 flex items-start gap-5">
        {/* Ring gauge */}
        <div className="relative shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-bg-elevated)" strokeWidth="7" />
            <circle
              cx="50" cy="50" r={radius} fill="none" stroke={ringColorHex} strokeWidth="7"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('font-financial text-xl font-bold', scoreColor)}>{score}</span>
            <span className="text-[8px] text-text-tertiary">/ 100</span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <Shield className={cn('h-4 w-4', scoreColor)} />
            <h3 className="text-sm font-semibold text-text-primary">ATO Audit Risk</h3>
          </div>
          <p className={cn('mt-0.5 text-xs font-semibold', scoreColor)}>{label}</p>
          <p className="mt-1 text-[11px] text-text-tertiary">
            Based on deduction ratios, GST consistency, and ATO benchmarks for ANZSIC 4614
          </p>
        </div>
      </div>

      {/* Risk factors */}
      <div className="space-y-2">
        {factors.map((f, i) => (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
              f.severity === 'high' ? 'bg-surface-red' : f.severity === 'medium' ? 'bg-surface-amber' : 'bg-surface-green'
            )}
          >
            {f.severity === 'high' ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-red" />
            ) : f.severity === 'medium' ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-amber" />
            ) : (
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-green" />
            )}
            <div>
              <p className="font-medium text-text-primary">{f.label}</p>
              <p className="text-text-secondary">{f.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
