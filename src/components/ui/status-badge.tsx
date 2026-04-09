import { cn } from '@/lib/utils'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'

interface StatusBadgeProps {
  label: string
  variant?: BadgeVariant
  pulse?: boolean
  size?: 'sm' | 'md'
}

const variants: Record<BadgeVariant, string> = {
  success: 'bg-surface-green text-accent-green',
  warning: 'bg-surface-amber text-accent-amber',
  danger: 'bg-surface-red text-accent-red',
  info: 'bg-surface-blue text-accent-blue',
  neutral: 'bg-bg-elevated text-text-secondary',
  purple: 'bg-surface-purple text-accent-purple',
}

export function StatusBadge({ label, variant = 'neutral', size = 'sm' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variants[variant],
        size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      )}
    >
      {label}
    </span>
  )
}

/** Map invoice status to badge variant */
export function invoiceStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'paid': return 'success'
    case 'sent': return 'info'
    case 'viewed': return 'warning'
    case 'overdue': return 'danger'
    case 'void': return 'neutral'
    case 'draft':
    default: return 'neutral'
  }
}
