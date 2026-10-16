import { ArrowRight, Banknote, ClipboardCheck, FolderKanban, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, useSector } from '../components/Layout'
import { Avatar, Badge, Card, CardHeader, Delta, Progress, RoleBadge, Stat } from '../components/ui'
import { ChartTooltip, Sparkline } from '../components/visuals'
import { costIndexHistory, HISTORY_MONTHS, MATERIALS, priceHistory } from '../data/materials'
import type { Project } from '../data/types'
import { axisRs, date, monthLabel, num, pct, relative, rsCompact } from '../lib/format'
import { currentStage, HEALTH_STYLE, pendingItems, projectMetrics } from '../lib/metrics'
import { ROLE_META, useApp, usePrices } from '../store/store'

export default function Dashboard() {
  const sector = useSector()
  const { projects, role, personFor } = useApp()
  const { prices } = usePrices()
  const list = projects.filter((p) => p.sector === sector)
  const metrics = list.map((p) => ({ p, m: projectMetrics(p) }))
  const totalContract = metrics.reduce((s, x) => s + x.m.revised, 0)
  const spent = metrics.reduce((s, x) => s + x.m.costToDate, 0)
  const paid = metrics.reduce((s, x) => s + x.m.paid, 0)
  const pending = list.flatMap((p) => pendingItems(p, role).map((i) => ({ ...i, project: p })))
  const avgTrust = Math.round(metrics.reduce((s, x) => s + x.m.transparency, 0) / Math.max(1, metrics.length))
  const activity = list.flatMap((p) => p.activity.map((a) => ({ ...a, project: p }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
  const me = list[0] ? personFor(list[0]) : null

  const index = costIndexHistory()
  const indexData = HISTORY_MONTHS.map((m, i) => ({ month: m, NCCI: index[i] }))
  const yoy = index[23]! / index[11]! - 1

  const movers = MATERIALS.filter((m) => m.category !== 'Labour')
    .map((m) => { const h = priceHistory(m); return { m, change: prices[m.id]!.price / h[h.length - 4]! - 1, spark: h.slice(-12) } })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5)

  const budgetData = metrics.map(({ p, m }) => ({ name: p.name.split(' ').slice(0, 2).join(' '), Contract: m.revised, Earned: m.earned, Spent: m.costToDate }))

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow={date(new Date('2026-10-16').toISOString())}
        title={<>Ayubowan{me && !/PLC|Properties|Logistics|Holdings|Lanka|Ltd/.test(me.name) ? `, ${me.name.replace(/^(Archt\.|Eng\.|Dr\.|Mrs\.)\s*/, '').split(' ')[0]}` : ''} <span className="text-slate-300">·</span> <span className="text-slate-500 font-bold">{sector === 'residential' ? 'Residential' : 'Commercial'} portfolio</span></>}
        subtitle={<>Viewing as <RoleBadge role={role} /> — {ROLE_META[role].description.toLowerCase()}.</>}
        actions={<Link to={`/${sector}/estimator`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent-strong">New estimate <ArrowRight size={15} /></Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Active projects" value={list.length} sub={`${list.filter((p) => p.health === 'On track').length} on track · ${list.filter((p) => p.health === 'At risk' || p.health === 'Delayed').length} need attention`} icon={<FolderKanban size={15} />} />
        <Stat label="Portfolio value" value={rsCompact(totalContract)} sub="Incl. approved change orders" icon={<Wallet size={15} />} />
        <Stat label="Cost to date" value={rsCompact(spent)} sub={`${pct((spent / totalContract) * 100, 0)} of portfolio`} icon={<TrendingUp size={15} />} />
        <Stat label="Paid to contractors" value={rsCompact(paid)} sub="Certified milestones" icon={<Banknote size={15} />} />
        <Stat label="Transparency score" value={<>{avgTrust}<span className="text-sm text-slate-400">/100</span></>} sub="Receipts, rate checks, logs" icon={<ShieldCheck size={15} />} tone="up" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader title="Projects" subtitle="Progress, cost and health at a glance" action={<Link to={`/${sector}/projects`} className="text-xs font-semibold text-accent hover:underline">View all</Link>} />
            <div className="divide-y divide-slate-100">
              {metrics.map(({ p, m }) => <ProjectRow key={p.id} p={p} m={m} />)}
            </div>
          </Card>

          <Card>
            <CardHeader title="Contract vs earned vs spent" subtitle="Earned value = revised contract × % complete. Spending above earned value is an early overrun warning." />
            <div className="h-64 px-2 pb-4">
              <ResponsiveContainer>
                <BarChart data={budgetData} barGap={2} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={axisRs} tickLine={false} axisLine={false} width={64} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Contract" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Earned" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Spent" fill="#f5a524" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Needs your attention" subtitle={`${pending.length} item${pending.length === 1 ? '' : 's'} waiting on the ${ROLE_META[role].label.toLowerCase()}`} icon={<ClipboardCheck size={16} />} />
            <div className="px-3 pb-3">
              {pending.length === 0 && <p className="px-2 pb-3 text-sm text-slate-500">You're all caught up.</p>}
              {pending.slice(0, 5).map((i) => (
                <Link key={i.id} to={`/${sector}/approvals`} className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{i.title}</p>
                    <p className="truncate text-xs text-slate-500">{i.project.name} · {i.detail}</p>
                  </div>
                  {i.amount != null && <span className="num text-xs font-semibold text-slate-700">{rsCompact(i.amount)}</span>}
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Construction Cost Index" subtitle="NCCI basket, Nov 2024 = 100" action={<Link to={`/${sector}/market`} className="text-xs font-semibold text-accent hover:underline">Market</Link>} />
            <div className="flex items-end gap-3 px-5">
              <span className="num font-display text-3xl font-bold">{index[23]!.toFixed(1)}</span>
              <span className="mb-1"><Delta value={yoy} invert /> <span className="text-xs text-slate-500">12 months</span></span>
            </div>
            <div className="h-28 px-2 pb-3">
              <ResponsiveContainer>
                <AreaChart data={indexData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs><linearGradient id="ncci" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f5a524" stopOpacity={0.35} /><stop offset="1" stopColor="#f5a524" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="month" hide />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
                  <Tooltip content={<ChartTooltip fmt={(v) => v.toFixed(1)} labelFmt={monthLabel} />} />
                  <Area dataKey="NCCI" stroke="#f59e0b" strokeWidth={2} fill="url(#ncci)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="border-t border-slate-100 px-5 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">3-month movers</p>
              {movers.map(({ m, change, spark }) => (
                <div key={m.id} className="flex items-center gap-3 py-1.5">
                  <span className="flex-1 truncate text-sm text-slate-700">{m.name}</span>
                  <Sparkline data={spark} width={60} height={20} />
                  <span className="w-14 text-right"><Delta value={change} invert /></span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity" subtitle="Shared audit trail across all parties" />
            <ol className="px-5 pb-4">
              {activity.map((a) => (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  <Avatar name={a.actor} role={a.role} size={28} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-slate-700"><span className="font-semibold text-slate-900">{a.actor}</span> {a.text}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{a.project.name} · {relative(a.date)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ProjectRow({ p, m }: { p: Project; m: ReturnType<typeof projectMetrics> }) {
  const h = HEALTH_STYLE[p.health]
  const overspend = m.costToDate - m.earned
  return (
    <Link to={`/${p.sector}/projects/${p.id}`} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 transition hover:bg-slate-50/70">
      <div className="flex min-w-[200px] flex-1 items-center gap-3.5">
        <div className="size-11 shrink-0 rounded-xl" style={{ background: `linear-gradient(135deg, ${p.cover[0]}, ${p.cover[1]})` }} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{p.name}</p>
          <p className="truncate text-xs text-slate-500">{p.location} · {num(p.area)} sq ft</p>
          <p className="truncate text-xs text-slate-400">{currentStage(p)}</p>
        </div>
      </div>
      <div className="w-32">
        <div className="flex justify-between text-xs"><span className="text-slate-500">Progress</span><span className="num font-semibold">{p.progress}%</span></div>
        <Progress value={p.progress} className="mt-1.5" />
      </div>
      <div className="w-36 text-xs">
        <div className="flex justify-between gap-2"><span className="text-slate-500">Spent</span><span className="num whitespace-nowrap font-semibold">{rsCompact(m.costToDate)}</span></div>
        <div className={`num mt-1 whitespace-nowrap text-[11px] ${m.earned === 0 ? 'text-slate-400' : overspend > m.earned * 0.02 ? 'text-red-600' : 'text-emerald-600'}`}>
          {m.earned > 0 ? `${overspend >= 0 ? '+' : '−'}${rsCompact(Math.abs(overspend))} vs earned` : 'Not started'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="!ring-0" tone="slate"><span className="size-1.5 rounded-full" style={{ background: h.dot }} /><span style={{ color: h.fg }}>{p.health}</span></Badge>
        <span className="num rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600" title="Transparency score">{m.transparency}</span>
      </div>
    </Link>
  )
}
