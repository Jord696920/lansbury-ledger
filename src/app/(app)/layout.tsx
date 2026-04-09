'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { MobileTopbar } from '@/components/layout/mobile-topbar'
import { BottomTabs } from '@/components/layout/bottom-tabs'
import { NewActionSheet } from '@/components/layout/new-action-sheet'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { ExpenseLogger } from '@/components/expenses/expense-logger'
import { ToastProvider } from '@/components/ui/toast'
import { CommandPalette } from '@/components/ui/command-palette'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [showNewSheet, setShowNewSheet] = useState(false)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showReceiptCapture, setShowReceiptCapture] = useState(false)

  return (
    <ToastProvider>
      <div className="flex h-full">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        <div className="flex flex-1 flex-col lg:pl-60">
          {/* Desktop top bar — hidden on mobile */}
          <div className="hidden lg:block">
            <Topbar />
          </div>

          {/* Mobile top bar — hidden on desktop */}
          <MobileTopbar />

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-bg-page px-4 py-5 pb-24 lg:px-8 lg:py-6 lg:pb-6">
            <div className="page-enter">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile bottom tabs — hidden on desktop */}
        <BottomTabs onNewTap={() => setShowNewSheet(true)} />

        {/* New action sheet */}
        <NewActionSheet
          open={showNewSheet}
          onClose={() => setShowNewSheet(false)}
          onNewInvoice={() => setShowInvoiceForm(true)}
          onLogExpense={() => setShowExpenseForm(true)}
          onSnapReceipt={() => setShowReceiptCapture(true)}
        />

        {/* Global invoice form (triggered from + New) */}
        {showInvoiceForm && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 hidden lg:block" onClick={() => setShowInvoiceForm(false)} />
            <InvoiceForm onClose={() => setShowInvoiceForm(false)} onSaved={() => setShowInvoiceForm(false)} />
          </>
        )}

        {/* Global expense logger (triggered from + New) */}
        <ExpenseLogger open={showExpenseForm} onClose={() => setShowExpenseForm(false)} />

        <CommandPalette />
      </div>
    </ToastProvider>
  )
}
