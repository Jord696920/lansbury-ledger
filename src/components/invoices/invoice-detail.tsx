'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { downloadInvoicePDF, getInvoicePDFBase64 } from './invoice-pdf'
import { useToast } from '@/components/ui/toast'
import {
  X, Send, Download, Copy, Check, Trash2, Edit3, Share2,
  Mail, ExternalLink, Loader2,
} from 'lucide-react'
import type { Invoice, InvoiceLine, BusinessProfile, Client } from '@/types/database'

interface InvoiceDetailProps {
  invoice: Invoice
  onClose: () => void
  onUpdated: () => void
  onDuplicate: (inv: Invoice) => void
  onEdit: (inv: Invoice) => void
}

export function InvoiceDetail({ invoice, onClose, onUpdated, onDuplicate, onEdit }: InvoiceDetailProps) {
  const { toast } = useToast()
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSendConfirm, setShowSendConfirm] = useState(false)

  useEffect(() => {
    loadData()
  }, [invoice.id])

  async function loadData() {
    setLoading(true)
    const [profileRes, linesRes, clientRes] = await Promise.all([
      supabase.from('business_profile').select('*').limit(1).single(),
      supabase.from('invoice_lines').select('*').eq('invoice_id', invoice.id),
      supabase.from('clients').select('*').eq('name', invoice.client_name).limit(1).single(),
    ])
    if (profileRes.data) setProfile(profileRes.data as BusinessProfile)
    if (linesRes.data) setLines(linesRes.data as InvoiceLine[])
    if (clientRes.data) setClient(clientRes.data as Client)
    setLoading(false)
  }

  function getPDFData() {
    return { invoice, lines, profile: profile!, client }
  }

  function handleDownload() {
    if (!profile) return
    downloadInvoicePDF(getPDFData())
    toast('PDF downloaded', 'success')
  }

  async function handleShare() {
    if (!profile) return
    if (navigator.share) {
      try {
        const { generateInvoicePDF } = await import('./invoice-pdf')
        const doc = generateInvoicePDF(getPDFData())
        const blob = doc.output('blob')
        const file = new File([blob], `${invoice.invoice_number}.pdf`, { type: 'application/pdf' })
        await navigator.share({ files: [file], title: `Invoice ${invoice.invoice_number}` })
      } catch {
        // User cancelled or share failed — fall back to download
        handleDownload()
      }
    } else {
      handleDownload()
    }
  }

  async function handleSendEmail() {
    if (!profile) return
    setSending(true)

    // Build email content
    const subject = `Tax Invoice ${invoice.invoice_number} — ${profile.business_name || 'Jordan Lansbury'}`
    const toEmail = client?.email || invoice.client_email || 'seqautomotive@gmail.com'
    const ccEmail = profile.email || 'lansbury2002@gmail.com'
    const contactName = client?.contact_person?.split('/')[0]?.trim() || 'Craig'
    const body = `Hi ${contactName},\n\nPlease find attached tax invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total)}.\n\nPayment Details:\nBank: ${profile.bank_name || '—'}\nAccount Name: ${profile.business_name || '—'}\nBSB: ${profile.bank_bsb || '—'}\nACC: ${profile.bank_account || '—'}\n\nCheers,\nJordan`

    // Try SMTP API first
    try {
      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          cc: ccEmail,
          subject,
          body,
          pdfBase64: getInvoicePDFBase64(getPDFData()),
          filename: `${invoice.invoice_number}.pdf`,
        }),
      })

      if (res.ok) {
        // Mark as sent
        await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
        toast(`Invoice sent to ${client?.name || invoice.client_name}`, 'success')
        setSending(false)
        onUpdated()
        return
      }
    } catch {
      // SMTP not configured — fall through to mailto fallback
    }

    // Mailto fallback: download PDF + open mailto link
    handleDownload()

    const mailtoBody = encodeURIComponent(body)
    const mailtoSubject = encodeURIComponent(subject)
    const mailtoUrl = `mailto:${toEmail}?cc=${ccEmail}&subject=${mailtoSubject}&body=${mailtoBody}`
    window.open(mailtoUrl, '_blank')

    // Mark as sent optimistically
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
    toast('PDF downloaded — attach it to the email that just opened', 'info', 6000)
    setSending(false)
    onUpdated()
  }

  async function handleMarkPaid() {
    await supabase
      .from('invoices')
      .update({ status: 'paid', payment_date: new Date().toISOString().split('T')[0] })
      .eq('id', invoice.id)
    toast('Marked as paid', 'success')
    onUpdated()
  }

  async function handleDelete() {
    await supabase.from('invoice_lines').delete().eq('invoice_id', invoice.id)
    await supabase.from('invoices').delete().eq('id', invoice.id)
    toast(`${invoice.invoice_number} deleted`, 'success')
    onUpdated()
    onClose()
  }

  async function handleVoid() {
    await supabase.from('invoices').update({ status: 'void' }).eq('id', invoice.id)
    toast('Invoice voided', 'success')
    onUpdated()
  }

  const isImported = !lines.length && !loading
  const canEdit = ['draft', 'sent'].includes(invoice.status)
  const canMarkPaid = !['paid', 'void'].includes(invoice.status)
  const canSend = !['void'].includes(invoice.status)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-secondary lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[480px] lg:border-l lg:border-border-subtle lg:shadow-2xl sheet-up lg:slide-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <button onClick={onClose} className="touch-target flex h-10 w-10 items-center justify-center rounded-lg text-text-tertiary active:bg-bg-elevated">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-financial text-sm font-semibold text-text-primary">{invoice.invoice_number}</h2>
        <StatusDot status={invoice.status} />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {/* Amount hero */}
          <div className="mb-5 text-center">
            <p className="font-financial text-3xl font-bold text-text-primary">{formatCurrency(invoice.total)}</p>
            {invoice.subtotal > 0 && (
              <p className="mt-1 text-xs text-text-tertiary">
                Ex GST: {formatCurrency(invoice.subtotal)} · GST: {formatCurrency(invoice.gst_amount)}
              </p>
            )}
          </div>

          {/* Client info */}
          <div className="mb-4 rounded-xl border border-border-subtle bg-bg-primary p-4">
            <p className="text-xs font-semibold text-text-tertiary">Bill To</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{invoice.client_name}</p>
            {invoice.client_abn && <p className="text-xs text-text-secondary">ABN {invoice.client_abn}</p>}
            {invoice.client_address && <p className="mt-1 text-xs text-text-secondary">{invoice.client_address}</p>}
            {(client?.email || invoice.client_email) && (
              <p className="text-xs text-text-tertiary">{client?.email || invoice.client_email}</p>
            )}
          </div>

          {/* Dates & terms */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <InfoBlock label="Issued" value={formatDate(invoice.issue_date)} />
            <InfoBlock label="Due" value={formatDate(invoice.due_date)} />
            <InfoBlock label="Status" value={invoice.status} capitalize />
          </div>

          {/* Line items (if any) */}
          {lines.length > 0 && (
            <div className="mb-4 rounded-xl border border-border-subtle bg-bg-primary p-4">
              <p className="mb-2 text-xs font-semibold text-text-tertiary">Line Items</p>
              {lines.map((line) => (
                <div key={line.id} className="flex items-start justify-between border-b border-border-subtle/50 py-2 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">{line.description}</p>
                    <p className="text-xs text-text-tertiary">Qty: {line.quantity} × {formatCurrency(line.unit_price)}</p>
                  </div>
                  <p className="font-financial text-sm font-medium text-text-primary">{formatCurrency(line.total)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-4 rounded-xl border border-border-subtle bg-bg-primary p-4">
              <p className="text-xs font-semibold text-text-tertiary">Notes</p>
              <p className="mt-1 text-sm text-text-secondary">{invoice.notes}</p>
            </div>
          )}

          {/* Imported notice */}
          {isImported && (
            <div className="mb-4 rounded-xl border border-border-subtle bg-surface-amber p-4">
              <p className="text-xs font-semibold text-accent-amber">Imported from Zoho</p>
              <p className="mt-1 text-xs text-text-secondary">
                This is a historical invoice. View-only — no PDF or editing available.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons — fixed footer */}
      {!loading && (
        <div className="border-t border-border-subtle bg-bg-secondary px-4 py-3 safe-bottom">
          {/* Primary actions */}
          {!isImported && canSend && (
            <>
              {showSendConfirm ? (
                <div className="mb-3 rounded-xl border border-accent-primary/30 bg-surface-blue p-3">
                  <p className="mb-2 text-sm text-text-primary">
                    Send <span className="font-semibold">{invoice.invoice_number}</span> ({formatCurrency(invoice.total)}) to{' '}
                    <span className="font-semibold">{client?.email || invoice.client_email || 'seqautomotive@gmail.com'}</span>?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSendEmail}
                      disabled={sending}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-primary py-2.5 text-sm font-semibold text-white active:scale-98 disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      {sending ? 'Sending...' : 'Send'}
                    </button>
                    <button
                      onClick={() => setShowSendConfirm(false)}
                      className="rounded-lg border border-border-subtle px-4 py-2.5 text-sm text-text-secondary active:bg-bg-elevated"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSendConfirm(true)}
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-primary py-3.5 text-sm font-semibold text-white active:scale-98 transition-transform"
                >
                  <Send className="h-4 w-4" />
                  Send via Email
                </button>
              )}
            </>
          )}

          {/* Secondary action row */}
          <div className="flex gap-2">
            {!isImported && (
              <>
                <ActionBtn icon={Download} label="PDF" onClick={handleDownload} />
                <ActionBtn icon={Share2} label="Share" onClick={handleShare} />
              </>
            )}
            <ActionBtn icon={Copy} label="Duplicate" onClick={() => onDuplicate(invoice)} />
            {canEdit && !isImported && (
              <ActionBtn icon={Edit3} label="Edit" onClick={() => onEdit(invoice)} />
            )}
            {canMarkPaid && (
              <ActionBtn icon={Check} label="Paid" onClick={handleMarkPaid} accent="green" />
            )}
          </div>

          {/* Danger zone */}
          <div className="mt-2 flex gap-2">
            {canEdit && invoice.status !== 'void' && (
              <button onClick={handleVoid} className="flex-1 py-2 text-center text-xs font-medium text-text-tertiary active:text-accent-amber">
                Void
              </button>
            )}
            {showDeleteConfirm ? (
              <div className="flex flex-1 items-center gap-2">
                <span className="text-xs text-accent-red">Delete {invoice.invoice_number}?</span>
                <button onClick={handleDelete} className="rounded bg-accent-red px-3 py-1 text-xs font-semibold text-white active:brightness-90">
                  Yes
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="text-xs text-text-tertiary">
                  No
                </button>
              </div>
            ) : (
              <button onClick={() => setShowDeleteConfirm(true)} className="flex-1 py-2 text-center text-xs font-medium text-text-tertiary active:text-accent-red">
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ icon: Icon, label, onClick, accent }: {
  icon: typeof Download
  label: string
  onClick: () => void
  accent?: 'green'
}) {
  const color = accent === 'green' ? 'text-accent-green active:bg-surface-green' : 'text-text-secondary active:bg-bg-elevated'
  return (
    <button onClick={onClick} className={`flex flex-1 flex-col items-center gap-1 rounded-xl border border-border-subtle py-2.5 text-xs font-medium transition-colors ${color}`}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: 'bg-accent-green', sent: 'bg-accent-blue', viewed: 'bg-accent-blue',
    overdue: 'bg-accent-red', draft: 'bg-text-tertiary', void: 'bg-text-tertiary',
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2 w-2 rounded-full ${colors[status] || 'bg-text-tertiary'}`} />
      <span className="text-xs capitalize text-text-secondary">{status}</span>
    </div>
  )
}

function InfoBlock({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-primary p-2.5 text-center">
      <p className="text-[10px] font-semibold text-text-tertiary">{label}</p>
      <p className={`mt-0.5 font-financial text-xs font-medium text-text-primary ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  )
}
