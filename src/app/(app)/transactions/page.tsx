'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { CSVImport } from '@/components/transactions/csv-import'
import { TransactionDetail } from '@/components/transactions/transaction-detail'
import { StatusBadge } from '@/components/ui/status-badge'
import { Upload, Filter, CheckSquare, Tag, Eye, Search, Download, Bot } from 'lucide-react'
import type { Transaction, Account } from '@/types/database'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [search, setSearch] = useState('')
  const [filterReviewed, setFilterReviewed] = useState<boolean | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchCategory, setBatchCategory] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: txns }, { data: accts }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, account:accounts(*)')
        .order('date', { ascending: false }),
      supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
    ])
    setTransactions((txns as Transaction[]) || [])
    setAccounts((accts as Account[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = transactions.filter((t) => {
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false
    if (filterReviewed !== null && t.is_reviewed !== filterReviewed) return false
    if (filterCategory === 'uncategorised' && t.account_id !== null) return false
    if (filterCategory && filterCategory !== 'uncategorised' && t.account_id !== filterCategory) return false
    return true
  })

  function toggleSelect(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function selectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)))
    }
  }

  async function batchCategorise() {
    if (!batchCategory || selectedIds.size === 0) return
    const account = accounts.find((a) => a.id === batchCategory)
    const gstAmount = account?.tax_code === 'GST' ? undefined : 0
    await supabase
      .from('transactions')
      .update({
        account_id: batchCategory,
        business_use_pct: account?.business_use_pct ?? 100,
        is_reviewed: true,
      })
      .in('id', Array.from(selectedIds))
    setSelectedIds(new Set())
    setBatchCategory('')
    loadData()
  }

  async function batchMarkPersonal() {
    if (selectedIds.size === 0) return
    await supabase
      .from('transactions')
      .update({ is_personal: true, is_reviewed: true })
      .in('id', Array.from(selectedIds))
    setSelectedIds(new Set())
    loadData()
  }

  async function batchMarkReviewed() {
    if (selectedIds.size === 0) return
    await supabase
      .from('transactions')
      .update({ is_reviewed: true })
      .in('id', Array.from(selectedIds))
    setSelectedIds(new Set())
    loadData()
  }

  function exportCSV() {
    const headers = 'Date,Description,Amount,Category,GST,Business %,Reviewed,Personal'
    const rows = filtered.map((t) =>
      [
        t.date,
        `"${t.description}"`,
        t.amount,
        t.account?.name || '',
        t.gst_amount || 0,
        t.business_use_pct ?? 100,
        t.is_reviewed ? 'Yes' : 'No',
        t.is_personal ? 'Yes' : 'No',
      ].join(',')
    )
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const uncategorisedCount = transactions.filter((t) => !t.account_id && !t.is_personal).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Transactions</h1>
          <p className="text-sm text-text-secondary">
            {transactions.length} total · {uncategorisedCount} uncategorised
          </p>
        </div>
        <button
          onClick={() => setShowImport(!showImport)}
          className="flex items-center gap-2 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-bg-primary hover:brightness-110"
        >
          <Upload className="h-4 w-4" />
          Import CSV
        </button>
      </div>

      {/* CSV Import */}
      {showImport && (
        <CSVImport onImportComplete={() => { setShowImport(false); loadData() }} />
      )}

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="w-full rounded-lg border border-border-subtle bg-bg-secondary py-2.5 pl-9 pr-4 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-border-active"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-border-subtle bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none"
        >
          <option value="">All Categories</option>
          <option value="uncategorised">Uncategorised</option>
          {accounts.filter((a) => a.type === 'expense').map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          value={filterReviewed === null ? '' : filterReviewed ? 'reviewed' : 'unreviewed'}
          onChange={(e) => setFilterReviewed(e.target.value === '' ? null : e.target.value === 'reviewed')}
          className="rounded-lg border border-border-subtle bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none"
        >
          <option value="">All Status</option>
          <option value="reviewed">Reviewed</option>
          <option value="unreviewed">Unreviewed</option>
        </select>

        <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2.5 text-sm text-text-secondary hover:bg-bg-elevated">
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>

      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-accent-blue/20 bg-surface-blue px-4 py-3">
          <span className="text-sm font-medium text-accent-blue">{selectedIds.size} selected</span>
          <select
            value={batchCategory}
            onChange={(e) => setBatchCategory(e.target.value)}
            className="rounded-md border border-border-subtle bg-bg-primary px-2 py-1 text-xs text-text-primary"
          >
            <option value="">Categorise as...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
          {batchCategory && (
            <button onClick={batchCategorise} className="rounded-md bg-accent-green px-3 py-1 text-xs font-semibold text-bg-primary">
              Apply
            </button>
          )}
          <button onClick={batchMarkPersonal} className="rounded-md border border-border-subtle px-3 py-1 text-xs text-text-secondary hover:bg-bg-elevated">
            Mark Personal
          </button>
          <button onClick={batchMarkReviewed} className="rounded-md border border-border-subtle px-3 py-1 text-xs text-text-secondary hover:bg-bg-elevated">
            Mark Reviewed
          </button>
        </div>
      )}

      {/* Transaction Table */}
      <div className="rounded-xl border border-border-subtle bg-bg-secondary">
        {loading ? (
          <div className="p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton mb-2 h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={selectAll}
                      className="h-3.5 w-3.5 rounded accent-accent-blue"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Date</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Description</th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Amount</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Category</th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">GST</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Biz %</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-text-tertiary">
                      {transactions.length === 0
                        ? 'No transactions yet. Import a bank CSV to get started.'
                        : 'No transactions match your filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr
                      key={t.id}
                      className={cn(
                        'border-b border-border-subtle/50 transition-colors last:border-0',
                        'cursor-pointer hover:bg-bg-elevated',
                        t.is_personal && 'opacity-50'
                      )}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          className="h-3.5 w-3.5 rounded accent-accent-blue"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-financial text-sm text-text-secondary" onClick={() => setSelectedTxn(t)}>
                        {formatDate(t.date)}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2.5 text-sm text-text-primary" onClick={() => setSelectedTxn(t)}>
                        <div className="flex items-center gap-2">
                          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.amount > 0 ? 'bg-accent-green' : 'bg-accent-red'}`} />
                          {t.description}
                          {t.ai_category_suggestion && !t.is_reviewed && (
                            <Bot className="h-3 w-3 shrink-0 text-accent-purple" />
                          )}
                        </div>
                      </td>
                      <td className={cn('px-3 py-2.5 text-right font-financial text-sm', t.amount > 0 ? 'text-accent-green' : 'text-text-primary')} onClick={() => setSelectedTxn(t)}>
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="px-3 py-2.5 text-sm" onClick={() => setSelectedTxn(t)}>
                        {t.account ? (
                          <span className="text-text-secondary">{t.account.name}</span>
                        ) : t.is_personal ? (
                          <span className="text-text-tertiary italic">Personal</span>
                        ) : (
                          <span className="text-accent-amber">Uncategorised</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-financial text-sm text-text-secondary" onClick={() => setSelectedTxn(t)}>
                        {t.gst_amount ? formatCurrency(t.gst_amount) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-financial text-sm text-text-secondary" onClick={() => setSelectedTxn(t)}>
                        {t.business_use_pct ?? 100}%
                      </td>
                      <td className="px-3 py-2.5 text-center" onClick={() => setSelectedTxn(t)}>
                        {t.is_reviewed ? (
                          <StatusBadge label="Reviewed" variant="success" size="sm" />
                        ) : (
                          <StatusBadge label="Pending" variant="warning" size="sm" />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border-subtle px-4 py-2 text-xs text-text-tertiary">
          {filtered.length} of {transactions.length} transactions
        </div>
      </div>

      {/* Detail Panel */}
      {selectedTxn && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedTxn(null)} />
          <TransactionDetail
            transaction={selectedTxn}
            accounts={accounts}
            onClose={() => setSelectedTxn(null)}
            onUpdate={loadData}
          />
        </>
      )}
    </div>
  )
}
