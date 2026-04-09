'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  rightAction?: ReactNode
  children: ReactNode
  fullScreen?: boolean
}

export function BottomSheet({ open, onClose, title, rightAction, children, fullScreen = false }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 backdrop-overlay" onClick={onClose} />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl border-t border-border-subtle bg-bg-secondary shadow-xl sheet-up',
          fullScreen ? 'top-0 rounded-t-none' : 'max-h-[90vh]',
          'lg:left-auto lg:top-0 lg:right-0 lg:bottom-0 lg:w-[480px] lg:rounded-none lg:border-l lg:border-t-0 lg:slide-in'
        )}
      >
        {/* Handle bar (mobile only) */}
        {!fullScreen && (
          <div className="flex justify-center py-2 lg:hidden">
            <div className="h-1 w-10 rounded-full bg-border-subtle" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary active:bg-bg-elevated touch-target"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            <div className="flex h-8 w-8 items-center justify-center">
              {rightAction || <span />}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain safe-bottom">
          {children}
        </div>
      </div>
    </>
  )
}
