import { clsx } from 'clsx'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  icon?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary:
    'bg-transparent border border-border hover:border-accent/50 hover:bg-accent/5 text-text',
  ghost:
    'bg-transparent hover:bg-border text-text-muted hover:text-text',
  success:
    'btn-success-themed shadow-lg shadow-success/20',
  danger:
    'bg-error hover:bg-error/90 text-white shadow-lg shadow-error/20',
}

const sizeClasses = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
}

export function Button({
  variant = 'primary',
  loading = false,
  icon,
  size = 'md',
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  )
}
