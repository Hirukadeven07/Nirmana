import clsx from 'clsx'
import { CalendarDays, MapPin, Search, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, useSector } from '../components/Layout'
import { Avatar, Card, Progress, Tabs } from '../components/ui'
import type { Project } from '../data/types'
import { date, num, rsCompact } from '../lib/format'
import { currentStage, HEALTH_STYLE, projectMetrics } from '../lib/metrics'
import { useApp } from '../store/store'

type Filter = 'all' | 'active' | 'attention' | 'pre'

export default function Projects() {
  const sector = useSector()
  const { projects } = useApp()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const list = projects
    .filter((p) => p.sector === sector)
    .filter((p) => !q || `${p.name} ${p.location} ${p.client.name} ${p.contractor.org}`.toLowerCase().includes(q.toLowerCase()))
    .filter((p) => filter === 'all' || (filter === 'active' && p.progress > 0) || (filter === 'attention' && (p.health === 'At risk' || p.health === 'Delayed')) || (filter === 'pre' && p.health === 'Pre-construction'))

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Projects" subtitle={`${sector === 'residential' ? 'Homes, villas and renovations' : 'Offices, retail and industrial'} shared between client, architect and contractor.`} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs<Filter> value={filter} onChange={setFilter} tabs={[{ id: 'all', label: 'All' }, { id: 'active', label: 'Under construction' }, { id: 'attention', label: 'Needs attention' }, { id: 'pre', label: 'Pre-construction' }]} />
        <label className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, people, places…" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-accent sm:w-72" />
        </label>
      </div>
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {list.map((p) => <ProjectCard key={p.id} p={p} />)}
      </div>
      {list.length === 0 && <p className="py-16 text-center text-sm text-slate-500">No projects match your filters.</p>}
    </div>
  )
}

function ProjectCard({ p }: { p: Project }) {
  const m = projectMetrics(p)
  const h = HEALTH_STYLE[p.health]
  return (
    <Link to={`/${p.sector}/projects/${p.id}`} className="group">
      <Card className="overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <div className="relative h-32 overflow-hidden" style={{ background: `linear-gradient(135deg, ${p.cover[0]}, ${p.cover[1]})` }}>
          <svg viewBox="0 0 400 130" className="absolute inset-0 h-full w-full opacity-25" preserveAspectRatio="xMidYMid slice">
            {Array.from({ length: 20 }, (_, i) => <line key={i} x1={i * 20} x2={i * 20} y1={0} y2={130} stroke="#fff" strokeWidth={0.5} />)}
            {Array.from({ length: 7 }, (_, i) => <line key={i} y1={i * 20} y2={i * 20} x1={0} x2={400} stroke="#fff" strokeWidth={0.5} />)}
            {p.sector === 'residential'
              ? <path d="M240 120 V70 L290 40 L340 70 V120 Z M265 120 V90 H285 V120" fill="none" stroke="#fff" strokeWidth={2.5} />
              : <path d="M260 120 V30 H320 V120 M270 40 H310 M270 55 H310 M270 70 H310 M270 85 H310 M270 100 H310 M330 120 V70 H370 V120" fill="none" stroke="#fff" strokeWidth={2.5} />}
          </svg>
          <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold" style={{ color: h.fg }}>
            <span className="size-1.5 rounded-full" style={{ background: h.dot }} />{p.health}
          </div>
          <div className="absolute bottom-3 left-4 text-white">
            <p className="text-xs opacity-80">{p.type}</p>
            <p className="font-display text-xl font-bold">{p.name}</p>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><MapPin size={13} />{p.location}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{date(p.start, false)} → {date(p.end)}</span>
            <span className="inline-flex items-center gap-1"><Users size={13} />{num(p.area)} sq ft · {p.floors} fl</span>
          </div>
          <div>
            <div className="flex justify-between text-xs"><span className="font-medium text-slate-600">{currentStage(p)}</span><span className="num font-semibold">{p.progress}%</span></div>
            <Progress value={p.progress} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
            <div><p className="text-[11px] text-slate-500">Contract</p><p className="num text-sm font-bold">{rsCompact(m.revised)}</p></div>
            <div><p className="text-[11px] text-slate-500">Spent</p><p className="num text-sm font-bold">{rsCompact(m.costToDate)}</p></div>
            <div><p className="text-[11px] text-slate-500">Forecast</p><p className={clsx('num text-sm font-bold', m.variance > m.revised * 0.01 ? 'text-red-600' : 'text-emerald-700')}>{rsCompact(m.eac)}</p></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex -space-x-2">
              <span className="rounded-full ring-2 ring-white"><Avatar name={p.client.name} role="client" size={28} /></span>
              <span className="rounded-full ring-2 ring-white"><Avatar name={p.architect.name} role="architect" size={28} /></span>
              <span className="rounded-full ring-2 ring-white"><Avatar name={p.contractor.name} role="contractor" size={28} /></span>
            </div>
            <span className="text-xs text-slate-500">Transparency <b className="num text-slate-800">{m.transparency}</b>/100</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
