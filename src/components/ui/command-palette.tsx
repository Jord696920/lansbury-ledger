'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut'
import {
  Search, LayoutDashboard, ArrowLeftRight, FileText, Receipt,
  Calculator, Shield, BarChart3, Settings, Plus, Upload, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: typeof Search
  action: () => void
  section: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Ctrl+K / Cmd+K to open
  useKeyboardShortcut({
    key: 'k',
    modifiers: ['ctrl'],
    handler: () => setOpen((prev) => !prev),
  })

  // Escape to close
  useKeyboardShortcut({
    key: 'Escape',
    handler: () => setOpen(false),
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const commands: CommandItem[] = useMemo(() => [
    { id: 'nav-dash', label: 'Dashboard', icon: LayoutDashboard, action: () => router.push('/dashboard'), section: 'Navigation' },
    { id: 'nav-txn', label: 'Transactions', icon: ArrowLeftRight, action: () => router.push('/transactions'), section: 'Navigation' },
    { id: 'nav-inv', label: 'Invoices', icon: FileText, action: () => router.push('/invoices'), section: 'Navigation' },
    { id: 'nav-gst', label: 'GST / BAS', icon: Receipt, action: () => router.push('/gst'), section: 'Navigation' },
    { id: 'nav-tax', label: 'Tax Position', icon: Calculator, action: () => router.push('/tax'), section: 'Navigation' },
    { id: 'nav-ded', label: 'Deductions', icon: Shield, action: () => router.push('/deductions'), section: 'Navigation' },
    { id: 'nav-rep', label: 'Reports', icon: BarChart3, action: () => router.push('/reports'), section: 'Navigation' },
    { id: 'nav-set', label: 'Settings', icon: Settings, action: () => router.push('/settings'), section: 'Navigation' },
    { id: 'act-inv', label: 'New Invoice', description: 'Create a new tax invoice', icon: Plus, action: () => router.push('/invoices?action=new'), section: 'Actions' },
    { id: 'act-csv', label: 'Import CSV', description: 'Import bank transactions', icon: Upload, action: () => router.push('/transactions?action=import'), section: 'Actions' },
    { id: 'act-bas', label: 'Prepare BAS', description: 'Run BAS preparation check', icon: Zap, action: () => router.push('/gst'), section: 'Actions' },
  ], [router])

  const filtered = useMemo(() => {
    if (!query) return commands
    const lower = query.toLowerCase()
    return commands.filter((c) =>
      c.label.toLowerCase().includes(lower) ||
      c.description?.toLowerCase().includes(lower) ||
      c.section.toLowerCase().includes(lower)
    )
  }, [commands, query])

  // Group by section
  const sections = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    for (const item of filtered) {
      const list = map.get(item.section) || []
      list.push(item)
      map.set(item.section, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      filtered[activeIndex].action()
      setOpen(false)
    }
  }

  if (!open) return null

  let flatIndex = -1

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-[20%] z-[91] w-full max-w-lg -translate-x-1/2 rounded-xl border border-border-subtle bg-bg-secondary shadow-2xl"
        style={{ animation: 'countUp 0.15s ease-out' }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, pages..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-tertiary outline-none"
          />
          <kbd className="rounded border border-border-subtle px-1.5 py-0.5 font-financial text-[10px] text-text-tertiary">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {sections.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-text-tertiary">No results found</p>
          ) : (
            sections.map(([section, items]) => (
              <div key={section}>
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{section}</p>
                {items.map((item) => {
                  flatIndex++
                  const isActive = flatIndex === activeIndex
                  const Icon = item.icon
                  const currentIndex = flatIndex
                  return (
                    <button
                      key={item.id}
                      onClick={() => { item.action(); setOpen(false) }}
                      onMouseEnter={() => setActiveIndex(currentIndex)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        isActive ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-elevated'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-text-tertiary" />
                      <div className="flex-1">
                        <span className="text-text-primary">{item.label}</span>
                        {item.description && (
                          <span className="ml-2 text-xs text-text-tertiary">{item.description}</span>
                        )}
                      </div>
                      {isActive && <span className="text-[10px] text-text-tertiary">↵</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border-subtle px-4 py-2 text-[10px] text-text-tertiary">
          <span><kbd className="rounded border border-border-subtle px-1 py-0.5">↑↓</kbd> Navigate</span>
          <span><kbd className="rounded border border-border-subtle px-1 py-0.5">↵</kbd> Select</span>
          <span><kbd className="rounded border border-border-subtle px-1 py-0.5">Esc</kbd> Close</span>
        </div>
      </div>
    </>
  )
}
