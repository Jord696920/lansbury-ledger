import { cn } from '@/lib/utils'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'

interface StatusBadgeProps {
  label: string
  variant?: BadgeVariant
  pulse?: boolean
  size?: 'sm' | 'md'
}

const variants: Record<BadgeVariant, string> = {
  success: 'bg-surface-green text-accent-green border-accent-green/20',
  warning: 'bg-surface-amber text-accent-amber border-accent-amber/20',
  danger: 'bg-surface-red text-accent-red border-accent-red/20',
  info: 'bg-surface-blue text-accent-blue border-accent-blue/20',
  neutral: 'bg-bg-elevated text-text-secondary border-border-subtle',
  purple: 'bg-surface-purple text-accent-purple border-accent-purple/20',
}

export function StatusBadge({ label, variant = 'neutral', pulse = false, size = 'sm' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        variants[variant],
        pulse && 'pulse-attention',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
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
