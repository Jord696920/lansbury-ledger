'use client'

import { useState, useEffect, useCallback } from 'react'
import { getEmailReceipts, insertEmailReceipt, updateEmailReceipt, getAccounts } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import {
  Mail, Plus, CheckCircle2, X, AlertTriangle, Loader2,
  Trash2, ExternalLink, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react'
import type { EmailReceipt, Account } from '@/types/database'

interface ParseResult {
  vendor: string | null
  amount: number | null
  gst: number | null
  date: string | null
  description: string | null
  category: string | null
  business_use_pct: number
  confidence: number
  notes: string | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending review',
  matched: 'Matched to transaction',
  created: 'Transaction created',
  ignored: 'Ignored',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-surface-amber text-accent-amber',
  matched: 'bg-surface-green text-accent-green',
  created: 'bg-surface-blue text-accent-primary',
  ignored: 'bg-bg-elevated text-text-tertiary',
}

function confidenceBadge(c: number | null) {
  if (c === null) return null
  const color = c >= 80 ? 'text-accent-green' : c >= 60 ? 'text-accent-amber' : 'text-accent-red'
  return <span className={`text-[10px] font-semibold ${color}`}>{c}% confidence</span>
}

export default function EmailReceiptsPage() {
  const [receipts, setReceipts] = useState<EmailReceipt[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Paste form state
  const [showPaste, setShowPaste] = useState(false)
  const [pasteBody, setPasteBody] = useState('')
  const [pasteSubject, setPasteSubject] = useState('')
  const [pasteFrom, setPasteFrom] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [editResult, setEditResult] = useState<ParseResult | null>(null)
  const [saving, setSaving] = useState(false)

  // Accordion
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, accts] = await Promise.all([
        getEmailReceipts(),
        getAccounts(),
      ])
      setReceipts(r)
      setAccounts(accts.filter(a => a.type === 'expense'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleParse() {
    if (!pasteBody.trim()) {
      setError('Paste the email body first.')
      return
    }
    setParsing(true)
    setError(null)
    setParseResult(null)
    try {
      const res = await fetch('/api/email/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_body: pasteBody,
          email_subject: pasteSubject || null,
          email_from: pasteFrom || null,
          email_date: null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Parse failed')
      setParseResult(json.parsed)
      setEditResult({ ...json.parsed })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  async function handleSaveReceipt() {
    if (!editResult) return
    setSaving(true)
    setError(null)
    try {
      const acct = editResult.category
        ? accounts.find(a => a.name.toLowerCase().includes((editResult.category ?? '').toLowerCase()))
        : null

      await insertEmailReceipt({
        email_subject: pasteSubject || null,
        email_from: pasteFrom || null,
        email_date: null,
        raw_body: pasteBody,
        parsed_vendor: editResult.vendor,
        parsed_amount: editResult.amount,
        parsed_gst: editResult.gst,
        parsed_date: editResult.date,
        parsed_description: editResult.description,
        parsed_category: editResult.category,
        transaction_id: null,
        account_id: acct?.id ?? null,
        business_use_pct: editResult.business_use_pct,
        status: 'pending',
        ai_confidence: editResult.confidence,
        ai_raw_response: JSON.stringify(parseResult),
      })
      setShowPaste(false)
      setPasteBody('')
      setPasteSubject('')
      setPasteFrom('')
      setParseResult(null)
      setEditResult(null)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateStatus(id: string, status: EmailReceipt['status']) {
    try {
      await updateEmailReceipt(id, { status })
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const pending  = receipts.filter(r => r.status === 'pending')
  const reviewed = receipts.filter(r => r.status !== 'pending')

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Email Receipts</h1>
          <p className="text-sm text-text-secondary">Paste expense emails · AI extracts vendor, amount, GST</p>
        </div>
        <button
          onClick={() => { setShowPaste(true); setParseResult(null); setEditResult(null); setPasteBody(''); setPasteSubject(''); setPasteFrom('') }}
          className="flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Receipt
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-surface-red px-4 py-3 text-sm text-accent-red">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* How it works */}
      {receipts.length === 0 && !loading && !showPaste && (
        <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-primary p-8 text-center">
          <Mail className="mx-auto mb-3 h-10 w-10 text-text-tertiary" />
          <h3 className="text-sm font-semibold text-text-primary">No receipts yet</h3>
          <p className="mt-1 text-xs text-text-secondary max-w-sm mx-auto">
            Forward expense emails here or paste the text. Claude extracts vendor, amount, GST component, and suggests the ATO category — no manual entry required.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-left max-w-md mx-auto">
            {[
              { step: '1', label: 'Paste email', desc: 'Copy the receipt email body and paste it in' },
              { step: '2', label: 'AI parses it', desc: 'Claude extracts all tax-relevant fields instantly' },
              { step: '3', label: 'Save & match', desc: 'Save to receipts, then match to a bank transaction' },
            ].map(s => (
              <div key={s.step} className="rounded-xl border border-border-subtle p-3">
                <div className="mb-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-primary text-[10px] font-bold text-white">{s.step}</div>
                <p className="text-xs font-semibold text-text-primary">{s.label}</p>
                <p className="mt-0.5 text-[10px] text-text-tertiary">{s.desc}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowPaste(true)}
            className="mt-6 rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Paste first receipt
          </button>
        </div>
      )}

      {/* Paste & parse panel */}
      {showPaste && (
        <div className="rounded-2xl border border-border-subtle bg-bg-primary p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-primary" />
              Parse New Receipt
            </h2>
            <button onClick={() => setShowPaste(false)}><X className="h-4 w-4 text-text-tertiary" /></button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Email subject (optional)</label>
                <input className="input w-full" placeholder="Receipt from AUTOGRAB" value={pasteSubject} onChange={e => setPasteSubject(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">From (optional)</label>
                <input className="input w-full" placeholder="noreply@autograb.com.au" value={pasteFrom} onChange={e => setPasteFrom(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Email body / receipt text <span className="text-accent-red">*</span>
              </label>
              <textarea
                className="input w-full resize-none font-mono text-xs"
                rows={8}
                placeholder="Paste the full email body here — including any dollar amounts, dates, vendor name, and GST breakdown if shown…"
                value={pasteBody}
                onChange={e => setPasteBody(e.target.value)}
              />
            </div>
            <button
              onClick={handleParse}
              disabled={parsing || !pasteBody.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {parsing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Parsing with Claude…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Parse with AI</>
              )}
            </button>
          </div>

          {/* Parse result — editable */}
          {editResult && (
            <div className="mt-5 rounded-xl border border-border-subtle bg-bg-elevated p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-text-primary">Extracted fields — review and correct</p>
                {confidenceBadge(editResult.confidence)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-text-tertiary">Vendor</label>
                  <input className="input w-full text-xs" value={editResult.vendor ?? ''} onChange={e => setEditResult(r => r ? { ...r, vendor: e.target.value } : r)} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-text-tertiary">Date</label>
                  <input type="date" className="input w-full text-xs" value={editResult.date ?? ''} onChange={e => setEditResult(r => r ? { ...r, date: e.target.value } : r)} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-text-tertiary">Amount (inc GST)</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary">$</span>
                    <input type="number" step="0.01" className="input w-full pl-5 text-xs" value={editResult.amount ?? ''} onChange={e => setEditResult(r => r ? { ...r, amount: parseFloat(e.target.value) || null } : r)} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-text-tertiary">GST</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary">$</span>
                    <input type="number" step="0.01" className="input w-full pl-5 text-xs" value={editResult.gst ?? ''} onChange={e => setEditResult(r => r ? { ...r, gst: parseFloat(e.target.value) || null } : r)} />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[10px] font-medium text-text-tertiary">Description</label>
                  <input className="input w-full text-xs" value={editResult.description ?? ''} onChange={e => setEditResult(r => r ? { ...r, description: e.target.value } : r)} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-text-tertiary">ATO Category</label>
                  <input className="input w-full text-xs" value={editResult.category ?? ''} onChange={e => setEditResult(r => r ? { ...r, category: e.target.value } : r)} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-text-tertiary">Business use %</label>
                  <input type="number" min="0" max="100" className="input w-full text-xs" value={editResult.business_use_pct} onChange={e => setEditResult(r => r ? { ...r, business_use_pct: parseFloat(e.target.value) || 0 } : r)} />
                </div>
              </div>

              {editResult.notes && (
                <div className="mt-3 rounded-lg bg-surface-amber px-3 py-2 text-[10px] text-accent-amber">
                  <strong>AI note:</strong> {editResult.notes}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button onClick={() => { setParseResult(null); setEditResult(null) }} className="flex-1 rounded-xl border border-border-subtle py-2 text-xs font-medium text-text-secondary hover:bg-bg-elevated">
                  Discard
                </button>
                <button
                  onClick={handleSaveReceipt}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-accent-primary py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save receipt'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending receipts */}
      {pending.length > 0 && (
        <div className="rounded-2xl border border-border-subtle bg-bg-primary p-4 lg:p-5">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            Pending Review
            <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-amber text-[10px] font-bold text-white">
              {pending.length}
            </span>
          </h2>
          <div className="space-y-2">
            {pending.map(r => (
              <ReceiptRow
                key={r.id}
                receipt={r}
                accounts={accounts}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(e => e === r.id ? null : r.id)}
                onStatusChange={handleUpdateStatus}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reviewed receipts */}
      {reviewed.length > 0 && (
        <div className="rounded-2xl border border-border-subtle bg-bg-primary p-4 lg:p-5">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Processed</h2>
          <div className="space-y-2">
            {reviewed.slice(0, 20).map(r => (
              <ReceiptRow
                key={r.id}
                receipt={r}
                accounts={accounts}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(e => e === r.id ? null : r.id)}
                onStatusChange={handleUpdateStatus}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ReceiptRow({
  receipt, accounts, expanded, onToggle, onStatusChange,
}: {
  receipt: EmailReceipt
  accounts: Account[]
  expanded: boolean
  onToggle: () => void
  onStatusChange: (id: string, status: EmailReceipt['status']) => void
}) {
  const linkedAccount = accounts.find(a => a.id === receipt.account_id)

  return (
    <div className="rounded-xl border border-border-subtle overflow-hidden">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-bg-elevated transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-text-primary">
              {receipt.parsed_vendor ?? receipt.email_from ?? 'Unknown vendor'}
            </p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[receipt.status]}`}>
              {STATUS_LABELS[receipt.status]}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-text-tertiary">
              {receipt.parsed_date ? format(parseISO(receipt.parsed_date), 'd MMM yyyy') : 'No date'}
              {receipt.parsed_category && <span className="ml-2">· {receipt.parsed_category}</span>}
            </p>
          </div>
        </div>
        <div className="ml-2 shrink-0 text-right">
          {receipt.parsed_amount !== null && (
            <p className="font-financial text-sm font-semibold text-text-primary">
              {formatCurrency(receipt.parsed_amount)}
            </p>
          )}
          {receipt.parsed_gst !== null && (
            <p className="text-[10px] text-text-tertiary">GST {formatCurrency(receipt.parsed_gst)}</p>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-text-tertiary" /> : <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />}
      </button>

      {expanded && (
        <div className="border-t border-border-subtle bg-bg-elevated px-4 py-3 space-y-3">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {receipt.parsed_description && (
              <div className="col-span-2">
                <span className="text-text-tertiary">Description: </span>
                <span className="text-text-primary">{receipt.parsed_description}</span>
              </div>
            )}
            {receipt.email_subject && (
              <div className="col-span-2">
                <span className="text-text-tertiary">Subject: </span>
                <span className="text-text-secondary">{receipt.email_subject}</span>
              </div>
            )}
            {receipt.email_from && (
              <div>
                <span className="text-text-tertiary">From: </span>
                <span className="text-text-secondary">{receipt.email_from}</span>
              </div>
            )}
            {receipt.business_use_pct !== null && (
              <div>
                <span className="text-text-tertiary">Business use: </span>
                <span className="text-text-primary">{receipt.business_use_pct}%</span>
              </div>
            )}
            {linkedAccount && (
              <div>
                <span className="text-text-tertiary">Account: </span>
                <span className="text-text-primary">{linkedAccount.name}</span>
              </div>
            )}
            {receipt.ai_confidence !== null && (
              <div>{confidenceBadge(receipt.ai_confidence)}</div>
            )}
          </div>

          {/* Action buttons */}
          {receipt.status === 'pending' && (
            <div className="flex gap-2">
              <button
                onClick={() => onStatusChange(receipt.id, 'created')}
                className="flex items-center gap-1 rounded-lg bg-surface-green px-3 py-1.5 text-xs font-semibold text-accent-green hover:opacity-90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark as created
              </button>
              <button
                onClick={() => onStatusChange(receipt.id, 'matched')}
                className="flex items-center gap-1 rounded-lg bg-surface-blue px-3 py-1.5 text-xs font-semibold text-accent-primary hover:opacity-90"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Matched to txn
              </button>
              <button
                onClick={() => onStatusChange(receipt.id, 'ignored')}
                className="ml-auto flex items-center gap-1 rounded-lg bg-bg-elevated px-3 py-1.5 text-xs text-text-tertiary hover:text-text-secondary"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Ignore
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
