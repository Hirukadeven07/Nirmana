import clsx from 'clsx'
import { BadgeCheck, Banknote, Clock, FileText, Lock, ShieldAlert } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from 'recharts'
import { Badge, Button, Card, CardHeader, Progress, Stat } from '../../components/ui'
import { ChartTooltip } from '../../components/visuals'
import type { Milestone } from '../../data/types'
import { axisRs, TODAY_ISO, date, pct, rs, rsCompact } from '../../lib/format'
import { projectMetrics } from '../../lib/metrics'
import { useApp } from '../../store/store'
import { useProject } from './ProjectLayout'

const STATUS: Record<Milestone['status'], { tone: 'green' | 'amber' | 'slate' | 'violet'; icon: typeof Banknote }> = {
  Paid: { tone: 'green', icon: BadgeCheck }, Invoiced: { tone: 'amber', icon: FileText }, Upcoming: { tone: 'slate', icon: Clock }, Retention: { tone: 'violet', icon: Lock },
}

export default function Payments() {
  const p = useProject()
  const m = projectMetrics(p)
  const { role, update, toast, personFor } = useApp()
  const total = p.milestones.reduce((s, x) => s + x.amount, 0)
  const retention = p.milestones.filter((x) => x.status === 'Retention').reduce((s, x) => s + x.amount, 0)
  const paidPct = (m.paid / total) * 100
  const overPaid = m.paid - m.earned
  const nextUpcoming = p.milestones.find((x) => x.status === 'Upcoming')

  const setMilestone = (id: string, patch: Partial<Milestone>, text: string) =>
    update(p.id, (x) => ({ ...x, milestones: x.milestones.map((ms) => (ms.id === id ? { ...ms, ...patch } : ms)) }), { text, kind: 'payment' })

  const release = (ms: Milestone) => {
    setMilestone(ms.id, { status: 'Paid', paidOn: TODAY_ISO }, `released payment: ${ms.name} (${rs(ms.amount)})`)
    toast({ title: 'Payment released', body: `${rs(ms.amount)} to ${p.contractor.org}.`, tone: 'success' })
  }
  const invoice = (ms: Milestone) => {
    setMilestone(ms.id, { status: 'Invoiced', certifiedBy: undefined }, `invoiced milestone: ${ms.name}`)
    toast({ title: 'Invoice submitted', body: 'The architect must certify the work before the client can pay.', tone: 'info' })
  }
  const certify = (ms: Milestone) => {
    setMilestone(ms.id, { certifiedBy: personFor(p).name }, `certified milestone: ${ms.name}`)
    toast({ title: 'Payment certificate issued', tone: 'success' })
  }

  const chart = [{ name: 'Status', Earned: m.earned, Paid: m.paid, 'Awaiting payment': m.invoiced }]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold">Milestone payments</h2>
        <p className="text-sm text-slate-500">Contractor invoices → architect certifies → client releases. {pct(retention / total * 100, 0)} retention is held until the 12-month defects liability period ends.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Paid to date" value={rsCompact(m.paid)} icon={<Banknote size={15} />} sub={`${pct(paidPct, 0)} of contract`} />
        <Stat label="Awaiting payment" value={rsCompact(m.invoiced)} icon={<FileText size={15} />} sub={`${p.milestones.filter((x) => x.status === 'Invoiced').length} invoice(s)`} />
        <Stat label="Value of work done" value={rsCompact(m.earned)} icon={<BadgeCheck size={15} />} sub={`${p.progress}% complete`} />
        <Stat label="Retention held" value={rsCompact(retention)} icon={<Lock size={15} />} sub="Released after DLP" />
      </div>

      <Card className={clsx('p-5', overPaid > m.earned * 0.03 ? 'border-red-200 bg-red-50/40' : 'border-emerald-200 bg-emerald-50/40')}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3 lg:w-2/5">
            <ShieldAlert size={20} className={overPaid > m.earned * 0.03 ? 'text-red-500' : 'text-emerald-600'} />
            <div>
              <p className="font-semibold text-slate-900">{overPaid > m.earned * 0.03 ? 'You have paid ahead of the work' : 'Payments are in line with the work done'}</p>
              <p className="mt-0.5 text-sm text-slate-600">You have paid <b>{pct(paidPct, 0)}</b> of the contract and <b>{p.progress}%</b> of the work is complete. {overPaid > 0 ? `${rsCompact(overPaid)} has been paid in advance of earned value.` : `${rsCompact(-overPaid)} of completed work is not yet paid for.`}</p>
            </div>
          </div>
          <div className="h-24 flex-1">
            <ResponsiveContainer>
              <BarChart data={chart} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={axisRs} tickLine={false} axisLine={false} domain={[0, total]} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip content={<ChartTooltip />} cursor={false} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Earned" fill="var(--accent)" barSize={12} radius={4} />
                <Bar dataKey="Paid" fill="#0f172a" barSize={12} radius={4} />
                <Bar dataKey="Awaiting payment" fill="#f59e0b" barSize={12} radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Payment schedule" subtitle={`${p.milestones.length} milestones · total ${rs(total)}`} />
        <div className="px-5 pb-5">
          <Progress value={paidPct} height={8} className="mb-5" />
          <ol className="relative space-y-3">
            {p.milestones.map((ms, i) => {
              const S = STATUS[ms.status]
              const isNext = ms.id === nextUpcoming?.id
              return (
                <li key={ms.id} className={clsx('flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center', ms.status === 'Invoiced' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200')}>
                  <div className="flex items-center gap-3 sm:w-[45%]">
                    <span className={clsx('grid size-9 shrink-0 place-items-center rounded-full', ms.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : ms.status === 'Invoiced' ? 'bg-amber-100 text-amber-700' : ms.status === 'Retention' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500')}><S.icon size={16} /></span>
                    <div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{i + 1}. {ms.name}</p><p className="text-xs text-slate-500">{ms.pct}% · due {date(ms.due)}</p></div>
                  </div>
                  <div className="num text-base font-bold sm:w-36">{rs(ms.amount)}</div>
                  <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
                    <Badge tone={S.tone}>{ms.status}</Badge>
                    {ms.status === 'Paid' && <span className="text-xs text-slate-500">Paid {date(ms.paidOn!)}</span>}
                    {ms.certifiedBy && ms.status !== 'Paid' && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><BadgeCheck size={13} />Certified by {ms.certifiedBy}</span>}
                    {ms.status === 'Invoiced' && !ms.certifiedBy && <span className="text-xs text-amber-700">Awaiting architect's certificate</span>}
                    {ms.status === 'Invoiced' && role === 'architect' && !ms.certifiedBy && <Button size="sm" variant="primary" onClick={() => certify(ms)}>Certify work</Button>}
                    {ms.status === 'Invoiced' && role === 'client' && <Button size="sm" variant="success" disabled={!ms.certifiedBy} onClick={() => release(ms)} title={!ms.certifiedBy ? 'Needs architect certificate' : undefined}>Release {rsCompact(ms.amount)}</Button>}
                    {isNext && role === 'contractor' && <Button size="sm" variant="primary" onClick={() => invoice(ms)}>Submit invoice</Button>}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </Card>
    </div>
  )
}
