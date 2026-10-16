import clsx from 'clsx'
import { CalendarClock, Check, FilePlus2, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, Field, Modal, RoleBadge, Stat, inputCls } from '../../components/ui'
import type { ChangeOrder } from '../../data/types'
import { TODAY_ISO, date, pct, rs, rsCompact } from '../../lib/format'
import { projectMetrics } from '../../lib/metrics'
import { useApp } from '../../store/store'
import { useProject } from './ProjectLayout'

const REASONS: ChangeOrder['reason'][] = ['Client request', 'Site condition', 'Design change', 'Regulatory', 'Value engineering']

export default function Changes() {
  const p = useProject()
  const m = projectMetrics(p)
  const { role, update, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(p.changes.find((c) => c.status === 'Pending client')?.id ?? p.changes[0]?.id ?? null)
  const co = p.changes.find((c) => c.id === selected)

  const decide = (c: ChangeOrder, status: 'Approved' | 'Rejected') => {
    update(p.id, (x) => ({ ...x, changes: x.changes.map((y) => (y.id === c.id ? { ...y, status, decidedOn: TODAY_ISO } : y)) }), { text: `${status === 'Approved' ? 'approved' : 'rejected'} ${c.code}: ${c.title}`, kind: 'change' })
    toast({ title: `${c.code} ${status.toLowerCase()}`, body: status === 'Approved' ? `Contract revised by ${rs(c.amount)}${c.days ? ` and ${c.days} days` : ''}.` : 'The requester has been notified.', tone: status === 'Approved' ? 'success' : 'warning' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Change orders</h2>
          <p className="text-sm text-slate-500">Nothing outside the contract is built or charged without the client's written approval.</p>
        </div>
        {role !== 'client' && <Button variant="primary" onClick={() => setOpen(true)}><FilePlus2 size={16} />Raise change order</Button>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Original contract" value={rsCompact(p.contractSum)} />
        <Stat label="Approved changes" value={rsCompact(m.approvedChanges)} sub={`${pct((m.approvedChanges / p.contractSum) * 100, 1, true)} of contract`} tone={m.approvedChanges > 0 ? 'down' : 'up'} />
        <Stat label="Pending your decision" value={rsCompact(m.pendingChanges)} sub={`${p.changes.filter((c) => c.status === 'Pending client').length} change orders`} />
        <Stat label="Revised contract" value={rsCompact(m.revised)} sub={`+${p.changes.filter((c) => c.status === 'Approved').reduce((s, c) => s + c.days, 0)} days approved`} />
      </div>

      {p.changes.length === 0 ? <Card><Empty icon={<FilePlus2 size={22} />} title="No change orders" body="The project is running exactly to the signed contract." /></Card> : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="h-fit divide-y divide-slate-100">
            {p.changes.map((c) => (
              <button key={c.id} onClick={() => setSelected(c.id)} className={clsx('flex w-full items-start gap-3 px-4 py-3.5 text-left cursor-pointer', c.id === selected ? 'bg-accent-soft/60' : 'hover:bg-slate-50')}>
                <span className={clsx('mt-1.5 size-2 shrink-0 rounded-full', c.status === 'Approved' ? 'bg-emerald-500' : c.status === 'Rejected' ? 'bg-red-500' : 'bg-amber-500')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{c.code} · {c.title}</p>
                  <p className="text-xs text-slate-500">{c.reason} · {date(c.date)}</p>
                </div>
                <div className="text-right">
                  <p className={clsx('num text-sm font-bold', c.amount < 0 ? 'text-emerald-600' : 'text-slate-900')}>{c.amount > 0 ? '+' : ''}{rsCompact(c.amount)}</p>
                  <Badge tone={c.status === 'Approved' ? 'green' : c.status === 'Rejected' ? 'red' : 'amber'} className="mt-1">{c.status}</Badge>
                </div>
              </button>
            ))}
          </Card>

          {co && (
            <Card className="h-fit p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-accent">{co.code} · {co.reason}</p>
                  <h3 className="mt-1 font-display text-xl font-bold">{co.title}</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Avatar name={co.raisedBy === 'architect' ? p.architect.name : p.contractor.name} role={co.raisedBy} size={20} />Raised by <RoleBadge role={co.raisedBy} /> on {date(co.date)}</div>
                </div>
                <Badge tone={co.status === 'Approved' ? 'green' : co.status === 'Rejected' ? 'red' : 'amber'} className="!text-xs">{co.status}{co.decidedOn ? ` · ${date(co.decidedOn)}` : ''}</Badge>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{co.description}</p>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="px-4 py-2 font-semibold">Item</th><th className="px-4 py-2 text-right font-semibold">Amount</th></tr></thead>
                  <tbody>
                    {co.lines.map((l, i) => <tr key={i} className="border-t border-slate-100"><td className="px-4 py-2 text-slate-700">{l.item}</td><td className="num px-4 py-2 text-right">{rs(l.amount)}</td></tr>)}
                    <tr className="border-t border-slate-200 bg-slate-50 font-bold"><td className="px-4 py-2.5">Total</td><td className="num px-4 py-2.5 text-right">{rs(co.amount)}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Contract impact</p><p className="num text-sm font-bold">{pct((co.amount / p.contractSum) * 100, 2, true)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Schedule impact</p><p className="num inline-flex items-center gap-1 text-sm font-bold"><CalendarClock size={13} />{co.days ? `+${co.days} days` : 'None'}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">New contract</p><p className="num text-sm font-bold">{rsCompact(m.revised + (co.status === 'Pending client' ? co.amount : 0))}</p></div>
              </div>

              {co.status === 'Pending client' && (role === 'client'
                ? <div className="mt-5 flex justify-end gap-2"><Button variant="danger" onClick={() => decide(co, 'Rejected')}><X size={15} />Reject</Button><Button variant="success" onClick={() => decide(co, 'Approved')}><Check size={15} />Approve {rsCompact(co.amount)}</Button></div>
                : <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Waiting for {p.client.name} to approve. Work on this item must not start before approval.</p>)}
            </Card>
          )}
        </div>
      )}

      <NewChangeModal open={open} onClose={() => setOpen(false)} onCreated={setSelected} />
    </div>
  )
}

function NewChangeModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const p = useProject()
  const { role, update, toast } = useApp()
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState<ChangeOrder['reason']>('Client request')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState(0)
  const [lines, setLines] = useState([{ item: '', amount: 0 }])
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)

  const submit = () => {
    const id = `${p.id}-CO${Date.now()}`
    const code = `CO-${String(p.changes.length + 1).padStart(3, '0')}`
    const co: ChangeOrder = { id, code, title, reason, description, raisedBy: role, date: TODAY_ISO, amount: total, days, status: 'Pending client', lines: lines.filter((l) => l.item) }
    update(p.id, (x) => ({ ...x, changes: [...x.changes, co] }), { text: `raised ${code}: ${title}`, kind: 'change' })
    toast({ title: `${code} submitted`, body: `${p.client.name} has been asked to approve ${rs(total)}.`, tone: 'success' })
    onCreated(id)
    onClose()
    setTitle(''); setDescription(''); setDays(0); setLines([{ item: '', amount: 0 }])
  }

  return (
    <Modal open={open} onClose={onClose} title="Raise a change order" subtitle="Itemise the cost so the client can see exactly what they are paying for." wide
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!title || total === 0} onClick={submit}>Submit for approval · {rs(total)}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Additional sump & pump for rainwater" autoFocus /></Field></div>
        <Field label="Reason"><select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value as ChangeOrder['reason'])}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Schedule impact (days)"><input type="number" min={0} className={inputCls} value={days} onChange={(e) => setDays(+e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Description & justification"><textarea className={clsx(inputCls, 'min-h-20')} value={description} onChange={(e) => setDescription(e.target.value)} /></Field></div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs font-semibold text-slate-600">Cost breakdown</p>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input className={inputCls} placeholder="Item description" value={l.item} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))} />
                <input type="number" className={clsx(inputCls, 'w-44 text-right num')} placeholder="Rs" value={l.amount || ''} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: +e.target.value } : x)))} />
                <button className="rounded-lg px-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 cursor-pointer" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label="Remove line"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setLines([...lines, { item: '', amount: 0 }])}><Plus size={14} />Add line</Button>
        </div>
      </div>
    </Modal>
  )
}
