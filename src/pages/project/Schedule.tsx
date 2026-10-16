import clsx from 'clsx'
import { BadgeCheck, CloudRain } from 'lucide-react'
import { Button, Card, CardHeader, Badge } from '../../components/ui'
import { TODAY_ISO, date, daysBetween, rsCompact } from '../../lib/format'
import { useApp } from '../../store/store'
import { useProject } from './ProjectLayout'

/** Sri Lankan monsoons: south-west (May–Sep) and north-east (Dec–Feb). */
function monsoonBands(start: string, end: string) {
  const bands: { from: string; to: string; label: string }[] = []
  const y0 = new Date(start).getFullYear() - 1, y1 = new Date(end).getFullYear()
  for (let y = y0; y <= y1; y++) {
    bands.push({ from: `${y}-05-01`, to: `${y}-09-30`, label: 'SW monsoon' })
    bands.push({ from: `${y}-12-01`, to: `${y + 1}-02-28`, label: 'NE monsoon' })
  }
  return bands.filter((b) => b.to >= start && b.from <= end)
}

export default function Schedule() {
  const p = useProject()
  const { role, update, toast, personFor } = useApp()
  const total = daysBetween(p.start, p.end)
  const pos = (iso: string) => Math.max(0, Math.min(100, (daysBetween(p.start, iso) / total) * 100))
  const months: string[] = []
  const d = new Date(p.start); d.setDate(1)
  while (d <= new Date(p.end)) { months.push(d.toISOString().slice(0, 10)); d.setMonth(d.getMonth() + 1) }
  const today = pos(TODAY_ISO)
  const showToday = TODAY_ISO >= p.start && TODAY_ISO <= p.end
  const lookahead = p.phases.filter((ph) => ph.progress < 100 && daysBetween(TODAY_ISO, ph.start) <= 45)

  const certify = (id: string) => {
    const me = personFor(p)
    update(p.id, (x) => ({ ...x, phases: x.phases.map((ph) => (ph.id === id ? { ...ph, verifiedBy: me.name } : ph)) }), { text: `certified completion of ${p.phases.find((x) => x.id === id)?.name}`, kind: 'phase' })
    toast({ title: 'Phase certified', body: 'The client can now release the linked milestone payment.', tone: 'success' })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Master programme"
          subtitle={`${date(p.start)} → ${date(p.end)} · ${total} days`}
          action={<div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-accent" />Complete</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-accent/25" />Planned</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-sky-100" />Monsoon</span>
          </div>}
        />
        <div className="overflow-x-auto scroll-thin px-5 pb-5">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[240px_1fr] border-b border-slate-200 pb-2 text-[11px] font-semibold text-slate-500">
              <span>Phase</span>
              <div className="relative h-4">
                {months.map((mo) => <span key={mo} className="absolute -translate-x-1/2" style={{ left: `${pos(mo < p.start ? p.start : mo)}%` }}>{new Date(mo).toLocaleString('en', { month: 'short' })}{new Date(mo).getMonth() === 0 ? ` ’${String(new Date(mo).getFullYear()).slice(2)}` : ''}</span>)}
              </div>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 grid grid-cols-[240px_1fr]">
                <span />
                <div className="relative">
                  {monsoonBands(p.start, p.end).map((b) => (
                    <div key={b.from} className="absolute inset-y-0 bg-sky-50" style={{ left: `${pos(b.from)}%`, width: `${pos(b.to) - pos(b.from)}%` }}>
                      <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 text-[10px] font-medium text-sky-600/80"><CloudRain size={10} />{b.label}</span>
                    </div>
                  ))}
                  {months.map((mo) => <div key={mo} className="absolute inset-y-0 border-l border-slate-100" style={{ left: `${pos(mo)}%` }} />)}
                  {showToday && <div className="absolute inset-y-0 z-10 border-l-2 border-red-500" style={{ left: `${today}%` }}><span className="absolute -top-0.5 -translate-x-1/2 rounded bg-red-500 px-1 text-[9px] font-bold text-white">TODAY</span></div>}
                </div>
              </div>
              {p.phases.map((ph) => {
                const late = ph.progress < 100 && ph.end < TODAY_ISO
                return (
                  <div key={ph.id} className="relative grid grid-cols-[240px_1fr] items-center border-b border-slate-50 py-2.5">
                    <div className="pr-3">
                      <p className="truncate text-[13px] font-medium text-slate-800">{ph.name}</p>
                      <p className="text-[11px] text-slate-400">{date(ph.start, false)} – {date(ph.end, false)} · {rsCompact(ph.budget)}</p>
                    </div>
                    <div className="relative h-7">
                      <div className={clsx('absolute top-1 h-5 overflow-hidden rounded-md', late ? 'bg-red-100' : 'bg-accent/20')} style={{ left: `${pos(ph.start)}%`, width: `${Math.max(1, pos(ph.end) - pos(ph.start))}%` }}>
                        <div className={clsx('h-full', late ? 'bg-red-500' : 'bg-accent')} style={{ width: `${ph.progress}%` }} />
                        <span className={clsx('absolute inset-0 flex items-center px-2 text-[10px] font-bold', ph.progress > 45 ? 'text-white' : 'text-slate-700')}>{ph.progress}%</span>
                      </div>
                      {ph.verifiedBy && <BadgeCheck size={15} className="absolute top-1.5 text-emerald-600" style={{ left: `calc(${pos(ph.end)}% + 4px)` }} />}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="45-day look-ahead" subtitle="Work starting soon or in progress" />
          <div className="divide-y divide-slate-100">
            {lookahead.length === 0 && <p className="px-5 pb-5 text-sm text-slate-500">No phases in the look-ahead window.</p>}
            {lookahead.map((ph) => (
              <div key={ph.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{ph.name}</p><p className="text-xs text-slate-500">{ph.start > TODAY_ISO ? `Starts ${date(ph.start)}` : `Due ${date(ph.end)}`}</p></div>
                {ph.end < TODAY_ISO ? <Badge tone="red">Behind</Badge> : ph.progress > 0 ? <Badge tone="accent">In progress</Badge> : <Badge>Upcoming</Badge>}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Completion certificates" subtitle="The architect certifies each phase before its milestone payment is released" />
          <div className="divide-y divide-slate-100">
            {p.phases.filter((ph) => ph.progress === 100).map((ph) => (
              <div key={ph.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="truncate text-sm font-medium">{ph.name}</p>
                {ph.verifiedBy ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><BadgeCheck size={14} />{ph.verifiedBy}</span>
                  : role === 'architect' ? <Button size="sm" variant="primary" onClick={() => certify(ph.id)}>Certify</Button>
                  : <Badge tone="amber">Awaiting architect</Badge>}
              </div>
            ))}
            {p.phases.every((ph) => ph.progress < 100) && <p className="px-5 pb-5 text-sm text-slate-500">No phases completed yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
