import clsx from 'clsx'
import { ArrowRight, CloudRain, CloudSun, HardHat, Send, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { Avatar, Card, CardHeader, Progress, RoleBadge, Ring } from '../../components/ui'
import { ChartTooltip, SitePhoto } from '../../components/visuals'
import { axisRs, TODAY_ISO, date, monthLabel, pct, relative, rsCompact } from '../../lib/format'
import { currentStage, PENDING_TAB, pendingItems, projectMetrics } from '../../lib/metrics'
import { useApp } from '../../store/store'
import { useProject } from './ProjectLayout'

export default function Overview() {
  const p = useProject()
  const m = projectMetrics(p)
  const { role } = useApp()
  const base = `/${p.sector}/projects/${p.id}`
  const latest = p.logs[0]
  const pending = pendingItems(p, role)
  const curve = p.curve.map((c) => ({ month: c.month, Planned: c.pv, Earned: c.ev, Actual: c.ac }))

  const score = [
    { label: 'Receipts attached', value: m.receipts, weight: 25 },
    { label: 'Entries verified', value: m.verified, weight: 15 },
    { label: 'Rates within ±5% of market', value: m.rateOk, weight: 30 },
    { label: 'Site logs, last 14 days', value: p.progress === 0 ? 1 : Math.min(1, m.recentLogs / 4), weight: 15 },
    { label: 'Decisions up to date', value: Math.max(0.4, 1 - pendingItems(p, 'client').length * 0.12), weight: 15 },
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <Card className="flex items-center gap-4 p-4">
            <Ring value={p.progress} size={62} stroke={7}><span className="num text-sm font-bold">{p.progress}%</span></Ring>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Physical progress</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{currentStage(p)}</p>
              <p className="text-xs text-slate-400">{m.daysLeft} days to handover</p>
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Revised contract</p>
            <p className="num mt-1.5 whitespace-nowrap font-display text-xl font-bold">{rsCompact(m.revised)}</p>
            <p className="mt-1 text-xs text-slate-500">Original {rsCompact(p.contractSum)} · <span className={m.approvedChanges >= 0 ? 'text-amber-700' : 'text-emerald-700'}>{m.approvedChanges >= 0 ? '+' : ''}{rsCompact(m.approvedChanges)} COs</span></p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Cost to date</p>
            <p className="num mt-1.5 whitespace-nowrap font-display text-xl font-bold">{rsCompact(m.costToDate)}</p>
            <p className={clsx('mt-1 text-xs', m.cpi >= 1 ? 'text-emerald-600' : m.cpi >= 0.97 ? 'text-amber-600' : 'text-red-600')}>CPI {m.cpi.toFixed(2)} · {m.cpi >= 1 ? 'within' : 'over'} budget for work done</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Forecast at completion</p>
            <p className={clsx('num mt-1.5 whitespace-nowrap font-display text-xl font-bold', m.variance > m.revised * 0.01 && 'text-red-600')}>{rsCompact(m.eac)}</p>
            <p className="mt-1 text-xs text-slate-500">{m.variance >= 0 ? 'Over' : 'Under'} by {rsCompact(Math.abs(m.variance))} ({pct((m.variance / m.revised) * 100, 1, true)})</p>
          </Card>
        </div>

        <Card>
          <CardHeader title="Cost S-curve" subtitle="Planned value vs earned value vs actual cost (cumulative)" action={<Link to={`${base}/budget`} className="text-xs font-semibold text-accent hover:underline">Full analysis</Link>} />
          <div className="h-64 px-2 pb-3">
            <ResponsiveContainer>
              <ComposedChart data={curve} margin={{ left: 8, right: 16, top: 4 }}>
                <defs><linearGradient id="ov-ev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity={0.25} /><stop offset="1" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tickFormatter={axisRs} tickLine={false} axisLine={false} width={60} />
                <Tooltip content={<ChartTooltip labelFmt={date} />} />
                <ReferenceLine x={TODAY_ISO} stroke="#0f172a" strokeDasharray="3 3" label={{ value: 'Today', position: 'insideTopRight', fontSize: 11, fill: '#0f172a' }} />
                <Line dataKey="Planned" stroke="#94a3b8" strokeDasharray="5 4" dot={false} strokeWidth={1.8} />
                <Area dataKey="Earned" stroke="var(--accent)" fill="url(#ov-ev)" strokeWidth={2.4} />
                <Line dataKey="Actual" stroke="#f59e0b" dot={false} strokeWidth={2.4} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {latest && (
          <Card className="overflow-hidden">
            <CardHeader title="Latest from site" subtitle={`${relative(latest.date)} · ${latest.author}`} icon={<HardHat size={16} />} action={<Link to={`${base}/progress`} className="text-xs font-semibold text-accent hover:underline">All logs</Link>} />
            <div className="grid gap-4 px-5 pb-5 md:grid-cols-[1fr_1.1fr]">
              <div className="grid grid-cols-2 gap-2">
                {latest.photos.slice(0, 2).map((ph, i) => (
                  <div key={i} className={clsx('overflow-hidden rounded-xl', latest.photos.length === 1 && 'col-span-2')}><SitePhoto photo={ph} className="h-36 w-full" /></div>
                ))}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{latest.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{latest.notes}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">{latest.weather.includes('rain') ? <CloudRain size={13} /> : latest.weather === 'Cloudy' ? <CloudSun size={13} /> : <Sun size={13} />}{latest.weather}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-1">{latest.workers} workers</span>
                  <span className="rounded-md bg-slate-100 px-2 py-1">Progress {latest.progressAfter}%</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        <Messages />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Transparency score" subtitle="How verifiable this project's numbers are" />
          <div className="flex items-center gap-4 px-5 pb-2">
            <Ring value={m.transparency} size={78} stroke={8} color={m.transparency >= 85 ? '#10b981' : m.transparency >= 70 ? '#f59e0b' : '#ef4444'}>
              <span className="num text-lg font-bold">{m.transparency}</span>
            </Ring>
            <p className="text-sm text-slate-600">{m.transparency >= 85 ? 'Excellent. Costs are well documented and match market rates.' : m.transparency >= 70 ? 'Good, with a few items that need follow-up.' : 'Several items need documentation or review.'}</p>
          </div>
          <div className="space-y-3 px-5 pb-5 pt-2">
            {score.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs"><span className="text-slate-600">{s.label}</span><span className="num font-semibold text-slate-800">{Math.round(s.value * 100)}%</span></div>
                <Progress value={s.value * 100} className="mt-1" height={5} color={s.value >= 0.9 ? '#10b981' : s.value >= 0.7 ? '#f59e0b' : '#ef4444'} />
              </div>
            ))}
            {m.flagged.length > 0 && (
              <Link to={`${base}/ledger`} className="mt-1 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                {m.flagged.length} purchase{m.flagged.length > 1 ? 's' : ''} above market rate <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Waiting on you" subtitle={`${pending.length} open item${pending.length === 1 ? '' : 's'}`} />
          <div className="px-3 pb-3">
            {pending.length === 0 && <p className="px-2 pb-2 text-sm text-slate-500">Nothing pending for your role.</p>}
            {pending.map((i) => (
              <Link key={i.id} to={`${base}/${PENDING_TAB[i.kind]}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                <span className="size-2 shrink-0 rounded-full bg-brand" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{i.title}</p><p className="truncate text-xs text-slate-500">{i.detail}</p></div>
                {i.amount != null && <span className="num text-xs font-semibold">{rsCompact(i.amount)}</span>}
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Phase progress" />
          <div className="space-y-2.5 px-5 pb-5">
            {p.phases.map((ph) => (
              <div key={ph.id}>
                <div className="flex justify-between gap-2 text-xs"><span className={clsx('truncate', ph.progress === 100 ? 'text-slate-400' : 'text-slate-700')}>{ph.name}</span><span className="num font-semibold">{ph.progress}%</span></div>
                <Progress value={ph.progress} height={4} className="mt-1" color={ph.progress === 100 ? '#cbd5e1' : undefined} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Audit trail" subtitle="Every action, by every party" />
          <ol className="max-h-96 overflow-y-auto px-5 pb-4 scroll-thin">
            {p.activity.slice(0, 14).map((a) => (
              <li key={a.id} className="flex gap-3 pb-3.5">
                <Avatar name={a.actor} role={a.role} size={26} />
                <div className="text-[13px]">
                  <p className="text-slate-700"><span className="font-semibold text-slate-900">{a.actor}</span> {a.text}</p>
                  <p className="text-[11px] text-slate-400">{relative(a.date)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}

function Messages() {
  const p = useProject()
  const { role, update, personFor, toast } = useApp()
  const [text, setText] = useState('')
  const send = () => {
    if (!text.trim()) return
    const me = personFor(p)
    update(p.id, (x) => ({ ...x, messages: [...x.messages, { id: `${x.id}-M${Date.now()}`, author: me.name, role, date: TODAY_ISO, text: text.trim() }] }), { text: 'sent a message', kind: 'message' })
    setText('')
    toast({ title: 'Message sent', body: 'All three parties can see it.', tone: 'success' })
  }
  return (
    <Card>
      <CardHeader title="Project thread" subtitle="One conversation for client, architect and contractor. Nothing gets lost in WhatsApp." />
      <div className="space-y-4 px-5 pb-4">
        {p.messages.map((msg) => {
          const mine = msg.role === role
          return (
            <div key={msg.id} className={clsx('flex gap-3', mine && 'flex-row-reverse')}>
              <Avatar name={msg.author} role={msg.role} size={32} />
              <div className={clsx('max-w-[80%] rounded-2xl px-4 py-2.5', mine ? 'bg-accent text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm')}>
                <div className={clsx('mb-0.5 flex items-center gap-2 text-[11px]', mine ? 'text-white/80' : 'text-slate-500')}>
                  <span className="font-semibold">{msg.author}</span>{!mine && <RoleBadge role={msg.role} />}<span>{relative(msg.date)}</span>
                </div>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2 border-t border-slate-100 p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={`Message as ${personFor(p).name}…`} className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-accent" />
        <button onClick={send} className="grid size-10 place-items-center rounded-lg bg-accent text-white hover:bg-accent-strong cursor-pointer" aria-label="Send"><Send size={16} /></button>
      </div>
    </Card>
  )
}
