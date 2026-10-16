import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { Role } from '../data/types'
import { initials } from '../lib/format'
import { ROLE_META } from '../store/store'

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('card', className)} {...rest}>{children}</div>
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <div className="mt-0.5 text-slate-400">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold text-slate-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent-strong shadow-sm',
        variant === 'secondary' && 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        variant === 'danger' && 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
        variant === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'slate', className }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'accent'; className?: string }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    red: 'bg-red-50 text-red-700 ring-red-600/15',
    blue: 'bg-sky-50 text-sky-700 ring-sky-600/15',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
    accent: 'bg-accent-soft text-accent-strong',
  }
  return <span className={clsx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-transparent whitespace-nowrap', tones[tone], className)}>{children}</span>
}

export function Progress({ value, className, color, height = 6 }: { value: number; className?: string; color?: string; height?: number }) {
  return (
    <div className={clsx('w-full rounded-full bg-slate-100 overflow-hidden', className)} style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ?? 'var(--accent)' }} />
    </div>
  )
}

export function Ring({ value, size = 56, stroke = 6, color, children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef0f3" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color ?? 'var(--accent)'} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset .8s' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function Stat({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon && <span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent">{icon}</span>}
      </div>
      <div className="mt-2 font-display text-[22px] font-bold text-slate-900 leading-none num">{value}</div>
      {sub && <div className={clsx('mt-1.5 text-xs', tone === 'down' ? 'text-red-600' : tone === 'up' ? 'text-emerald-600' : 'text-slate-500')}>{sub}</div>}
    </Card>
  )
}

export function Avatar({ name, role, size = 32 }: { name: string; role?: Role; size?: number }) {
  const meta = role ? ROLE_META[role] : undefined
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36, background: meta?.bg ?? '#e2e8f0', color: meta?.color ?? '#334155' }}
      title={name}
    >
      {initials(name)}
    </span>
  )
}

export function RoleBadge({ role }: { role: Role }) {
  const m = ROLE_META[role]
  return <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: m.bg, color: m.color }}>{m.label}</span>
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={clsx('inline-flex rounded-lg bg-slate-100 p-0.5', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer', value === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={clsx('relative w-full rounded-2xl bg-white shadow-2xl rise max-h-[90vh] flex flex-col', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5 scroll-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-3.5 bg-slate-50/60 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}

export const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition'

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div>
      <p className="mt-3 font-semibold text-slate-800">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Delta({ value, digits = 1, invert = false, className }: { value: number; digits?: number; invert?: boolean; className?: string }) {
  const good = invert ? value < 0 : value > 0
  const color = Math.abs(value) < 0.0005 ? 'text-slate-500' : good ? 'text-emerald-600' : 'text-red-600'
  const s = `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value * 100).toFixed(digits)}%`
  return <span className={clsx('num text-xs font-semibold', color, className)}>{s}</span>
}
