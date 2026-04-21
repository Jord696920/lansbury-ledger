'use client'

import { FileText, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NewActionSheetProps {
  open: boolean
  onClose: () => void
  onNewInvoice: () => void
  onLogExpense: () => void
}

const actions = [
  { key: 'invoice', label: 'New Invoice', desc: 'Create and send an invoice', icon: FileText, color: 'text-accent-green', bg: 'bg-surface-green' },
  { key: 'expense', label: 'Log Expense', desc: 'Record a business expense', icon: Receipt, color: 'text-accent-blue', bg: 'bg-surface-blue' },
] as const

export function NewActionSheet({ open, onClose, onNewInvoice, onLogExpense }: NewActionSheetProps) {
  if (!open) return null

  const handlers: Record<string, () => void> = {
    invoice: onNewInvoice,
    expense: onLogExpense,
  }

  return (
    <>
      <div className="fixed inset-0 z-50 backdrop-overlay" onClick={onClose} />
      <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 mx-4 mb-2 rounded-2xl border border-border-subtle bg-bg-primary shadow-sm shadow-xl sheet-up lg:bottom-auto lg:left-auto lg:right-6 lg:top-16 lg:mx-0 lg:w-72">
        <div className="p-2">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                onClick={() => { handlers[action.key](); onClose() }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors active:bg-bg-elevated touch-target"
              >
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', action.bg)}>
                  <Icon className={cn('h-5 w-5', action.color)} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{action.label}</p>
                  <p className="text-[11px] text-text-tertiary">{action.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
