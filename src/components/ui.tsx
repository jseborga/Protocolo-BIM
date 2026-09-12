import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return <div className={`card ${padded ? 'p-5' : ''} ${className}`}>{children}</div>
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="muted mt-1 max-w-2xl text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="muted mt-0.5 text-xs">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

const TONES = {
  neutral: 'bg-[color:var(--surface-sunken)] text-[color:var(--text-muted)]',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  slate: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
} as const

export type Tone = keyof typeof TONES

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: Tone
  title?: string
}) {
  return (
    <span className={`badge ${TONES[tone]}`} title={title}>
      {children}
    </span>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="muted rounded-lg border border-dashed border-[color:var(--border)] px-4 py-6 text-center text-sm">
      {children}
    </p>
  )
}

export function Progress({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'green' }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-sunken)]"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${tone === 'green' ? 'bg-emerald-500' : 'bg-brand-600'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="card p-4">
      <p className="muted text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="muted mt-1 text-xs">{hint}</p> : null}
    </div>
  )
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {children}
    </p>
  )
}

export function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-[color:var(--surface-sunken)] px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  )
}
