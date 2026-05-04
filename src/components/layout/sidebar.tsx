'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Receipt,
  Calculator,
  Shield,
  BarChart3,
  Home,
  Clock,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Target,
  TrendingUp,
  Mail,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',       label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/transactions',    label: 'Transactions',   icon: ArrowLeftRight },
  { href: '/invoices',        label: 'Invoices',       icon: FileText },
  { href: '/gst',             label: 'GST / BAS',      icon: Receipt },
  { href: '/tax',             label: 'Tax Position',   icon: Calculator },
  { href: '/budgets',         label: 'Budgets',        icon: Target },
  { href: '/cash-flow',       label: 'Cash Flow',      icon: TrendingUp },
  { href: '/email-receipts',  label: 'Email Receipts', icon: Mail },
  { href: '/deductions',      label: 'Deductions',     icon: Shield },
  { href: '/reports',         label: 'Reports',        icon: BarChart3 },
  { href: '/household',       label: 'Household',      icon: Home },
  { href: '/time-machine',    label: 'Time Machine',   icon: Clock },
  { href: '/admin/integrity', label: 'Integrity',      icon: ShieldCheck },
  { href: '/settings',        label: 'Settings',       icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        'fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border-subtle bg-bg-primary transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border-subtle px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-primary text-sm font-bold text-white">R</div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <h1 className="text-sm font-bold tracking-tight text-text-primary">
              Rod
            </h1>
            <p className="text-[10px] font-medium text-text-tertiary">Sole Trader Accounting</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-4" aria-label="Primary">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-accent-primary-bg text-accent-primary'
                  : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
              )}
            >
              <Icon
                className={cn('h-5 w-5 shrink-0 transition-colors', isActive ? 'text-accent-primary' : 'text-text-tertiary group-hover:text-text-secondary')}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              {!collapsed && <span className="ml-3">{item.label}</span>}
              {collapsed && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-primary opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
                >
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Keyboard shortcut hint */}
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-lg bg-bg-elevated px-3 py-2 text-center">
          <p className="text-[10px] text-text-tertiary">
            <kbd className="rounded border border-border-subtle px-1 py-0.5 font-financial text-[9px]">Ctrl+K</kbd>
            <span className="ml-1.5">Command palette</span>
          </p>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="flex h-12 items-center justify-center border-t border-border-subtle text-text-tertiary transition-colors hover:bg-bg-elevated hover:text-text-secondary"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  )
}
