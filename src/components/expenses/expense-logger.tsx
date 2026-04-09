'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateGST, formatCurrency } from '@/lib/utils'
import { Camera, Save, X } from 'lucide-react'

interface ExpenseLoggerProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

// Common expense categories with quick-select chips
const QUICK_CATEGORIES = [
  { code: '6-1010', label: 'Fuel', bizPct: 85 },
  { code: '6-2040', label: 'Phone', bizPct: 85 },
  { code: '6-2020', label: 'Bank Fee', bizPct: 100 },
  { code: '6-1030', label: 'Repairs', bizPct: 85 },
  { code: '6-4020', label: 'Travel', bizPct: 100 },
  { code: '6-2060', label: 'Office', bizPct: 100 },
]

export function ExpenseLogger({ open, onClose, onSaved }: ExpenseLoggerProps) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [categoryLabel, setCategoryLabel] = useState('')
  const [bizPct, setBizPct] = useState(100)
  const [note, setNote] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<{ id: string; code: string; name: string; business_use_pct: number | null }[]>([])
  const [showAllCategories, setShowAllCategories] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      loadAccounts()
      setTimeout(() => amountRef.current?.focus(), 200)
    }
  }, [open])

  async function loadAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('id, code, name, business_use_pct')
      .eq('type', 'expense')
      .eq('is_active', true)
      .order('sort_order')
    if (data) setAccounts(data)
  }

  function selectQuickCategory(cat: typeof QUICK_CATEGORIES[0]) {
    setCategory(cat.code)
    setCategoryLabel(cat.label)
    setBizPct(cat.bizPct)
    setShowAllCategories(false)
  }

  function selectAccount(acct: typeof accounts[0]) {
    setCategory(acct.code)
    setCategoryLabel(acct.name)
    setBizPct(acct.business_use_pct ?? 100)
    setShowAllCategories(false)
  }

  function handleReceiptCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  const numericAmount = parseFloat(amount) || 0
  const gst = calculateGST(numericAmount)
  const businessAmount = numericAmount * (bizPct / 100)

  async function handleSave() {
    if (numericAmount <= 0 || !category) return
    setSaving(true)

    // Find account ID
    const acct = accounts.find((a) => a.code === category)

    // Upload receipt if present
    let receiptUrl: string | null = null
    if (receiptFile) {
      const fileName = `receipts/${Date.now()}-${receiptFile.name}`
      const { data: upload } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile)
      if (upload) {
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName)
        receiptUrl = urlData?.publicUrl ?? null
      }
    }

    // Insert transaction
    await supabase.from('transactions').insert({
      date: new Date().toISOString().split('T')[0],
      description: note || categoryLabel,
      amount: -numericAmount, // expenses are negative
      gst_amount: -gst,
      account_id: acct?.id ?? null,
      business_use_pct: bizPct,
      is_personal: false,
      is_reviewed: true,
      receipt_url: receiptUrl,
      notes: note || null,
    })

    setSaving(false)
    // Reset form
    setAmount('')
    setCategory('')
    setCategoryLabel('')
    setBizPct(100)
    setNote('')
    setReceiptFile(null)
    setReceiptPreview(null)
    onSaved?.()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-secondary lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[420px] lg:border-l lg:border-border-subtle lg:shadow-2xl sheet-up lg:slide-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <button onClick={onClose} className="touch-target flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary active:bg-bg-elevated">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-semibold text-text-primary">Log Expense</h2>
        <span className="w-8" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {/* Amount */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold text-text-tertiary">Amount (inc GST)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-text-tertiary">$</span>
            <input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              className="w-full rounded-xl border border-border-subtle bg-bg-primary py-4 pl-9 pr-3 font-financial text-3xl font-bold text-text-primary placeholder-text-tertiary outline-none focus:border-accent-primary"
            />
          </div>
          {numericAmount > 0 && (
            <div className="mt-2 flex items-center justify-between px-1 text-xs text-text-tertiary">
              <span>GST: {formatCurrency(gst)}</span>
              <span>Business claim: {formatCurrency(businessAmount)} ({bizPct}%)</span>
            </div>
          )}
        </div>

        {/* Category chips */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold text-text-tertiary">Category</label>
          <div className="flex flex-wrap gap-2">
            {QUICK_CATEGORIES.map((cat) => (
              <button
                key={cat.code}
                onClick={() => selectQuickCategory(cat)}
                className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium transition-colors touch-target ${
                  category === cat.code
                    ? 'border-accent-primary bg-surface-blue text-accent-primary'
                    : 'border-border-subtle text-text-secondary active:bg-bg-elevated'
                }`}
              >
                {cat.label}
              </button>
            ))}
            <button
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="rounded-lg border border-border-subtle px-3.5 py-2.5 text-xs font-medium text-text-tertiary active:bg-bg-elevated touch-target"
            >
              Other...
            </button>
          </div>

          {/* Full category list */}
          {showAllCategories && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border-subtle bg-bg-primary">
              {accounts.map((acct) => (
                <button
                  key={acct.id}
                  onClick={() => selectAccount(acct)}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-xs transition-colors touch-target ${
                    category === acct.code ? 'bg-surface-blue text-accent-primary' : 'text-text-secondary active:bg-bg-elevated'
                  }`}
                >
                  <span>{acct.name}</span>
                  <span className="text-text-tertiary">{acct.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Receipt camera */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold text-text-tertiary">Receipt</label>
          {receiptPreview ? (
            <div className="relative">
              <img src={receiptPreview} alt="Receipt" className="h-32 w-full rounded-lg object-cover" />
              <button
                onClick={() => { setReceiptFile(null); setReceiptPreview(null) }}
                className="absolute right-2 top-2 rounded-full bg-bg-primary/80 p-1 text-text-tertiary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border-subtle px-4 py-4 text-sm text-text-secondary active:bg-bg-elevated transition-colors touch-target">
              <Camera className="h-5 w-5 text-accent-primary" />
              <span>Take Photo or Choose File</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleReceiptCapture}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Note */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-semibold text-text-tertiary">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. BP Toowong"
            className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-3 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-accent-primary"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border-subtle bg-bg-secondary px-4 py-3 safe-bottom">
        <button
          onClick={handleSave}
          disabled={saving || numericAmount <= 0 || !category}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-primary py-3.5 text-base font-semibold text-white active:scale-98 transition-transform disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : `Save Expense · ${formatCurrency(numericAmount)}`}
        </button>
      </div>
    </div>
  )
}
