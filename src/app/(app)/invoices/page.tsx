'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { InvoiceDetail } from '@/components/invoices/invoice-detail'
import { StatusBadge, invoiceStatusVariant } from '@/components/ui/status-badge'
import { Plus, DollarSign, AlertCircle, Clock, Search, Check, Copy } from 'lucide-react'
import type { Invoice } from '@/types/database'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [duplicateData, setDuplicateData] = useState<{ amount?: number; terms?: string } | undefined>()

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('invoices')
      .select('*, lines:invoice_lines(*)')
      .order('issue_date', { ascending: false })
    if (filterStatus) query = query.eq('status', filterStatus)
    const { data } = await query
    setInvoices((data as Invoice[]) || [])
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  function handleInvoiceClick(invoice: Invoice) {
    setSelectedInvoice(invoice)
  }

  function handleDuplicate(inv: Invoice) {
    setSelectedInvoice(null)
    setDuplicateData({ amount: inv.total, terms: inv.notes?.replace('Terms: ', '') })
    setShowForm(true)
  }

  function handleEdit(inv: Invoice) {
    // For now, duplicate is the edit flow — open form pre-filled
    setSelectedInvoice(null)
    setDuplicateData({ amount: inv.total, terms: inv.notes?.replace('Terms: ', '') })
    setShowForm(true)
  }

  function handleFormSaved(invoice?: Invoice) {
    setShowForm(false)
    setDuplicateData(undefined)
    loadInvoices()
    // Auto-open detail view for the new invoice
    if (invoice) setSelectedInvoice(invoice)
  }

  function handleDetailUpdated() {
    loadInvoices()
    // Refresh selected invoice data
    if (selectedInvoice) {
      supabase.from('invoices').select('*, lines:invoice_lines(*)').eq('id', selectedInvoice.id).single()
        .then(({ data }) => {
          if (data) setSelectedInvoice(data as Invoice)
          else setSelectedInvoice(null) // deleted
        })
    }
  }

  // Filter by search query
  const filtered = searchQuery
    ? invoices.filter((i) =>
        i.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.lines?.some(l => l.description.toLowerCase().includes(searchQuery.toLowerCase())))
      )
    : invoices

  // Summary stats — outstanding excludes paid, void, draft
  const totalOutstanding = invoices
    .filter((i) => ['sent', 'viewed', 'overdue'].includes(i.status))
    .reduce((s, i) => s + i.total, 0)
  const totalOverdue = invoices
    .filter((i) => i.status === 'overdue')
    .reduce((s, i) => s + i.total, 0)
  const paidThisMonth = invoices
    .filter((i) => {
      if (i.status !== 'paid' || !i.payment_date) return false
      const pm = new Date(i.payment_date)
      const now = new Date()
      return pm.getMonth() === now.getMonth() && pm.getFullYear() === now.getFullYear()
    })
    .reduce((s, i) => s + i.total, 0)

  const statusDotColor: Record<string, string> = {
    paid: 'bg-accent-green',
    sent: 'bg-accent-blue',
    viewed: 'bg-accent-blue',
    overdue: 'bg-accent-red',
    draft: 'bg-text-tertiary',
    void: 'bg-text-tertiary',
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary lg:text-2xl">Invoices</h1>
          <p className="text-xs text-text-secondary lg:text-sm">{invoices.length} invoices</p>
        </div>
        <button
          onClick={() => { setDuplicateData(undefined); setShowForm(true) }}
          className="hidden items-center gap-2 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-bg-primary hover:brightness-110 lg:flex"
        >
          <Plus className="h-4 w-4" />
          New Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <div className="rounded-xl border border-border-subtle bg-bg-secondary p-3 lg:p-4">
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary lg:text-xs">
            <DollarSign className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
            Outstanding
          </div>
          <p className="mt-1 font-financial text-base font-bold text-text-primary lg:text-xl">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-secondary p-3 lg:p-4">
          <div className="flex items-center gap-1.5 text-[10px] text-accent-red lg:text-xs">
            <AlertCircle className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
            Overdue
          </div>
          <p className="mt-1 font-financial text-base font-bold text-accent-red lg:text-xl">{formatCurrency(totalOverdue)}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-border-subtle bg-bg-secondary p-3 lg:col-span-1 lg:p-4">
          <div className="flex items-center gap-1.5 text-[10px] text-accent-green lg:text-xs">
            <Clock className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
            Paid This Month
          </div>
          <p className="mt-1 font-financial text-base font-bold text-accent-green lg:text-xl">{formatCurrency(paidThisMonth)}</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="sticky top-0 z-10 -mx-4 bg-bg-primary px-4 pb-2 pt-1 lg:static lg:mx-0 lg:bg-transparent lg:p-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoices..."
            className="w-full rounded-lg border border-border-subtle bg-bg-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-accent-primary"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {['', 'draft', 'sent', 'paid', 'overdue'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors touch-target',
              filterStatus === status
                ? 'bg-accent-primary text-white'
                : 'bg-bg-elevated text-text-secondary active:bg-bg-hover'
            )}
          >
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl lg:h-14" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <p className="text-sm text-text-tertiary">
            {searchQuery ? 'No invoices match your search' : 'No invoices yet'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((inv) => (
              <div
                key={inv.id}
                onClick={() => handleInvoiceClick(inv)}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-border-subtle bg-bg-secondary px-4 py-3 active:scale-[0.98] transition-transform"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-financial text-xs font-medium text-accent-primary">{inv.invoice_number}</span>
                    <span className="font-financial text-base font-bold text-text-primary">{formatCurrency(inv.total)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-xs text-text-secondary">{inv.client_name}</span>
                    <div className="flex items-center gap-1">
                      <div className={cn('h-1.5 w-1.5 rounded-full', statusDotColor[inv.status] ?? 'bg-text-tertiary')} />
                      <span className="text-[10px] capitalize text-text-tertiary">{inv.status}</span>
                    </div>
                  </div>
                  <span className="font-financial text-[10px] text-text-tertiary">{formatDate(inv.issue_date)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1 pl-2">
                  {inv.status !== 'paid' && inv.status !== 'void' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        supabase.from('invoices').update({ status: 'paid', payment_date: new Date().toISOString().split('T')[0] }).eq('id', inv.id).then(() => loadInvoices())
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-accent-green active:bg-surface-green"
                      aria-label="Mark paid"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden rounded-xl border border-border-subtle bg-bg-secondary lg:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Invoice #</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Client</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Date</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Due Date</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Amount</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Status</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => handleInvoiceClick(inv)}
                      className="cursor-pointer border-b border-border-subtle/50 transition-colors last:border-0 hover:bg-bg-elevated"
                    >
                      <td className="px-4 py-3 font-financial text-sm font-medium text-accent-primary">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-sm text-text-primary">{inv.client_name}</td>
                      <td className="px-4 py-3 font-financial text-sm text-text-secondary">{formatDate(inv.issue_date)}</td>
                      <td className="px-4 py-3 font-financial text-sm text-text-secondary">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-3 text-right font-financial text-sm font-medium text-text-primary">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge label={inv.status} variant={invoiceStatusVariant(inv.status)} pulse={inv.status === 'overdue'} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status !== 'paid' && inv.status !== 'void' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                supabase.from('invoices').update({ status: 'paid', payment_date: new Date().toISOString().split('T')[0] }).eq('id', inv.id).then(() => loadInvoices())
                              }}
                              className="rounded px-2 py-1 text-[11px] font-medium text-accent-green hover:bg-surface-green"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(inv) }}
                            className="rounded px-2 py-1 text-[11px] font-medium text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary"
                          >
                            Duplicate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Form Panel */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 hidden lg:block" onClick={() => { setShowForm(false); setDuplicateData(undefined) }} />
          <InvoiceForm
            onClose={() => { setShowForm(false); setDuplicateData(undefined) }}
            onSaved={handleFormSaved}
            duplicate={duplicateData}
          />
        </>
      )}

      {/* Detail Panel */}
      {selectedInvoice && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 hidden lg:block" onClick={() => setSelectedInvoice(null)} />
          <InvoiceDetail
            invoice={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            onUpdated={handleDetailUpdated}
            onDuplicate={handleDuplicate}
            onEdit={handleEdit}
          />
        </>
      )}
    </div>
  )
}
