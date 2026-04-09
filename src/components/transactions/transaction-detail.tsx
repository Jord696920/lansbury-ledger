'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, calculateGST, cn } from '@/lib/utils'
import { X, Bot, Check, Upload, Shield, Loader2 } from 'lucide-react'
import type { Transaction, Account } from '@/types/database'

interface TransactionDetailProps {
  transaction: Transaction
  accounts: Account[]
  onClose: () => void
  onUpdate: () => void
}

interface DeductionAdvice {
  deductible: boolean
  confidence: string
  ato_reference: string
  explanation: string
  risk_level: string
  suggested_business_pct: number
}

export function TransactionDetail({ transaction, accounts, onClose, onUpdate }: TransactionDetailProps) {
  const [accountId, setAccountId] = useState(transaction.account_id || '')
  const [businessPct, setBusinessPct] = useState(transaction.business_use_pct ?? 100)
  const [gstAmount, setGstAmount] = useState(transaction.gst_amount ?? 0)
  const [notes, setNotes] = useState(transaction.notes || '')
  const [isPersonal, setIsPersonal] = useState(transaction.is_personal)
  const [saving, setSaving] = useState(false)
  const [accountSearch, setAccountSearch] = useState('')
  const [deductionAdvice, setDeductionAdvice] = useState<DeductionAdvice | null>(null)
  const [checkingDeduction, setCheckingDeduction] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus trap — move focus to panel on open
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  const filteredAccounts = accounts.filter((a) =>
    accountSearch === '' ||
    a.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
    a.code.toLowerCase().includes(accountSearch.toLowerCase())
  )

  // Auto-calculate GST when category changes
  useEffect(() => {
    const account = accounts.find((a) => a.id === accountId)
    if (account) {
      setBusinessPct(account.business_use_pct ?? 100)
      if (account.tax_code === 'GST') {
        setGstAmount(calculateGST(Math.abs(transaction.amount)))
      } else {
        setGstAmount(0)
      }
    }
  }, [accountId, accounts, transaction.amount])

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('transactions')
      .update({
        account_id: accountId || null,
        business_use_pct: businessPct,
        gst_amount: gstAmount,
        notes: notes || null,
        is_personal: isPersonal,
        is_reviewed: true,
      })
      .eq('id', transaction.id)

    setSaving(false)
    if (!error) {
      onUpdate()
      onClose()
    }
  }

  function acceptAISuggestion() {
    if (!transaction.ai_category_suggestion) return
    const account = accounts.find(
      (a) => a.code === transaction.ai_category_suggestion || a.name === transaction.ai_category_suggestion
    )
    if (account) setAccountId(account.id)
  }

  async function checkDeductible() {
    setCheckingDeduction(true)
    try {
      const res = await fetch('/api/ai/deduction-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: {
            description: transaction.description,
            amount: transaction.amount,
            date: transaction.date,
            category: accounts.find((a) => a.id === accountId)?.name ?? 'Unknown',
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setDeductionAdvice(data)
      }
    } catch {
      // silent
    } finally {
      setCheckingDeduction(false)
    }
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border-subtle bg-bg-secondary shadow-2xl slide-in outline-none"
      role="dialog"
      aria-label="Transaction detail"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Transaction Detail</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary" aria-label="Close panel">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-y-auto p-5" style={{ height: 'calc(100% - 130px)' }}>
        {/* Summary */}
        <div className="mb-6 rounded-lg bg-bg-elevated p-4">
          <p className="text-sm text-text-secondary">{transaction.description}</p>
          <p className={cn('mt-1 font-financial text-2xl font-bold', transaction.amount > 0 ? 'text-accent-green' : 'text-text-primary')}>
            {formatCurrency(transaction.amount)}
          </p>
          <p className="mt-1 text-xs text-text-tertiary">{formatDate(transaction.date)}</p>
        </div>

        {/* AI Suggestion */}
        {transaction.ai_category_suggestion && !transaction.is_reviewed && (
          <div className="mb-4 rounded-lg border border-accent-purple/20 bg-surface-purple p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-accent-purple">
              <Bot className="h-4 w-4" aria-hidden="true" />
              AI Suggestion ({((transaction.ai_confidence ?? 0) * 100).toFixed(0)}% confidence)
            </div>
            <p className="mt-1 text-sm text-text-primary">{transaction.ai_category_suggestion}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={acceptAISuggestion} className="btn-press flex items-center gap-1 rounded-md bg-accent-purple px-3 py-1 text-xs font-medium text-white hover:brightness-110">
                <Check className="h-3 w-3" aria-hidden="true" /> Accept
              </button>
            </div>
          </div>
        )}

        {/* Personal Toggle */}
        <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-lg border border-border-subtle p-3 transition-colors hover:bg-bg-elevated">
          <input
            type="checkbox"
            checked={isPersonal}
            onChange={(e) => setIsPersonal(e.target.checked)}
            className="h-4 w-4 rounded border-border-subtle accent-accent-red"
          />
          <div>
            <span className="text-sm font-medium text-text-primary">Personal Expense</span>
            <p className="text-[11px] text-text-tertiary">Not deductible — exclude from business</p>
          </div>
        </label>

        {/* Category Selector */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-text-tertiary">Category</label>
          <input
            type="text"
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
            placeholder="Search categories..."
            className="mb-2 w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-border-active"
          />
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border-subtle">
            {filteredAccounts.map((a) => (
              <button
                key={a.id}
                onClick={() => { setAccountId(a.id); setAccountSearch('') }}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-bg-elevated',
                  accountId === a.id && 'bg-bg-elevated text-accent-green'
                )}
              >
                <span className="text-text-primary">{a.name}</span>
                <span className="font-financial text-[11px] text-text-tertiary">{a.code}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Business Use Slider */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-text-tertiary">Business Use %</label>
            <span className="font-financial text-sm font-semibold text-text-primary">{businessPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={businessPct}
            onChange={(e) => setBusinessPct(Number(e.target.value))}
            className="w-full accent-accent-green"
            aria-label="Business use percentage"
          />
        </div>

        {/* GST Amount */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-text-tertiary">GST Amount</label>
            <span className="font-financial text-sm text-text-secondary">{formatCurrency(gstAmount)}</span>
          </div>
          <input
            type="number"
            value={gstAmount}
            onChange={(e) => setGstAmount(Math.max(0, Number(e.target.value)))}
            step="0.01"
            min="0"
            className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 font-financial text-sm text-text-primary outline-none focus:border-border-active"
          />
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-text-tertiary">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-border-active"
            placeholder="Add notes..."
          />
        </div>

        {/* Receipt Upload */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-text-tertiary">Receipt</label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle px-4 py-5 text-sm text-text-tertiary transition-colors hover:border-border-active hover:text-text-secondary">
            <Upload className="h-5 w-5" aria-hidden="true" />
            <span>Upload receipt</span>
            <input type="file" accept="image/*,.pdf" className="hidden" />
          </label>
        </div>

        {/* Is This Deductible? */}
        <div className="mb-4">
          <button
            onClick={checkDeductible}
            disabled={checkingDeduction}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-lg border border-accent-purple/30 bg-surface-purple px-4 py-2.5 text-sm font-medium text-accent-purple transition-colors hover:brightness-110 disabled:opacity-60"
          >
            {checkingDeduction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {checkingDeduction ? 'Checking...' : 'Is this deductible?'}
          </button>

          {deductionAdvice && (
            <div className={cn(
              'mt-3 rounded-lg border p-3 text-sm',
              deductionAdvice.deductible ? 'border-accent-green/20 bg-surface-green' : 'border-accent-red/20 bg-surface-red'
            )}>
              <div className="mb-1 flex items-center gap-2">
                <span className={cn('text-xs font-bold', deductionAdvice.deductible ? 'text-accent-green' : 'text-accent-red')}>
                  {deductionAdvice.deductible ? 'DEDUCTIBLE' : 'NOT DEDUCTIBLE'}
                </span>
                <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-tertiary">
                  {deductionAdvice.confidence} confidence
                </span>
                {deductionAdvice.ato_reference && (
                  <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] text-accent-blue">
                    {deductionAdvice.ato_reference}
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-text-secondary">{deductionAdvice.explanation}</p>
              {deductionAdvice.risk_level && (
                <p className="mt-1 text-[10px] text-text-tertiary">
                  Audit risk: <span className={cn(
                    deductionAdvice.risk_level === 'low' ? 'text-accent-green' : deductionAdvice.risk_level === 'high' ? 'text-accent-red' : 'text-accent-amber'
                  )}>{deductionAdvice.risk_level}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-border-subtle bg-bg-secondary px-5 py-3">
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-press flex-1 rounded-lg border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-elevated">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-press flex-1 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-bg-primary hover:brightness-110 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
