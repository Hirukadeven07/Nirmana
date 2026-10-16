import clsx from 'clsx'
import { Camera, CheckCheck, CloudRain, CloudSun, HardHat, Package, Plus, Sun, Users } from 'lucide-react'
import { useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Avatar, Badge, Button, Card, CardHeader, Empty, Field, Modal, RoleBadge, Stat, inputCls } from '../../components/ui'
import { ChartTooltip, SitePhoto } from '../../components/visuals'
import { MATERIAL_BY_ID } from '../../data/materials'
import type { DailyLog, Phase, Role } from '../../data/types'
import { TODAY_ISO, date, daysBetween, num, rs } from '../../lib/format'
import { clamp } from '../../lib/random'
import { useApp, usePrices } from '../../store/store'
import { useProject } from './ProjectLayout'

const WEATHER_ICON = { Sunny: Sun, Cloudy: CloudSun, 'Light rain': CloudRain, 'Heavy rain': CloudRain }

/** Redistributes overall progress across phases in programme order. */
export function refillPhases(phases: Phase[], progress: number): Phase[] {
  let remaining = progress
  return phases.map((ph) => {
    const done = clamp(remaining / ph.weight, 0, 1)
    remaining -= ph.weight
    return { ...ph, progress: Math.max(ph.progress, Math.round(done * 100)) }
  })
}

export default function Progress() {
  const p = useProject()
  const { role, update, toast } = useApp()
  const { localPrice } = usePrices()
  const [open, setOpen] = useState(false)
  const recent = p.logs.filter((l) => daysBetween(l.date, TODAY_ISO) <= 30)
  const rainDays = recent.filter((l) => l.weather.includes('rain')).length
  const avgCrew = recent.length ? Math.round(recent.reduce((s, l) => s + l.workers, 0) / recent.length) : 0
  const trend = [...p.logs].reverse().map((l) => ({ date: l.date, Progress: l.progressAfter, Crew: l.workers }))

  const acknowledge = (log: DailyLog) => {
    update(p.id, (x) => ({ ...x, logs: x.logs.map((l) => (l.id === log.id ? { ...l, acknowledgedBy: Array.from(new Set([...l.acknowledgedBy, role])) } : l)) }), { text: `${role === 'architect' ? 'verified' : 'acknowledged'} the site log “${log.title}”`, kind: 'log' })
    toast({ title: role === 'architect' ? 'Log verified' : 'Log acknowledged', tone: 'success' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Site progress</h2>
          <p className="text-sm text-slate-500">Daily logs from {p.contractor.org}, verified by the architect.</p>
        </div>
        {role === 'contractor'
          ? <Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} />Post daily log</Button>
          : <span className="text-xs text-slate-500">Switch to <RoleBadge role="contractor" /> to post a log</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Logs (30 days)" value={recent.length} icon={<HardHat size={15} />} sub={`${p.logs.length} total`} />
        <Stat label="Average crew" value={avgCrew} icon={<Users size={15} />} sub="Workers per day on site" />
        <Stat label="Rain-affected days" value={rainDays} icon={<CloudRain size={15} />} sub="Last 30 days" tone={rainDays > 3 ? 'down' : 'neutral'} />
        <Stat label="Awaiting verification" value={p.logs.filter((l) => !l.acknowledgedBy.includes('architect')).length} icon={<CheckCheck size={15} />} sub="By the architect" />
      </div>

      {trend.length > 1 && (
        <Card>
          <CardHeader title="Progress trend" subtitle="Reported % complete after each log" />
          <div className="h-48 px-2 pb-3">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ left: 0, right: 16, top: 4 }}>
                <XAxis dataKey="date" tickFormatter={(d) => date(d, false)} tickLine={false} axisLine={false} />
                <YAxis yAxisId="a" domain={['dataMin - 2', 'dataMax + 1']} tickFormatter={(v) => `${Math.round(v)}%`} tickLine={false} axisLine={false} width={44} />
                <YAxis yAxisId="b" orientation="right" hide />
                <Tooltip content={<ChartTooltip fmt={(v) => num(v, 1)} labelFmt={date} />} />
                <Line yAxisId="a" dataKey="Progress" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line yAxisId="b" dataKey="Crew" stroke="#cbd5e1" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {p.logs.length === 0 && <Card><Empty icon={<HardHat size={22} />} title="No site logs yet" body="Construction hasn't started. Logs will appear here once the contractor mobilises." /></Card>}

      <div className="space-y-4">
        {p.logs.map((log) => {
          const W = WEATHER_ICON[log.weather]
          const phase = p.phases.find((ph) => ph.id === log.phaseId)
          const canAck = (role === 'client' || role === 'architect') && !log.acknowledgedBy.includes(role)
          return (
            <Card key={log.id} className="p-5">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="w-full shrink-0 md:w-24">
                  <p className="num text-2xl font-bold leading-none">{new Date(log.date).getDate()}</p>
                  <p className="text-xs font-semibold uppercase text-slate-500">{new Date(log.date).toLocaleString('en', { month: 'short', year: 'numeric' })}</p>
                  <div className={clsx('mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', log.weather === 'Heavy rain' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600')}><W size={12} />{log.weather}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{log.title}</h3>
                    {phase && <Badge tone="accent">{phase.name}</Badge>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><Avatar name={log.author} role={log.role} size={20} />{log.author} · <Users size={12} />{log.workers} workers · Progress {log.progressAfter}%</div>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{log.notes}</p>
                  <div className="mt-3 flex gap-2 overflow-x-auto scroll-thin">
                    {log.photos.map((ph, i) => (
                      <figure key={i} className="w-40 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                        <SitePhoto photo={ph} className="h-24 w-full" />
                        <figcaption className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500"><Camera size={10} />{ph.caption}</figcaption>
                      </figure>
                    ))}
                  </div>
                  {log.materials.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {log.materials.map((mu) => {
                        const m = MATERIAL_BY_ID[mu.materialId]!
                        return <span key={mu.materialId} className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900"><Package size={12} />{num(mu.qty)} {m.unit} {m.name} · <b className="num">{rs(mu.qty * localPrice(mu.materialId))}</b> at today's price</span>
                      })}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-row items-start gap-2 md:w-44 md:flex-col md:items-end">
                  {(['client', 'architect'] as Role[]).map((r) => (
                    <span key={r} className={clsx('inline-flex items-center gap-1 text-[11px] font-medium', log.acknowledgedBy.includes(r) ? 'text-emerald-700' : 'text-slate-400')}>
                      <CheckCheck size={13} />{r === 'architect' ? 'Architect verified' : 'Client seen'}
                    </span>
                  ))}
                  {canAck && <Button size="sm" variant="primary" onClick={() => acknowledge(log)}>{role === 'architect' ? 'Verify log' : 'Acknowledge'}</Button>}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <NewLogModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

function NewLogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = useProject()
  const { update, toast, personFor } = useApp()
  const { localPrice } = usePrices()
  const active = p.phases.find((ph) => ph.progress > 0 && ph.progress < 100) ?? p.phases[0]!
  const [form, setForm] = useState({ title: '', notes: '', phaseId: active.id, weather: 'Sunny' as DailyLog['weather'], workers: 14, progress: p.progress + 1, materialId: p.sector === 'residential' ? 'cement-opc' : 'rmc-g25', qty: 40, kind: 'slab' as DailyLog['photos'][number]['kind'] })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.title.trim()) return
    const me = personFor(p, 'contractor')
    const log: DailyLog = {
      id: `${p.id}-D${Date.now()}`, date: TODAY_ISO, author: me.name, role: 'contractor', weather: form.weather, workers: form.workers,
      title: form.title.trim(), notes: form.notes.trim() || 'No additional notes.', phaseId: form.phaseId, progressAfter: form.progress,
      photos: [{ caption: 'Site photo', hue: 200, kind: form.kind }, { caption: 'Detail', hue: 30, kind: form.kind }],
      materials: form.qty > 0 ? [{ materialId: form.materialId, qty: form.qty }] : [], acknowledgedBy: [],
    }
    update(p.id, (x) => ({
      ...x,
      logs: [log, ...x.logs],
      progress: Math.max(x.progress, Math.round(form.progress)),
      phases: refillPhases(x.phases, Math.max(x.progress, form.progress)),
      boq: x.boq.map((b) => (b.materialId === form.materialId ? { ...b, used: Math.round((b.used + form.qty) * 10) / 10 } : b)),
    }), { text: `posted a daily log: “${log.title}”`, kind: 'log' })
    toast({ title: 'Daily log published', body: 'The client and architect have been notified.', tone: 'success' })
    onClose()
  }

  const materialOptions = p.boq.map((b) => MATERIAL_BY_ID[b.materialId]!)
  const unit = MATERIAL_BY_ID[form.materialId]?.unit

  return (
    <Modal open={open} onClose={onClose} title="Post daily log" subtitle={`${date(TODAY_ISO)} · ${p.name}`} wide
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!form.title.trim()}>Publish log</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="What happened today?"><input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Upper-floor beam reinforcement fixed" autoFocus /></Field></div>
        <div className="sm:col-span-2"><Field label="Notes"><textarea className={clsx(inputCls, 'min-h-24')} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Work done, inspections, issues, deliveries…" /></Field></div>
        <Field label="Phase"><select className={inputCls} value={form.phaseId} onChange={(e) => set('phaseId', e.target.value)}>{p.phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}</select></Field>
        <Field label="Weather"><select className={inputCls} value={form.weather} onChange={(e) => set('weather', e.target.value as DailyLog['weather'])}>{['Sunny', 'Cloudy', 'Light rain', 'Heavy rain'].map((w) => <option key={w}>{w}</option>)}</select></Field>
        <Field label="Workers on site"><input type="number" min={0} className={inputCls} value={form.workers} onChange={(e) => set('workers', +e.target.value)} /></Field>
        <Field label="Overall progress after today (%)" hint={`Currently ${p.progress}%`}><input type="number" min={p.progress} max={100} step={0.5} className={inputCls} value={form.progress} onChange={(e) => set('progress', clamp(+e.target.value, 0, 100))} /></Field>
        <Field label="Material used"><select className={inputCls} value={form.materialId} onChange={(e) => set('materialId', e.target.value)}>{materialOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label={`Quantity (${unit})`} hint={`≈ ${rs(form.qty * localPrice(form.materialId))} at today's price`}><input type="number" min={0} className={inputCls} value={form.qty} onChange={(e) => set('qty', +e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <Field label="Photos">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(['site', 'rebar', 'slab', 'wall', 'roof', 'finish'] as const).map((k) => (
                <button key={k} type="button" onClick={() => set('kind', k)} className={clsx('overflow-hidden rounded-lg border-2 cursor-pointer', form.kind === k ? 'border-accent' : 'border-transparent')}>
                  <SitePhoto photo={{ caption: k, hue: 200, kind: k }} className="h-14 w-full" />
                  <span className="block py-0.5 text-[10px] capitalize text-slate-500">{k}</span>
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  )
}
