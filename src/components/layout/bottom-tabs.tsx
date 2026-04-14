'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, FileText, Calculator, Plus, Menu } from 'lucide-react'
import { navSections } from './nav-config'

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

  // Exclude items already shown as primary tabs (Home, Invoices, Tax)
  const primaryHrefs = new Set(['/dashboard', '/invoices', '/tax'])
  const moreSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((i) => !primaryHrefs.has(i.href)),
    }))
    .filter((section) => section.items.length > 0)

  const liveMorePages = moreSections
    .flatMap((s) => s.items)
    .filter((i) => !i.comingSoon)

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <>
          <div className="fixed inset-0 z-40 backdrop-overlay" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 mx-4 mb-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-border-subtle bg-bg-primary shadow-xl sheet-up">
            <div className="p-2">
              {moreSections.map((section) => (
                <div key={section.label} className="mb-3 last:mb-0">
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    {section.label}
                  </p>
                  {section.items.map((page) => {
                    const isActive =
                      !page.comingSoon &&
                      (pathname === page.href || pathname.startsWith(page.href + '/'))
                    const Icon = page.icon

                    if (page.comingSoon) {
                      return (
                        <div
                          key={page.href}
                          className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-text-tertiary opacity-60"
                          aria-disabled="true"
                          title="Coming soon"
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                          <span className="flex-1">{page.label}</span>
                          <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
                            Soon
                          </span>
                        </div>
                      )
                    }

                    return (
                      <Link
                        key={page.href}
                        href={page.href}
                        onClick={() => setShowMore(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors touch-target',
                          isActive
                            ? 'bg-bg-elevated text-accent-primary'
                            : 'text-text-secondary active:bg-bg-elevated'
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                        <span>{page.label}</span>
                      </Link>
                    )
                  })}
                </div>
              ))}
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
              const isMoreActive = liveMorePages.some((p) => pathname === p.href || pathname.startsWith(p.href + '/'))
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
