'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle py-16 px-6 text-center', className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated">
        <Icon className="h-8 w-8 text-text-tertiary" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mb-5 max-w-xs text-xs text-text-tertiary leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-lg bg-accent-green px-5 py-2.5 text-sm font-semibold text-bg-primary transition-all hover:brightness-110 active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
