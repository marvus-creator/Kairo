import { forwardRef, useId, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Subject } from '../domain/types'
import { subjectIcon } from './icons'

export const cx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'now' | 'danger' | 'inverse'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-2 shadow-[var(--shadow)]',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  now: 'bg-now text-white hover:brightness-110 shadow-[0_6px_20px_-8px_var(--now)]',
  danger: 'bg-surface text-bad border border-line hover:bg-[color-mix(in_oklab,var(--bad)_8%,var(--surface))]',
  inverse: 'bg-brand-ink text-brand hover:brightness-95',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-2xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex max-w-full select-none items-center justify-center font-medium whitespace-nowrap transition-[background,color,transform,filter] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={cx('shrink-0', size === 'sm' ? 'size-3.5' : 'size-4')} strokeWidth={2.2} aria-hidden />}
      {children !== undefined && children !== null && <span className="min-w-0 truncate">{children}</span>}
      {IconRight && <IconRight className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2.2} aria-hidden />}
    </button>
  )
})

export function IconButton({ icon: Icon, label, className, size = 'md', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink',
        size === 'sm' ? 'size-8' : 'size-10',
        className,
      )}
      {...rest}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} strokeWidth={2} aria-hidden />
    </button>
  )
}

export function Card({ className, children, as: As = 'section', style, ...rest }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article'; style?: CSSProperties } & Record<string, unknown>) {
  return (
    <As className={cx('card', className)} style={style} {...rest}>
      {children}
    </As>
  )
}

export function SectionTitle({ children, action, icon: Icon, id }: { children: ReactNode; action?: ReactNode; icon?: LucideIcon; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">
        {Icon && <Icon className="size-4" strokeWidth={2.2} aria-hidden />}
        {children}
      </h2>
      {action}
    </div>
  )
}

export function SubjectDot({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
}

export function SubjectBadge({ subject, size = 'md' }: { subject?: Subject; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = subjectIcon(subject?.icon)
  const dims = size === 'sm' ? 'size-7 rounded-lg' : size === 'lg' ? 'size-12 rounded-2xl' : 'size-9 rounded-xl'
  const icon = size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-6' : 'size-[18px]'
  return (
    <span className={cx('subject-tint subject-text inline-flex shrink-0 items-center justify-center border', dims)} style={{ '--c': subject?.color ?? '#71767e' } as CSSProperties} aria-hidden>
      <Icon className={icon} strokeWidth={2} />
    </span>
  )
}

export function Chip({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'now' | 'good' | 'warn' | 'bad' | 'brand'; className?: string }) {
  const tones = {
    default: 'bg-surface-2 text-ink-2',
    now: 'bg-[color-mix(in_oklab,var(--now)_14%,transparent)] text-now',
    good: 'bg-[color-mix(in_oklab,var(--good)_14%,transparent)] text-good',
    warn: 'bg-[color-mix(in_oklab,var(--warn)_16%,transparent)] text-warn',
    bad: 'bg-[color-mix(in_oklab,var(--bad)_14%,transparent)] text-bad',
    brand: 'bg-[color-mix(in_oklab,var(--brand)_12%,transparent)] text-brand dark:text-brand-ink',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap', tones[tone], className)}>{children}</span>
}

export function SampleTag() {
  return (
    <span className="rounded-md border border-dashed border-line px-1.5 py-px text-[10.5px] font-semibold tracking-wide text-muted uppercase" title="Sample data — remove it in Settings → Data">
      Sample
    </span>
  )
}

export function ProgressBar({ value, color = 'var(--now)', className, label }: { value: number; color?: string; className?: string; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,currentColor_14%,transparent)]', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Ring({ value, size = 64, stroke = 6, color = 'var(--now)', track = 'var(--line)', children, label }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.min(1, Math.max(0, value))
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  )
}

export function Empty({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
        <Icon className="size-5" strokeWidth={2} aria-hidden />
      </div>
      <p className="font-display text-lg text-ink">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

const inputBase = 'w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted transition-colors focus:border-[color-mix(in_oklab,var(--now)_60%,var(--line))] focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-[color-mix(in_oklab,var(--now)_18%,transparent)]'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, 'h-11', className)} {...rest} />
})

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, 'h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputBase, 'min-h-20 py-2.5', className)} {...rest} />
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: LucideIcon }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 scrollbar-none">
      {options.map((o) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-all',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              active ? 'bg-surface text-ink shadow-[var(--shadow)]' : 'text-muted hover:text-ink',
            )}
          >
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[14.5px] font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-[13px] text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-brand dark:bg-good' : 'bg-line')}
      >
        <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-surface-2 px-1 font-sans text-[11px] font-semibold text-ink-2">{children}</kbd>
}
