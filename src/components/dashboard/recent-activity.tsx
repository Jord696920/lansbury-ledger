'use client'

import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge, invoiceStatusVariant } from '@/components/ui/status-badge'
import type { Transaction, Invoice } from '@/types/database'

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Recent Transactions</h3>
        <Link href="/transactions" className="text-xs text-accent-blue hover:underline">
          View all →
        </Link>
      </div>
      <div className="space-y-1">
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-tertiary">
            No transactions yet. Import a bank CSV to get started.
          </p>
        ) : (
          transactions.slice(0, 10).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-elevated"
            >
              <div className="flex items-center gap-3">
                <div className={`h-1.5 w-1.5 rounded-full ${t.amount > 0 ? 'bg-accent-green' : 'bg-accent-red'}`} />
                <div>
                  <p className="text-sm text-text-primary">{t.description}</p>
                  <p className="text-[11px] text-text-tertiary">
                    {formatDate(t.date)}
                    {t.account && <span> · {t.account.name}</span>}
                  </p>
                </div>
              </div>
              <span className={`font-financial text-sm font-medium ${t.amount > 0 ? 'text-accent-green' : 'text-text-primary'}`}>
                {formatCurrency(t.amount)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function RecentInvoices({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Recent Invoices</h3>
        <Link href="/invoices" className="text-xs text-accent-blue hover:underline">
          View all →
        </Link>
      </div>
      <div className="space-y-1">
        {invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-tertiary">
            No invoices yet. Create your first invoice.
          </p>
        ) : (
          invoices.slice(0, 5).map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-elevated"
            >
              <div>
                <p className="text-sm text-text-primary">{inv.client_name}</p>
                <p className="text-[11px] text-text-tertiary">
                  {inv.invoice_number} · {formatDate(inv.issue_date)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge label={inv.status} variant={invoiceStatusVariant(inv.status)} pulse={inv.status === 'overdue'} />
                <span className="font-financial text-sm font-medium text-text-primary">
                  {formatCurrency(inv.total)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
