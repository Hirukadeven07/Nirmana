import clsx from 'clsx'
import { Suspense } from 'react'
import { ChevronLeft, MapPin, Phone } from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { Avatar, RoleBadge } from '../../components/ui'
import type { Project, Role } from '../../data/types'
import { date, num } from '../../lib/format'
import { HEALTH_STYLE, pendingItems } from '../../lib/metrics'
import { useApp } from '../../store/store'

export function useProject(): Project {
  return useOutletContext<{ project: Project }>().project
}

export default function ProjectLayout() {
  const { projectId, sector } = useParams()
  const { getProject } = useApp()
  const project = getProject(projectId ?? '')
  if (!project) return <Navigate to={`/${sector}/projects`} replace />
  if (project.sector !== sector) return <Navigate to={`/${project.sector}/projects/${project.id}`} replace />

  const h = HEALTH_STYLE[project.health]
  const base = `/${project.sector}/projects/${project.id}`
  const clientPending = pendingItems(project, 'client')
  const tabs = [
    { to: base, label: 'Overview', end: true },
    { to: `${base}/schedule`, label: 'Schedule' },
    { to: `${base}/progress`, label: 'Site progress', count: project.logs.filter((l) => l.acknowledgedBy.length < 2).length },
    { to: `${base}/budget`, label: 'Budget & cost curve' },
    { to: `${base}/materials`, label: 'Materials & BOQ' },
    { to: `${base}/plans`, label: 'Plans', count: project.plans.filter((p) => p.status === 'Awaiting client').length },
    { to: `${base}/tour`, label: '3D tour' },
    { to: `${base}/changes`, label: 'Change orders', count: clientPending.filter((i) => i.kind === 'change').length },
    { to: `${base}/payments`, label: 'Payments', count: clientPending.filter((i) => i.kind === 'payment').length },
    { to: `${base}/ledger`, label: 'Cost ledger' },
  ]

  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 pt-5 sm:px-6 lg:px-8">
          <Link to={`/${project.sector}/projects`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><ChevronLeft size={14} />All projects</Link>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="size-14 shrink-0 rounded-2xl" style={{ background: `linear-gradient(135deg, ${project.cover[0]}, ${project.cover[1]})` }} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">{project.name}</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: h.bg, color: h.fg }}><span className="size-1.5 rounded-full" style={{ background: h.dot }} />{project.health}</span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
                  <span>{project.type}</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={13} />{project.location}</span>
                  <span>{num(project.area)} sq ft · {project.floors} floor{project.floors > 1 ? 's' : ''}</span>
                  <span>{date(project.start)} → {date(project.end)}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['client', 'architect', 'contractor'] as Role[]).map((r) => {
                const person = r === 'client' ? project.client : r === 'architect' ? project.architect : project.contractor
                return (
                  <div key={r} className="group relative flex items-center gap-2 rounded-xl border border-slate-200 py-1.5 pl-1.5 pr-3">
                    <Avatar name={person.name} role={r} size={30} />
                    <div className="leading-tight">
                      <RoleBadge role={r} />
                      <p className="max-w-[150px] truncate text-xs font-semibold text-slate-800">{person.org}</p>
                    </div>
                    <div className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 opacity-0 shadow-xl transition group-hover:opacity-100">
                      <p className="text-sm font-semibold">{person.name}</p>
                      <p className="text-xs text-slate-500">{person.org}</p>
                      {person.credential && <p className="mt-1.5 text-xs font-medium text-emerald-700">✓ {person.credential}</p>}
                      <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-slate-600"><Phone size={12} />{person.phone}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <nav className="-mb-px mt-5 flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => clsx('inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-sm font-semibold transition', isActive ? 'border-accent text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                {t.label}
                {!!t.count && <span className="rounded-full bg-brand/20 px-1.5 text-[10px] font-bold text-amber-800">{t.count}</span>}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<div className="grid h-64 place-items-center text-sm text-slate-400">Loading…</div>}>
          <Outlet context={{ project }} />
        </Suspense>
      </div>
    </div>
  )
}
