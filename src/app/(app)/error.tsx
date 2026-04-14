'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 rounded-full bg-surface-red p-4">
        <AlertTriangle className="h-8 w-8 text-accent-red" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-text-primary">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm text-text-secondary">{error.message || 'An unexpected error occurred. Your data is safe.'}</p>
      <button
        onClick={reset}
        className="btn-press flex items-center gap-2 rounded-lg bg-accent-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        <RotateCcw className="h-4 w-4" />
        Try again
      </button>
    </div>
  )
}
