'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateGST, generateInvoiceNumber, formatCurrency } from '@/lib/utils'
import { X, Zap, Send, ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import type { BusinessProfile, Client, Invoice } from '@/types/database'

interface InvoiceFormProps {
  onClose: () => void
  onSaved: (invoice?: Invoice) => void
  /** Pre-fill from a duplicated invoice */
  duplicate?: { clientId?: string; amount?: number; terms?: string }
}

const TERMS_OPTIONS = ['Due on Receipt', 'Net 7', 'Net 14', 'Net 30']

export function InvoiceForm({ onClose, onSaved, duplicate }: InvoiceFormProps) {
  const { toast } = useToast()
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [defaultClient, setDefaultClient] = useState<Client | null>(null)
  const [allClients, setAllClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showClientPicker, setShowClientPicker] = useState(false)

  const [vehicle, setVehicle] = useState('')
  const [amountIncGST, setAmountIncGST] = useState(duplicate?.amount ? String(duplicate.amount) : '')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [terms, setTerms] = useState(duplicate?.terms || 'Due on Receipt')
  const [showTerms, setShowTerms] = useState(false)

  const [saving, setSaving] = useState(false)
  const [showQuickConfirm, setShowQuickConfirm] = useState(false)
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('')

  const vehicleRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [profileRes, clientsRes] = await Promise.all([
      supabase.from('business_profile').select('*').limit(1).single(),
      supabase.from('clients').select('*').order('is_default', { ascending: false }),
    ])
    if (profileRes.data) {
      const p = profileRes.data as BusinessProfile
      setProfile(p)
      setNextInvoiceNumber(generateInvoiceNumber(p.invoice_prefix, p.invoice_next_number))
    }
    if (clientsRes.data) {
      const clients = clientsRes.data as Client[]
      setAllClients(clients)
      const def = clients.find((c) => c.is_default) || clients[0]
      if (def) {
        setDefaultClient(def)
        setSelectedClient(def)
      }
    }
  }

  // Calculations — amount is GST-inclusive
  const amountNum = parseFloat(amountIncGST) || 0
  const gstAmount = Math.round((amountNum / 11) * 100) / 100
  const exGSTAmount = Math.round((amountNum - gstAmount) * 100) / 100

  // Due date from terms
  function getDueDate(): string {
    const d = new Date(issueDate)
    if (terms === 'Due on Receipt') return issueDate
    const days = parseInt(terms.replace('Net ', ''))
    if (!isNaN(days)) d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  async function handleSave(asDraft: boolean) {
    if (!profile || !selectedClient) return
    if (!asDraft && (!vehicle.trim() || vehicle.trim().length < 3)) {
      toast('Enter a vehicle description (min 3 chars)', 'error')
      vehicleRef.current?.focus()
      return
    }
    if (!asDraft && amountNum <= 0) {
      toast('Enter an amount', 'error')
      amountRef.current?.focus()
      return
    }

    setSaving(true)
    const invoiceNumber = generateInvoiceNumber(profile.invoice_prefix, profile.invoice_next_number)
    const description = `Consulting Fee ${vehicle.trim()}`

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        client_name: selectedClient.name,
        client_abn: selectedClient.abn,
        client_email: selectedClient.email,
        client_address: [selectedClient.address_line1, selectedClient.city, selectedClient.state, selectedClient.postcode].filter(Boolean).join(', '),
        issue_date: issueDate,
        due_date: getDueDate(),
        status: asDraft ? 'draft' : 'sent',
        subtotal: exGSTAmount,
        gst_amount: gstAmount,
        total: amountNum,
        notes: terms !== 'Due on Receipt' ? `Terms: ${terms}` : null,
      })
      .select()
      .single()

    if (error || !invoice) {
      console.error('Invoice creation error:', error)
      toast('Failed to create invoice', 'error')
      setSaving(false)
      return
    }

    // Insert single line item
    await supabase.from('invoice_lines').insert({
      invoice_id: invoice.id,
      description,
      quantity: 1,
      unit_price: exGSTAmount,
      gst_amount: gstAmount,
      total: exGSTAmount,
    })

    // Increment invoice number
    await supabase
      .from('business_profile')
      .update({ invoice_next_number: profile.invoice_next_number + 1 })
      .eq('id', profile.id)

    setSaving(false)
    toast(asDraft ? 'Draft saved' : `${invoiceNumber} created`, 'success')
    onSaved(invoice as Invoice)
  }

  // Quick Invoice: $545.45 inc GST to SEQ Automotive
  function handleQuickInvoice() {
    if (!defaultClient) return
    setSelectedClient(defaultClient)
    setAmountIncGST('545.45')
    setVehicle('')
    setShowQuickConfirm(true)
  }

  // Quick confirm view
  if (showQuickConfirm) {
    const qAmount = 545.45
    const qGst = Math.round((qAmount / 11) * 100) / 100
    const qExGst = Math.round((qAmount - qGst) * 100) / 100
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg-secondary lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[480px] lg:border-l lg:border-border-subtle lg:shadow-2xl sheet-up lg:slide-in">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <button onClick={() => setShowQuickConfirm(false)} className="touch-target flex h-10 w-10 items-center justify-center rounded-lg text-text-tertiary">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-semibold text-text-primary">Quick Invoice</h2>
          <span className="w-10" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <Zap className="mb-4 h-12 w-12 text-accent-amber" />
          <p className="mb-1 text-center text-lg font-semibold text-text-primary">
            {defaultClient?.name}
          </p>
          <p className="mb-1 text-center text-sm text-text-secondary">Consulting Fee</p>
          <p className="mb-2 font-financial text-4xl font-bold text-accent-green">
            {formatCurrency(qAmount)}
          </p>
          <p className="mb-8 text-xs text-text-tertiary">
            Ex GST: {formatCurrency(qExGst)} · GST: {formatCurrency(qGst)}
          </p>

          <button
            onClick={() => {
              setShowQuickConfirm(false)
              // Set the amount and let user fill vehicle, then save
              setAmountIncGST('545.45')
              setTimeout(() => vehicleRef.current?.focus(), 100)
            }}
            className="w-full max-w-xs rounded-xl bg-accent-primary py-4 text-base font-semibold text-white active:scale-98 transition-transform"
          >
            Fill Vehicle & Create
          </button>
          <button
            onClick={() => setShowQuickConfirm(false)}
            className="mt-3 text-sm font-medium text-text-tertiary active:text-text-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-secondary lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[480px] lg:border-l lg:border-border-subtle lg:shadow-2xl sheet-up lg:slide-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <button onClick={onClose} className="touch-target flex h-10 w-10 items-center justify-center rounded-lg text-text-tertiary active:bg-bg-elevated">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-semibold text-text-primary">New Invoice</h2>
        <span className="font-financial text-xs text-text-tertiary">{nextInvoiceNumber}</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {/* Quick Invoice button */}
        <button
          onClick={handleQuickInvoice}
          className="mb-5 flex w-full items-center gap-3 rounded-xl border border-accent-amber/30 bg-surface-amber px-4 py-3 text-left active:brightness-95 transition-all"
        >
          <Zap className="h-5 w-5 shrink-0 text-accent-amber" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Quick Invoice — $545.45</p>
            <p className="text-[11px] text-text-tertiary">{defaultClient?.name} · Consulting Fee</p>
          </div>
        </button>

        {/* Client — locked to default, with change link */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold text-text-tertiary">To</label>
          {selectedClient && (
            <div className="rounded-xl border border-border-subtle bg-bg-primary px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{selectedClient.name}</p>
                  {selectedClient.abn && (
                    <p className="text-xs text-text-tertiary">ABN {selectedClient.abn}</p>
                  )}
                </div>
                <span className="text-xs text-accent-green">✓</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setShowClientPicker(!showClientPicker)}
            className="mt-1.5 text-xs font-medium text-accent-primary active:underline"
          >
            Change client
          </button>
          {showClientPicker && (
            <div className="mt-2 space-y-1.5">
              {allClients.filter((c) => c.id !== selectedClient?.id).map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClient(c); setShowClientPicker(false) }}
                  className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2.5 text-left text-sm text-text-primary active:bg-bg-elevated"
                >
                  {c.name}
                  {c.abn && <span className="ml-2 text-xs text-text-tertiary">ABN {c.abn}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Vehicle description */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold text-text-tertiary">Vehicle</label>
          <p className="mb-1 text-sm font-medium text-text-secondary">Consulting Fee</p>
          <input
            ref={vehicleRef}
            type="text"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="e.g. 2022 Mazda CX-3 Blue QLD"
            className="w-full rounded-xl border border-border-subtle bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-accent-primary"
          />
        </div>

        {/* Amount — inc GST, big numeric input */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold text-text-tertiary">Total (inc GST)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-text-tertiary">$</span>
            <input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              value={amountIncGST}
              onChange={(e) => setAmountIncGST(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              max="99999"
              className="w-full rounded-xl border border-border-subtle bg-bg-primary py-4 pl-10 pr-4 font-financial text-[28px] font-bold text-text-primary placeholder-text-tertiary outline-none focus:border-accent-primary"
            />
          </div>
          {amountNum > 0 && (
            <div className="mt-2 flex items-center gap-4 px-1 text-sm text-text-secondary">
              <span>Ex GST: <span className="font-financial font-medium text-text-primary">{formatCurrency(exGSTAmount)}</span></span>
              <span>GST: <span className="font-financial font-medium">{formatCurrency(gstAmount)}</span></span>
            </div>
          )}
        </div>

        {/* Date + Terms — compact row */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-tertiary">Date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-bg-primary px-3 py-3 text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div className="relative">
            <label className="mb-1.5 block text-xs font-semibold text-text-tertiary">Terms</label>
            <button
              onClick={() => setShowTerms(!showTerms)}
              className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-bg-primary px-3 py-3 text-sm text-text-primary active:bg-bg-elevated"
            >
              <span>{terms}</span>
              <ChevronDown className="h-4 w-4 text-text-tertiary" />
            </button>
            {showTerms && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-border-subtle bg-bg-secondary shadow-lg">
                {TERMS_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTerms(t); setShowTerms(false) }}
                    className={`w-full px-3 py-2.5 text-left text-sm first:rounded-t-xl last:rounded-b-xl active:bg-bg-elevated ${
                      t === terms ? 'font-semibold text-accent-primary' : 'text-text-primary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed footer */}
      <div className="border-t border-border-subtle bg-bg-secondary px-4 py-3 safe-bottom">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-primary py-[14px] text-base font-semibold text-white active:scale-98 transition-transform disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {saving ? 'Creating...' : 'Create & Preview'}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="mt-2 w-full py-2 text-center text-sm font-medium text-text-tertiary active:text-text-secondary disabled:opacity-50"
        >
          Save as Draft
        </button>
      </div>
    </div>
  )
}
