'use client'

import { useState } from 'react'
import { formatCurrency, cn } from '@/lib/utils'
import { MessageSquare, RefreshCw, Sparkles } from 'lucide-react'

interface RodBrief {
  brief: string
  generatedAt: string
  context: {
    ytdRevenue: number
    last3moRevenue: number
    eofyDays: number
  }
}

export function RodSays() {
  const [brief, setBrief] = useState<RodBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchBrief() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/rod-says')
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to generate brief')
        return
      }
      const data: RodBrief = await res.json()
      setBrief(data)
    } catch {
      setError('Network error — could not reach Rod')
    } finally {
      setLoading(false)
    }
  }

  // Not yet loaded — show prompt to generate
  if (!brief && !loading && !error) {
    return (
      <div className="rounded-xl border border-accent-purple/20 bg-bg-secondary p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-accent-purple" />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Rod Says</h3>
              <p className="text-[11px] text-text-tertiary">AI-powered weekly business brief</p>
            </div>
          </div>
          <button
            onClick={fetchBrief}
            className="flex items-center gap-1.5 rounded-lg bg-accent-purple px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Brief
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-accent-purple/20 bg-bg-secondary p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-accent-purple" />
          <h3 className="text-sm font-semibold text-text-primary">Rod Says</h3>
        </div>
        <button
          onClick={fetchBrief}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-4/5 rounded" />
          <div className="skeleton h-4 w-3/5 rounded" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-surface-red px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      {brief && !loading && (
        <>
          <div className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
            {brief.brief}
          </div>
          {brief.context && (
            <div className="mt-3 flex gap-4 border-t border-border-subtle pt-3 font-financial text-[10px] text-text-tertiary">
              <span>YTD: {formatCurrency(brief.context.ytdRevenue)}</span>
              <span>Last 3mo: {formatCurrency(brief.context.last3moRevenue)}</span>
              {brief.context.eofyDays <= 120 && (
                <span className="text-accent-amber">{brief.context.eofyDays}d to EOFY</span>
              )}
            </div>
          )}
          <p className="mt-2 text-[9px] text-text-tertiary">
            Generated {new Date(brief.generatedAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </>
      )}
    </div>
  )
}
