import clsx from 'clsx'
import { Check, ChevronLeft, ChevronRight, Copy, Loader2, X } from 'lucide-react'
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Link, type LinkProps } from 'react-router-dom'
import { toast } from 'sonner'
import type { BookingStatus, BrokerStatus } from '@/data/types'
import { BROKER_STATUS_LABEL, BROKER_STATUS_TONE, initials, STATUS_LABEL, STATUS_TONE, type Tone } from '@/lib/format'

export const cn = clsx

// ---------------------------------------------------------------- buttons

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'inverse'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-paddy-600 text-white hover:bg-paddy-700 active:bg-paddy-800 disabled:bg-paddy-600/50',
  secondary: 'bg-white text-ink border border-line hover:bg-paper-2 hover:border-ink-3/40 disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-ink/5 hover:text-ink disabled:text-ink-3',
  danger: 'bg-white text-brick-600 border border-brick-100 hover:bg-brick-50 disabled:opacity-50',
  accent: 'bg-turmeric-400 text-ink hover:bg-turmeric-300 active:bg-turmeric-400 disabled:opacity-60',
  inverse: 'bg-paper text-ink hover:bg-white',
}
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-field',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-field',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0',
    VARIANT[variant],
    SIZE[size],
    extra,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  )
})

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('inline-grid size-9 place-items-center rounded-field text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink [&_svg]:size-[18px]', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------- form fields

export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
  htmlFor,
}: {
  label: string
  hint?: ReactNode
  error?: string
  optional?: boolean
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-3">Optional</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-brick-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  )
}

const fieldBase =
  'w-full rounded-field border bg-white text-[15px] text-ink placeholder:text-ink-3/70 transition-[border-color,box-shadow] outline-none focus:border-paddy-500 focus:ring-3 focus:ring-paddy-500/15 disabled:bg-paper-2 disabled:text-ink-3'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; prefix?: ReactNode }>(function Input(
  { className, invalid, prefix, ...rest },
  ref,
) {
  if (prefix) {
    return (
      <div className={cn('flex h-11 items-center rounded-field border bg-white focus-within:border-paddy-500 focus-within:ring-3 focus-within:ring-paddy-500/15', invalid ? 'border-brick-500' : 'border-line', className)}>
        <span className="pl-3 text-[15px] text-ink-3 select-none">{prefix}</span>
        <input ref={ref} className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-ink-3/70" aria-invalid={invalid || undefined} {...rest} />
      </div>
    )
  }
  return <input ref={ref} className={cn(fieldBase, 'h-11 px-3', invalid ? 'border-brick-500' : 'border-line', className)} aria-invalid={invalid || undefined} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-24 px-3 py-2.5 leading-relaxed', invalid ? 'border-brick-500' : 'border-line', className)} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; compact?: boolean }>(function Select(
  { className, invalid, compact, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        fieldBase,
        'appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2020%2020%27%20fill%3D%27%236a7a6f%27%3E%3Cpath%20d%3D%27M5.5%207.5l4.5%204.5%204.5-4.5%27%20stroke%3D%27%236a7a6f%27%20stroke-width%3D%271.6%27%20fill%3D%27none%27/%3E%3C/svg%3E")] bg-[length:18px] bg-[right_10px_center] bg-no-repeat pr-9 pl-3',
        compact ? 'h-9 text-sm' : 'h-11',
        invalid ? 'border-brick-500' : 'border-line',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
})

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-paddy-600' : 'bg-line')}
      >
        <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  )
}

export function Checkbox({ checked, onChange, label, className, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className={cn('size-4 cursor-pointer rounded border-line accent-paddy-600', className)}
    />
  )
}

/** Segmented control for short, mutually exclusive choices. */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div role="tablist" className={cn('inline-flex max-w-full gap-0.5 overflow-x-auto rounded-field border border-line bg-paper-2/70 p-0.5 scrollbar-thin', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-[6px] font-semibold transition-colors',
            size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-8 px-3 text-sm',
            value === o.value ? 'bg-white text-ink shadow-[0_1px_2px_rgba(19,38,28,0.12)]' : 'text-ink-3 hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={cn('tabular text-xs', value === o.value ? 'text-ink-3' : 'text-ink-3/80')}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- display

const TONE: Record<Tone, string> = {
  green: 'bg-paddy-50 text-paddy-700 ring-paddy-200/70',
  amber: 'bg-turmeric-50 text-turmeric-800 ring-turmeric-300/60',
  red: 'bg-brick-50 text-brick-600 ring-brick-100',
  blue: 'bg-sky-50 text-sky-600 ring-sky-100',
  neutral: 'bg-paper-2 text-ink-3 ring-line',
  ink: 'bg-ink text-paper ring-ink',
}

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset', TONE[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export const StatusBadge = ({ status }: { status: BookingStatus }) => (
  <Badge tone={STATUS_TONE[status]} dot={status !== 'completed'}>
    {status === 'completed' && <Check className="size-3" strokeWidth={3} />}
    {STATUS_LABEL[status]}
  </Badge>
)

export const BrokerStatusBadge = ({ status }: { status: BrokerStatus }) => (
  <Badge tone={BROKER_STATUS_TONE[status]} dot>
    {BROKER_STATUS_LABEL[status]}
  </Badge>
)

const AVATAR_TINTS = ['bg-paddy-100 text-paddy-800', 'bg-turmeric-100 text-turmeric-800', 'bg-sky-100 text-sky-600', 'bg-brick-100 text-brick-600', 'bg-paper-2 text-ink-2']

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const tint = AVATAR_TINTS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TINTS.length]
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-display font-semibold',
        size === 'sm' ? 'size-7 text-[11px]' : size === 'lg' ? 'size-14 text-lg' : 'size-9 text-[13px]',
        tint,
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function Panel({ title, description, actions, children, className, bodyClassName, id }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section id={id} className={cn('rounded-panel border border-line-soft bg-white', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line-soft px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, sub, tone, icon, onClick, active }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'green' | 'amber' | 'red' | 'blue' | 'ink'; icon?: ReactNode; onClick?: () => void; active?: boolean }) {
  const bar = { green: 'bg-paddy-500', amber: 'bg-turmeric-400', red: 'bg-brick-500', blue: 'bg-sky-600', ink: 'bg-ink' }[tone ?? 'ink']
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative flex min-w-0 flex-col items-start overflow-hidden rounded-panel border bg-white p-4 text-left transition-colors',
        active ? 'border-ink' : 'border-line-soft',
        onClick && 'hover:border-ink-3/50',
      )}
    >
      <span className={cn('absolute top-4 left-0 h-5 w-[3px] rounded-r', bar)} />
      <span className="flex w-full items-center justify-between gap-2 text-[13px] font-medium text-ink-3">
        {label}
        {icon && <span className="text-ink-3/70 [&_svg]:size-4">{icon}</span>}
      </span>
      <span className="mt-2 font-display text-[28px] leading-none font-semibold tabular text-ink">{value}</span>
      {sub && <span className="mt-2 text-xs text-ink-3">{sub}</span>}
    </Tag>
  )
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-full bg-paper-2 text-ink-3 [&_svg]:size-5">{icon}</div>}
      <p className="font-display text-base font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-paper-2', className)} />
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-6">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 hover:text-ink">
            <ChevronLeft className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied', variant = 'secondary', size = 'md', className }: { value: string; label?: string; copiedLabel?: string; variant?: Variant; size?: Size; className?: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const t = document.createElement('textarea')
      t.value = value
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setDone(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setDone(false), 1800)
  }
  return (
    <Button variant={variant} size={size} onClick={copy} icon={done ? <Check /> : <Copy />} className={className}>
      {done ? copiedLabel : label}
    </Button>
  )
}

export function Pagination({ page, pageCount, onPage, total, pageSize }: { page: number; pageCount: number; onPage: (p: number) => void; total: number; pageSize: number }) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3 text-[13px] text-ink-3 sm:px-5">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <IconButton label="Previous page" onClick={() => onPage(page - 1)} disabled={page <= 1} className="disabled:opacity-30">
          <ChevronLeft />
        </IconButton>
        <span className="tabular px-1 font-semibold text-ink">
          {page} / {pageCount}
        </span>
        <IconButton label="Next page" onClick={() => onPage(page + 1)} disabled={page >= pageCount} className="disabled:opacity-30">
          <ChevronRight />
        </IconButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- overlays

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

/** Right-hand sheet on desktop, full-height sheet on phones. Used for record details. */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-xl' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useLockScroll(open)
  useEscape(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px] animate-[pop_0.2s_ease-out_both]" onClick={onClose} />
      <aside role="dialog" aria-modal="true" className={cn('relative flex h-full w-full flex-col bg-paper shadow-2xl animate-slide-in', width)}>
        <header className="flex items-start justify-between gap-4 border-b border-line-soft bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[13px] text-ink-3">{subtitle}</div>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
        {footer && <footer className="border-t border-line-soft bg-white px-5 py-3">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  )
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  useLockScroll(open)
  useEscape(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl animate-pop sm:rounded-panel',
          size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl',
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
            <X />
          </IconButton>
        </header>
        {children && <div className="overflow-y-auto px-5 pb-5 scrollbar-thin">{children}</div>}
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line-soft px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel, danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep as is
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-2">{body}</div>
    </Modal>
  )
}

/** Key/value rows inside drawers. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line-soft">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-4 py-2.5 text-sm">
          <dt className="text-ink-3">{i.label}</dt>
          <dd className="min-w-0 font-medium break-words text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}
