'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

interface ToastContextType {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })
export const useToast = () => useContext(ToastContext)

const icons: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const borderColors: Record<ToastVariant, string> = {
  success: 'border-l-accent-green',
  error: 'border-l-accent-red',
  info: 'border-l-accent-blue',
}

const iconColors: Record<ToastVariant, string> = {
  success: 'text-accent-green',
  error: 'text-accent-red',
  info: 'text-accent-blue',
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100)
  const duration = toast.duration ?? 4000
  const Icon = icons[toast.variant]

  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining <= 0) {
        clearInterval(timer)
        onDismiss(toast.id)
      }
    }, 30)
    return () => clearInterval(timer)
  }, [toast.id, duration, onDismiss])

  return (
    <div className={cn(
      'toast-in pointer-events-auto flex w-80 items-start gap-3 rounded-lg border-l-4 bg-bg-secondary p-4 shadow-xl',
      borderColors[toast.variant]
    )}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColors[toast.variant])} />
      <p className="flex-1 text-sm text-text-primary">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-text-tertiary hover:text-text-secondary"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-lg">
        <div
          className={cn('h-full transition-none', iconColors[toast.variant].replace('text-', 'bg-'))}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, variant: ToastVariant = 'success', duration?: number) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant, duration }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
