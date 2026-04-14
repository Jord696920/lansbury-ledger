'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, FileText, Calculator, Plus, Menu } from 'lucide-react'

interface BottomTabsProps {
  onNewTap: () => void
}

const tabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '__new__', label: 'New', icon: Plus },
  { href: '/tax', label: 'Tax', icon: Calculator },
  { href: '__more__', label: 'More', icon: Menu },
]

export function BottomTabs({ onNewTap }: BottomTabsProps) {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  // Hide tabs when virtual keyboard is open
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const vv = window.visualViewport
    function onResize() {
      // If viewport height shrinks significantly, keyboard is open
      const isKb = vv!.height < window.innerHeight * 0.75
      setKeyboardOpen(isKb)
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  if (keyboardOpen) return null

  const morePages = [
    { href: '/transactions', label: 'Transactions' },
    { href: '/gst', label: 'GST / BAS' },
    { href: '/deductions', label: 'Deductions' },
    { href: '/reports', label: 'Reports' },
    { href: '/household', label: 'Household' },
    { href: '/claims', label: 'Claims' },
    { href: '/time-machine', label: 'Time Machine' },
    { href: '/settings', label: 'Settings' },
  ]

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <>
          <div className="fixed inset-0 z-40 backdrop-overlay" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 mx-4 mb-2 rounded-2xl border border-border-subtle bg-bg-primary shadow-xl sheet-up">
            <div className="p-2">
              {morePages.map((page) => {
                const isActive = pathname === page.href || pathname.startsWith(page.href + '/')
                return (
                  <Link
                    key={page.href}
                    href={page.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      'flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors touch-target',
                      isActive ? 'bg-bg-elevated text-accent-primary' : 'text-text-secondary active:bg-bg-elevated'
                    )}
                  >
                    {page.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border-subtle bg-bg-primary shadow-lg safe-bottom lg:hidden"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex h-16 items-center justify-around px-2">
          {tabs.map((tab) => {
            if (tab.href === '__new__') {
              return (
                <button
                  key="new"
                  onClick={onNewTap}
                  aria-label="Create new"
                  className="relative -mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary text-white shadow-lg active:scale-95 transition-transform"
                >
                  <Plus className="h-6 w-6" />
                </button>
              )
            }

            if (tab.href === '__more__') {
              const isMoreActive = morePages.some((p) => pathname === p.href || pathname.startsWith(p.href + '/'))
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(!showMore)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-1 touch-target',
                    isMoreActive || showMore ? 'text-accent-primary' : 'text-text-tertiary'
                  )}
                  aria-label="More pages"
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              )
            }

            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1 touch-target',
                  isActive ? 'text-accent-primary' : 'text-text-tertiary'
                )}
                aria-label={tab.label}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
