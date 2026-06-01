import { clsx } from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const inputBase =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 focus-ring transition-colors'

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</label>
      )}
      <input className={clsx(inputBase, className)} {...props} />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</label>
      )}
      <select
        className={clsx(
          inputBase,
          'cursor-pointer appearance-none',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Textarea({
  label,
  error,
  className,
  ...props
}: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</label>
      )}
      <textarea
        className={clsx(inputBase, 'resize-none', className)}
        {...props}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
