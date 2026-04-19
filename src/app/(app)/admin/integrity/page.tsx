'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, RefreshCcw, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { runAllIntegrityChecks, scoreFromChecks, type CheckResult, type CheckStatus } from '@/lib/integrity-checks'

const STATUS_STYLE: Record<CheckStatus, { pill: string; label: string }> = {
  pass: { pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', label: 'Pass' },
  warn: { pill: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', label: 'Warn' },
  fail: { pill: 'bg-red-50 text-red-700 ring-1 ring-red-200', label: 'Fail' },
  info: { pill: 'bg-slate-50 text-slate-700 ring-1 ring-slate-200', label: 'Info' },
}

function scoreTone(score: number): { label: string; fg: string; bg: string } {
  if (score >= 95) return { label: 'Healthy', fg: 'text-emerald-700', bg: 'bg-emerald-50' }
  if (score >= 80) return { label: 'Watch', fg: 'text-amber-700', bg: 'bg-amber-50' }
  return { label: 'Action required', fg: 'text-red-700', bg: 'bg-red-50' }
}

export default function IntegrityPage() {
  const [checks, setChecks] = useState<CheckResult[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const results = await runAllIntegrityChecks()
      setChecks(results)
      setLastRun(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    run()
  }, [run])

  const score = scoreFromChecks(checks)
  const tone = scoreTone(score)
  const fails = checks.filter((c) => c.status === 'fail').length
  const warns = checks.filter((c) => c.status === 'warn').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Integrity</h1>
          <p className="text-sm text-text-secondary">
            Rod&rsquo;s self-audit layer. Runs arithmetic reconciliations against every module that
            feeds a tax or BAS figure.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
          {loading ? 'Running…' : 'Re-run checks'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-bg-primary p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {score >= 95 ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
            )}
            Integrity score
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-financial text-3xl font-bold tabular-nums text-text-primary">{score}</span>
            <span className="text-sm text-text-tertiary">/ 100</span>
          </div>
          <div className={cn('mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', tone.bg, tone.fg)}>
            {tone.label}
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-primary p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Open issues
          </div>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <div className="font-financial text-2xl font-bold tabular-nums text-red-700">{fails}</div>
              <div className="text-[11px] text-text-tertiary">failing</div>
            </div>
            <div>
              <div className="font-financial text-2xl font-bold tabular-nums text-amber-700">{warns}</div>
              <div className="text-[11px] text-text-tertiary">warning</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-primary p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Last run</div>
          <div className="mt-2 font-financial text-lg font-semibold tabular-nums text-text-primary">
            {lastRun ? lastRun.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
          </div>
          <p className="mt-2 text-[11px] text-text-tertiary">
            Runs on demand. Nightly cron lands with Phase 4.1 (anomaly detection).
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm">
        <ul className="divide-y divide-border-subtle">
          {checks.length === 0 && loading && (
            <li className="p-6 text-sm text-text-tertiary">Loading checks…</li>
          )}
          {checks.map((c) => {
            const isOpen = expanded[c.id] ?? (c.status === 'fail' || c.status === 'warn')
            const style = STATUS_STYLE[c.status]
            return (
              <li key={c.id} className="px-5 py-4">
                <button
                  className="flex w-full items-start justify-between gap-4 text-left"
                  onClick={() => setExpanded((e) => ({ ...e, [c.id]: !isOpen }))}
                >
                  <div className="flex items-start gap-3">
                    {isOpen ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.75} />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.75} />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{c.title}</span>
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', style.pill)}>
                          {style.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-text-secondary">{c.detail}</p>
                    </div>
                  </div>
                </button>

                {isOpen && (c.expected || c.actual || c.rows?.length) && (
                  <div className="mt-3 ml-7 space-y-3">
                    {(c.expected || c.actual) && (
                      <div className="grid grid-cols-2 gap-3 rounded-lg bg-bg-elevated px-3 py-2 text-[12px]">
                        {c.expected && (
                          <div>
                            <div className="text-text-tertiary">Expected</div>
                            <div className="font-financial font-semibold tabular-nums text-text-primary">{c.expected}</div>
                          </div>
                        )}
                        {c.actual && (
                          <div>
                            <div className="text-text-tertiary">Actual</div>
                            <div className="font-financial font-semibold tabular-nums text-text-primary">{c.actual}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {c.rows && c.rows.length > 0 && <DetailTable rows={c.rows} />}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-border-subtle bg-bg-elevated p-4 text-[12px] text-text-secondary">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.75} />
        <div>
          This page runs read-only queries against Supabase. Any variance surfaced here is written to
          the <code className="rounded bg-bg-primary px-1 py-0.5 font-financial">bas_variance</code> and
          {' '}<code className="rounded bg-bg-primary px-1 py-0.5 font-financial">audit_log</code> tables
          created by migration{' '}
          <code className="rounded bg-bg-primary px-1 py-0.5 font-financial">0001_phase0_data_integrity.sql</code>.
        </div>
      </div>
    </div>
  )
}

function DetailTable({ rows }: { rows: Array<Record<string, string | number>> }) {
  const headers = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle">
      <table className="min-w-full divide-y divide-border-subtle text-[12px]">
        <thead className="bg-bg-elevated text-left">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary"
              >
                {h.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-bg-primary">
          {rows.map((r, i) => (
            <tr key={i}>
              {headers.map((h) => (
                <td
                  key={h}
                  className={cn(
                    'whitespace-nowrap px-3 py-2 text-text-primary',
                    typeof r[h] === 'string' && (r[h] as string).startsWith('$')
                      ? 'font-financial text-right tabular-nums'
                      : ''
                  )}
                >
                  {String(r[h])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
