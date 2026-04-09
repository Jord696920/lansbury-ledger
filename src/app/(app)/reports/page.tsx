'use client'

import { useState } from 'react'
import { BarChart3, FileText, DollarSign, Car, Home, Package, Clock, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

const reports = [
  { id: 'pnl', name: 'Profit & Loss', icon: DollarSign, description: 'Income vs expenses by period' },
  { id: 'cashflow', name: 'Cash Flow Statement', icon: BarChart3, description: 'Cash in/out by period' },
  { id: 'gst', name: 'GST Summary', icon: FileText, description: 'By quarter, matching BAS worksheets' },
  { id: 'expenses', name: 'Expense Report', icon: DollarSign, description: 'By category with drill-down' },
  { id: 'vehicle', name: 'Vehicle Expense Report', icon: Car, description: 'All motor vehicle costs consolidated' },
  { id: 'home_office', name: 'Home Office Report', icon: Home, description: 'Deductions with method calculation' },
  { id: 'assets', name: 'Asset Register', icon: Package, description: 'Assets with depreciation schedules' },
  { id: 'ageing', name: 'Invoice Ageing', icon: Clock, description: 'Outstanding invoices by age bucket' },
]

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
        <p className="text-sm text-text-secondary">Financial reports & exports</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {reports.map((report) => {
          const Icon = report.icon
          return (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report.id)}
              className={cn(
                'card-hover flex flex-col items-start rounded-xl border p-5 text-left transition-all',
                selectedReport === report.id
                  ? 'border-accent-blue bg-surface-blue'
                  : 'border-border-subtle bg-bg-secondary hover:border-border-active'
              )}
            >
              <Icon className={cn('mb-3 h-6 w-6', selectedReport === report.id ? 'text-accent-blue' : 'text-text-tertiary')} />
              <h3 className="text-sm font-semibold text-text-primary">{report.name}</h3>
              <p className="mt-1 text-[11px] text-text-tertiary">{report.description}</p>
            </button>
          )
        })}
      </div>

      {selectedReport && (
        <div className="rounded-xl border border-border-subtle bg-bg-secondary p-8 text-center">
          <BarChart3 className="mx-auto mb-3 h-12 w-12 text-text-tertiary" />
          <h3 className="text-lg font-semibold text-text-primary">
            {reports.find((r) => r.id === selectedReport)?.name}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Report generation coming in Phase 3. Data is being collected and will be available here.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-bg-elevated">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-bg-elevated">
              <FileText className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
