import { ArrowRight, CheckCircle2, ClipboardCheck, FileStack, HardHat, Receipt, Wallet, FilePen, BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, useSector } from '../components/Layout'
import { Badge, Button, Card, Empty, RoleBadge } from '../components/ui'
import type { Role } from '../data/types'
import { TODAY_ISO, date, rsCompact } from '../lib/format'
import { PENDING_TAB, pendingItems, type PendingItem } from '../lib/metrics'
import { ROLE_META, useApp } from '../store/store'

const KIND_ICON: Record<PendingItem['kind'], typeof FileStack> = { change: FilePen, plan: FileStack, payment: Wallet, log: HardHat, ledger: Receipt, phase: BadgeCheck }
const KIND_LABEL: Record<PendingItem['kind'], string> = { change: 'Change order', plan: 'Drawing', payment: 'Payment', log: 'Site log', ledger: 'Ledger query', phase: 'Certificate' }

export default function Approvals() {
  const sector = useSector()
  const { projects, role, update, toast } = useApp()
  const list = projects.filter((p) => p.sector === sector)
  const mine = list.flatMap((p) => pendingItems(p, role).map((i) => ({ ...i, project: p })))
  const others = (['client', 'architect', 'contractor'] as Role[]).filter((r) => r !== role).map((r) => ({ role: r, count: list.reduce((s, p) => s + pendingItems(p, r).length, 0) }))
  const total = mine.reduce((s, i) => s + Math.max(0, i.amount ?? 0), 0)

  const quick = (i: (typeof mine)[number]) => {
    const p = i.project
    if (i.kind === 'change' && role === 'client') {
      update(p.id, (x) => ({ ...x, changes: x.changes.map((c) => (c.id === i.id ? { ...c, status: 'Approved', decidedOn: TODAY_ISO } : c)) }), { text: `approved ${i.title}`, kind: 'change' })
    } else if (i.kind === 'plan' && role === 'client') {
      update(p.id, (x) => ({ ...x, plans: x.plans.map((s) => (s.id === i.id ? { ...s, status: 'Approved' } : s)) }), { text: `approved ${i.title}`, kind: 'plan' })
    } else if (i.kind === 'log') {
      update(p.id, (x) => ({ ...x, logs: x.logs.map((l) => (l.id === i.id ? { ...l, acknowledgedBy: Array.from(new Set([...l.acknowledgedBy, role])) } : l)) }), { text: `verified the site log “${i.title}”`, kind: 'log' })
    } else if (i.kind === 'phase') {
      update(p.id, (x) => ({ ...x, phases: x.phases.map((ph) => (ph.id === i.id ? { ...ph, verifiedBy: x.architect.name } : ph)) }), { text: i.title.replace('Certify:', 'certified'), kind: 'phase' })
    } else if (i.kind === 'payment' && role === 'architect') {
      update(p.id, (x) => ({ ...x, milestones: x.milestones.map((m) => (m.id === i.id ? { ...m, certifiedBy: x.architect.name } : m)) }), { text: `certified ${i.title.replace('Certify invoice: ', '')}`, kind: 'payment' })
    } else return
    toast({ title: 'Done', body: i.title, tone: 'success' })
  }
  const canQuick = (i: PendingItem) => (role === 'client' && (i.kind === 'change' || i.kind === 'plan')) || (role === 'architect' && (i.kind === 'log' || i.kind === 'phase' || i.kind === 'payment'))

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Approvals" subtitle={<>Everything waiting on you as <RoleBadge role={role} /> across {list.length} {sector} projects.</>} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-slate-500">Waiting on you</p><p className="num mt-1 font-display text-3xl font-bold">{mine.length}</p>{total > 0 && <p className="mt-1 text-xs text-slate-500">{rsCompact(total)} in value</p>}</Card>
        {others.map((o) => (
          <Card key={o.role} className="p-4"><p className="text-xs text-slate-500">Waiting on the {ROLE_META[o.role].label.toLowerCase()}</p><p className="num mt-1 font-display text-3xl font-bold" style={{ color: ROLE_META[o.role].color }}>{o.count}</p></Card>
        ))}
      </div>

      {mine.length === 0 ? (
        <Card><Empty icon={<CheckCircle2 size={22} />} title="All caught up" body="Nothing is waiting on you. Switch perspective in the top bar to see what other parties need to do." /></Card>
      ) : (
        <div className="space-y-6">
          {list.filter((p) => mine.some((i) => i.project.id === p.id)).map((p) => (
            <Card key={p.id}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${p.cover[0]}, ${p.cover[1]})` }} />
                  <div><p className="font-semibold">{p.name}</p><p className="text-xs text-slate-500">{p.location}</p></div>
                </div>
                <Link to={`/${sector}/projects/${p.id}`} className="text-xs font-semibold text-accent hover:underline">Open project</Link>
              </div>
              <div className="divide-y divide-slate-50">
                {mine.filter((i) => i.project.id === p.id).map((i) => {
                  const I = KIND_ICON[i.kind]
                  return (
                    <div key={i.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><I size={16} /></span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2"><Badge>{KIND_LABEL[i.kind]}</Badge><span className="text-[11px] text-slate-400">{date(i.date)}</span></div>
                          <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{i.title}</p>
                          <p className="truncate text-xs text-slate-500">{i.detail}</p>
                        </div>
                      </div>
                      {i.amount != null && <span className="num text-sm font-bold sm:w-28 sm:text-right">{rsCompact(i.amount)}</span>}
                      <div className="flex gap-2">
                        {canQuick(i) && <Button size="sm" variant="success" onClick={() => quick(i)}><CheckCircle2 size={14} />{role === 'client' ? 'Approve' : i.kind === 'log' ? 'Verify' : 'Certify'}</Button>}
                        <Link to={`/${sector}/projects/${p.id}/${PENDING_TAB[i.kind]}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Review <ArrowRight size={13} /></Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="flex items-center gap-2 text-xs text-slate-400"><ClipboardCheck size={14} />Every decision is time-stamped and added to the project's audit trail, visible to all three parties.</p>
    </div>
  )
}
