import clsx from 'clsx'
import {
  Bell, Box, Building2, Calculator, CheckCircle2, ChevronDown, ClipboardCheck, FolderKanban, Home, Info, LayoutDashboard, LineChart, LogOut, MapPin, Menu, RotateCcw, Ruler, X,
} from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Sector } from '../data/estimator'
import { DISTRICTS } from '../data/materials'
import { pendingItems } from '../lib/metrics'
import { useAuth } from '../store/auth'
import { ROLE_META, useApp, usePrices } from '../store/store'
import { Ticker } from './Ticker'
import { Avatar } from './ui'

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? '#ffffff' : '#0B1220'} />
        <path d="M7 23V11l9-5 9 5v12" fill="none" stroke="#F5A524" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M12 23v-7h8v7" fill="none" stroke={light ? '#0B1220' : '#fff'} strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <span className={clsx('font-display text-[19px] font-extrabold tracking-tight', light ? 'text-white' : 'text-slate-900')}>
          nirmana<span className="text-brand">.</span>
        </span>
      )}
    </span>
  )
}

export function useSector(): Sector {
  const { sector } = useParams()
  return sector === 'commercial' ? 'commercial' : 'residential'
}

function SectorSwitch({ sector }: { sector: Sector }) {
  const navigate = useNavigate()
  const location = useLocation()
  const go = (s: Sector) => {
    if (s === sector) return
    // Keep the same section when switching sides; project pages fall back to the list.
    const rest = location.pathname.split('/').slice(2)
    const section = rest[0] === 'projects' && rest[1] ? 'projects' : rest.join('/') || 'dashboard'
    navigate(`/${s}/${section}`)
  }
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
      {(['residential', 'commercial'] as Sector[]).map((s) => (
        <button
          key={s}
          onClick={() => go(s)}
          className={clsx(
            'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition cursor-pointer',
            s === sector ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white',
          )}
        >
          {s === 'residential' ? <Home size={14} /> : <Building2 size={14} />}
          {s === 'residential' ? 'Residential' : 'Commercial'}
        </button>
      ))}
    </div>
  )
}

function AccountMenu() {
  const { user, logOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (!user) return null
  const meta = ROLE_META[user.role]
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg pl-1 pr-1.5 h-10 hover:bg-slate-100 cursor-pointer" aria-label="Account menu">
        <Avatar name={user.name} role={user.role} size={32} />
        <span className="hidden xl:block text-left leading-tight">
          <span className="block text-[13px] font-semibold text-slate-800">{user.name}</span>
          <span className="block text-[11px] text-slate-500">{user.org || meta.label}</span>
        </span>
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl rise">
            <div className="px-2.5 pt-1.5 pb-2.5 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
              <p className="mt-1.5 text-[11px] text-slate-500">Signed in as <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span>: {meta.description.toLowerCase()}</p>
            </div>
            <button onClick={() => { logOut(); navigate('/login', { replace: true }) }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
              <LogOut size={15} className="text-slate-400" />Log out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function DistrictSelect() {
  const { district, setDistrict } = usePrices()
  return (
    <label className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white pl-2.5 pr-1 h-9 text-sm text-slate-600">
      <MapPin size={14} className="text-slate-400" />
      <select value={district} onChange={(e) => setDistrict(e.target.value)} className="bg-transparent pr-1 text-sm font-medium text-slate-700 outline-none cursor-pointer">
        {DISTRICTS.map((d) => <option key={d.name}>{d.name}</option>)}
      </select>
    </label>
  )
}

export function AppLayout() {
  const { sector: raw } = useParams()
  const sector = useSector()
  const { projects, role, reset, toast } = useApp()
  const [mobileNav, setMobileNav] = useState(false)
  const location = useLocation()

  useEffect(() => {
    document.documentElement.dataset.sector = sector
  }, [sector])
  useEffect(() => setMobileNav(false), [location.pathname])

  if (raw !== 'residential' && raw !== 'commercial') return <Navigate to="/residential/dashboard" replace />

  const pending = projects.filter((p) => p.sector === sector).reduce((s, p) => s + pendingItems(p, role).length, 0)
  const base = `/${sector}`
  const nav = [
    { to: `${base}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { to: `${base}/projects`, label: 'Projects', icon: FolderKanban },
    { to: `${base}/approvals`, label: 'Approvals', icon: ClipboardCheck, badge: pending },
    { to: `${base}/market`, label: 'Market prices', icon: LineChart, live: true },
    { to: `${base}/estimator`, label: 'Cost estimator', icon: Calculator },
    { to: `${base}/calculators`, label: 'Material calculators', icon: Ruler },
    { to: `${base}/model`, label: '3D house model', icon: Box },
  ]

  const sidebar = (
    <aside className="flex h-full w-[248px] flex-col bg-ink text-slate-300">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link to="/"><Logo light /></Link>
        <button className="lg:hidden text-slate-400 cursor-pointer" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button>
      </div>
      <div className="px-4"><SectorSwitch sector={sector} /></div>
      <nav className="mt-5 flex-1 space-y-0.5 px-3">
        <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{sector === 'residential' ? 'Residential' : 'Commercial'} workspace</p>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => clsx(
              'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition',
              isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
            )}
          >
            {({ isActive }) => (
              <>
                <n.icon size={17} className={isActive ? 'text-accent brightness-150' : ''} />
                <span className="flex-1">{n.label}</span>
                {n.live && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400"><span className="live-dot size-1.5 rounded-full bg-emerald-400" />LIVE</span>}
                {!!n.badge && <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-slate-900">{n.badge}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
        <div className="flex items-center gap-2 text-xs font-semibold text-white"><Info size={14} className="text-brand" />Transparency first</div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">Every rupee in Nirmana is checked against market rates and approved by the client.</p>
        <button onClick={() => { reset(); toast({ title: 'Demo data reset', tone: 'info' }) }} className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-white cursor-pointer"><RotateCcw size={12} />Reset demo data</button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-full">
      <div className="hidden lg:block shrink-0">{sidebar}</div>
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileNav(false)} />
          <div className="relative h-full">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button className="lg:hidden rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-accent-soft text-accent-strong')}>
                {sector === 'residential' ? <Home size={13} /> : <Building2 size={13} />}
                {sector === 'residential' ? 'Residential' : 'Commercial'}
              </span>
            </div>
            <div className="flex-1" />
            <DistrictSelect />
            <Link to={`${base}/approvals`} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
              <Bell size={18} />
              {pending > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500 ring-2 ring-white" />}
            </Link>
            <AccountMenu />
          </div>
          <div className="border-t border-slate-100 bg-slate-50/70 py-1.5"><Ticker /></div>
        </header>
        <main className="flex-1 overflow-y-auto scroll-thin">
          <Suspense fallback={<div className="grid h-64 place-items-center text-sm text-slate-400">Loading…</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Toasts />
    </div>
  )
}

function Toasts() {
  const { toasts, dismiss } = useApp()
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto rise rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={18} className={t.tone === 'warning' ? 'text-amber-500' : t.tone === 'info' ? 'text-sky-500' : 'text-emerald-500'} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-slate-500">{t.body}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Dismiss"><X size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold text-accent">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
