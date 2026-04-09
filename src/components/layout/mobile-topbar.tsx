'use client'

import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Bell } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Command Centre',
  '/invoices': 'Invoices',
  '/transactions': 'Transactions',
  '/gst': 'GST / BAS',
  '/tax': 'Tax Position',
  '/deductions': 'Deductions',
  '/reports': 'Reports',
  '/household': 'Household',
  '/time-machine': 'Time Machine',
  '/settings': 'Settings',
}

export function MobileTopbar() {
  const pathname = usePathname()
  const title = pageTitles[pathname] || 'Rod'

  return (
    <header className="flex h-12 items-center justify-between border-b border-border-subtle bg-bg-secondary px-4 lg:hidden safe-top">
      <span className="text-sm font-extrabold tracking-tight text-accent-green">Rod</span>
      <h1 className="text-sm font-semibold text-text-primary">{title}</h1>
      <div className="flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  )
}
