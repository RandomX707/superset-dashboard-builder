import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  title?: string
  className?: string
  headerRight?: React.ReactNode
}

export function Card({ children, title, className, headerRight }: CardProps) {
  return (
    <div className={clsx('card', className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          {headerRight}
        </div>
      )}
      {children}
    </div>
  )
}

interface ZoneProps {
  label: string
  children: React.ReactNode
  className?: string
  headerRight?: React.ReactNode
}

export function Zone({ label, children, className, headerRight }: ZoneProps) {
  return (
    <div className={clsx('card', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </span>
        {headerRight}
      </div>
      {children}
    </div>
  )
}

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  right?: React.ReactNode
}

export function SectionHeader({ eyebrow, title, subtitle, right }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-bold text-text">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
        )}
      </div>
      {right && <div className="shrink-0 ml-4">{right}</div>}
    </div>
  )
}
