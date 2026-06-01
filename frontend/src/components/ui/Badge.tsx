import { clsx } from 'clsx'

type BadgeVariant =
  | 'default'
  | 'success'
  | 'error'
  | 'warning'
  | 'accent'
  | 'muted'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-border text-text',
  success: 'bg-success/15 text-success border border-success/30',
  error: 'bg-error/15 text-error border border-error/30',
  warning: 'bg-warning/15 text-warning border border-warning/30',
  accent: 'bg-accent/15 text-accent border border-accent/30',
  muted: 'bg-border text-text-muted',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
