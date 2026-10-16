import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Download, FileCheck2, FileX2, HelpCircle, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, CardHeader, Field, Modal, Stat, inputCls } from '../../components/ui'
import { ChartTooltip } from '../../components/visuals'
import { MATERIAL_BY_ID, districtFactor, marketPriceAt } from '../../data/materials'
import type { LedgerEntry } from '../../data/types'
import { axisRs, TODAY_ISO, date, monthLabel, num, rs, rsCompact } from '../../lib/format'
import { RATE_TOLERANCE, rateVariance } from '../../lib/metrics'
import { useApp, usePrices } from '../../store/store'
import { useProject } from './ProjectLayout'

type Filter = 'all' | 'flagged' | 'queried' | 'pending'

export default function Ledger() {
  const p = useProject()
  const { role, update, toast } = useApp()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [category, setCategory] = useState('All')
  const [queryFor, setQueryFor] = useState<LedgerEntry | null>(null)
  const [respondTo, setRespondTo] = useState<LedgerEntry | null>(null)
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState('')

  const rows = useMemo(() => p.ledger.map((e) => ({ e, v: rateVariance(e, p.district) })), [p.ledger, p.district])
  const flagged = rows.filter((r) => (r.v ?? 0) > RATE_TOLERANCE)
  const excess = flagged.reduce((s, r) => s + r.e.amount - r.e.amount / (1 + r.v!), 0)
  const total = p.ledger.reduce((s, e) => s + e.amount, 0)
  const categories = ['All', ...Array.from(new Set(p.ledger.map((e) => e.category)))]

  const shown = rows.filter(({ e, v }) =>
    (category === 'All' || e.category === category) &&
    (!q || `${e.description} ${e.vendor}`.toLowerCase().includes(q.toLowerCase())) &&
    (filter === 'all' || (filter === 'flagged' && (v ?? 0) > RATE_TOLERANCE) || (filter === 'queried' && e.status === 'Queried') || (filter === 'pending' && e.status === 'Pending review')))

  const monthly = useMemo(() => {
    const map = new Map<string, number>()
    p.ledger.forEach((e) => map.set(e.date.slice(0, 7), (map.get(e.date.slice(0, 7)) ?? 0) + e.amount))
    return Array.from(map, ([m, v]) => ({ month: `${m}-01`, Spend: v })).sort((a, b) => a.month.localeCompare(b.month))
  }, [p.ledger])

  const setEntry = (id: string, patch: Partial<LedgerEntry>, text: string) =>
    update(p.id, (x) => ({ ...x, ledger: x.ledger.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), { text, kind: 'ledger' })

  const exportCsv = () => {
    const head = 'Date,Category,Description,Vendor,Qty,Unit,Rate,Market rate,Variance %,Amount,Receipt,Status'
    const lines = p.ledger.map((e) => {
      const v = rateVariance(e, p.district)
      const market = e.materialId ? Math.round(marketPriceAt(e.materialId, e.date) * districtFactor(p.district)) : ''
      return [e.date, e.category, `"${e.description}"`, `"${e.vendor}"`, e.qty ?? '', e.unit ?? '', e.rate ?? '', market, v != null ? (v * 100).toFixed(1) : '', e.amount, e.receipt ? 'Yes' : 'No', e.status].join(',')
    })
    const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${p.id}-ledger.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Open-book cost ledger</h2>
          <p className="text-sm text-slate-500">Every purchase with its receipt, compared with the {p.district} market rate for the same month.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCsv}><Download size={15} />Export CSV</Button>
          {role === 'contractor' && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} />Record expense</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total recorded" value={rsCompact(total)} sub={`${p.ledger.length} entries`} />
        <Stat label="Above market (>5%)" value={flagged.length} sub={flagged.length ? `≈ ${rsCompact(excess)} above market` : 'All rates within tolerance'} tone={flagged.length ? 'down' : 'up'} icon={<AlertTriangle size={15} />} />
        <Stat label="Receipts attached" value={`${Math.round((p.ledger.filter((e) => e.receipt).length / Math.max(1, p.ledger.length)) * 100)}%`} icon={<FileCheck2 size={15} />} sub={`${p.ledger.filter((e) => !e.receipt).length} missing`} />
        <Stat label="Open queries" value={p.ledger.filter((e) => e.status === 'Queried').length} icon={<HelpCircle size={15} />} sub={`${p.ledger.filter((e) => e.status === 'Pending review').length} pending review`} />
      </div>

      <Card>
        <CardHeader title="Monthly spend" />
        <div className="h-44 px-2 pb-3">
          <ResponsiveContainer>
            <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={axisRs} tickLine={false} axisLine={false} width={56} />
              <Tooltip content={<ChartTooltip labelFmt={monthLabel} />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="Spend" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {([['all', 'All'], ['flagged', `Above market (${flagged.length})`], ['queried', 'Queried'], ['pending', 'Pending review']] as [Filter, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} className={clsx('rounded-full px-3 py-1 text-xs font-semibold cursor-pointer', filter === id ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">{categories.map((c) => <option key={c}>{c}</option>)}</select>
            <label className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-48 rounded-lg border border-slate-200 pl-8 pr-2 text-sm outline-none focus:border-accent" /></label>
          </div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="bg-slate-50/60 text-left text-xs text-slate-500">
                <th className="px-5 py-2.5 font-semibold">Date</th><th className="min-w-[260px] px-3 font-semibold">Description</th><th className="px-3 text-right font-semibold">Qty × rate</th>
                <th className="px-3 text-right font-semibold">Market rate</th><th className="px-3 font-semibold">Rate check</th><th className="px-3 text-right font-semibold">Amount</th>
                <th className="px-3 text-center font-semibold">Receipt</th><th className="px-3 font-semibold">Status</th><th className="min-w-[120px] px-5" />
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 120).map(({ e, v }) => {
                const market = e.materialId ? marketPriceAt(e.materialId, e.date) * districtFactor(p.district) : null
                const over = (v ?? 0) > RATE_TOLERANCE
                return (
                  <tr key={e.id} className={clsx('border-t border-slate-50 align-top', over && 'bg-red-50/30')}>
                    <td className="num whitespace-nowrap px-5 py-3 text-xs text-slate-500">{date(e.date)}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-800">{e.description}</p>
                      <p className="text-xs text-slate-500">{e.vendor} · {e.category}</p>
                      {e.query && <p className={clsx('mt-1.5 rounded-md px-2 py-1 text-xs', e.status === 'Queried' ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600')}>💬 {e.query}</p>}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-3 text-right text-xs">{e.qty != null ? <>{num(e.qty, e.qty < 100 ? 1 : 0)} {e.unit}<br /><span className="text-slate-500">@ {rs(e.rate!)}</span></> : <span className="text-slate-300">—</span>}</td>
                    <td className="num whitespace-nowrap px-3 py-3 text-right text-xs text-slate-500">{market ? rs(market) : '—'}</td>
                    <td className="px-3 py-3">{v == null ? <span className="text-xs text-slate-300">n/a</span> : over ? <Badge tone="red"><AlertTriangle size={11} />+{(v * 100).toFixed(1)}%</Badge> : <Badge tone="green"><CheckCircle2 size={11} />{v >= 0 ? '+' : ''}{(v * 100).toFixed(1)}%</Badge>}</td>
                    <td className="num whitespace-nowrap px-3 py-3 text-right font-semibold">{rs(e.amount)}</td>
                    <td className="px-3 py-3 text-center">{e.receipt ? <FileCheck2 size={16} className="inline text-emerald-600" /> : <FileX2 size={16} className="inline text-red-400" />}</td>
                    <td className="px-3 py-3"><Badge tone={e.status === 'Verified' ? 'green' : e.status === 'Queried' ? 'amber' : 'blue'}>{e.status}</Badge></td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      {role === 'client' && e.status !== 'Queried' && <button onClick={() => { setQueryFor(e); setNote(over ? 'This rate is above the market average. Please share the supplier quotation.' : '') }} className="text-xs font-semibold text-accent hover:underline cursor-pointer">Query</button>}
                      {role === 'client' && e.status === 'Pending review' && <button onClick={() => setEntry(e.id, { status: 'Verified' }, `verified ledger entry: ${e.description}`)} className="ml-3 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">Verify</button>}
                      {role === 'contractor' && e.status === 'Queried' && <button onClick={() => { setRespondTo(e); setNote('') }} className="text-xs font-semibold text-accent hover:underline cursor-pointer">Respond</button>}
                      {role === 'architect' && e.status === 'Pending review' && <button onClick={() => setEntry(e.id, { status: 'Verified' }, `verified ledger entry: ${e.description}`)} className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">Verify</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No entries match.</p>}
        </div>
      </Card>

      <Modal open={!!queryFor} onClose={() => setQueryFor(null)} title="Query this entry" subtitle={queryFor?.description}
        footer={<><Button onClick={() => setQueryFor(null)}>Cancel</Button><Button variant="primary" disabled={!note.trim()} onClick={() => { setEntry(queryFor!.id, { status: 'Queried', query: note.trim() }, `queried a ledger entry: ${queryFor!.description}`); toast({ title: 'Query sent to contractor', tone: 'info' }); setQueryFor(null) }}>Send query</Button></>}>
        <Field label="Your question"><textarea className={clsx(inputCls, 'min-h-24')} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></Field>
      </Modal>

      <Modal open={!!respondTo} onClose={() => setRespondTo(null)} title="Respond to client query" subtitle={respondTo?.query}
        footer={<><Button onClick={() => setRespondTo(null)}>Cancel</Button><Button variant="primary" disabled={!note.trim()} onClick={() => { setEntry(respondTo!.id, { status: 'Pending review', query: `Contractor: ${note.trim()}`, receipt: true }, `responded to a ledger query: ${respondTo!.description}`); toast({ title: 'Response sent', body: 'The entry is back with the client for review.', tone: 'success' }); setRespondTo(null) }}>Send response & attach quote</Button></>}>
        <Field label="Explanation" hint="The supplier quotation is attached as evidence."><textarea className={clsx(inputCls, 'min-h-24')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Only GSMB-licensed supplier available during the monsoon ban on river mining; quotation attached." autoFocus /></Field>
      </Modal>

      <AddExpense open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function AddExpense({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = useProject()
  const { update, toast } = useApp()
  const { priceOf } = usePrices()
  const [materialId, setMaterialId] = useState(p.boq[0]?.materialId ?? 'cement-opc')
  const [qty, setQty] = useState(100)
  const [rate, setRate] = useState<number | ''>('')
  const [vendor, setVendor] = useState('')
  const [receipt, setReceipt] = useState(true)
  const m = MATERIAL_BY_ID[materialId]!
  const market = priceOf(materialId) * districtFactor(p.district)
  const r = rate === '' ? Math.round(market) : rate
  const variance = r / market - 1

  const submit = () => {
    const e: LedgerEntry = { id: `${p.id}-L${Date.now()}`, date: TODAY_ISO, category: m.category, description: `${m.name} — delivery`, vendor: vendor || 'Supplier', materialId, qty, unit: m.unit, rate: r, amount: Math.round(qty * r), postedBy: 'contractor', receipt, status: 'Pending review' }
    update(p.id, (x) => ({ ...x, ledger: [e, ...x.ledger], boq: x.boq.map((b) => (b.materialId === materialId ? { ...b, delivered: Math.round((b.delivered + qty) * 10) / 10 } : b)) }), { text: `recorded an expense: ${e.description} (${rs(e.amount)})`, kind: 'ledger' })
    toast({ title: 'Expense recorded', body: variance > RATE_TOLERANCE ? 'Flagged as above market. The client will see the comparison.' : 'Within market tolerance.', tone: variance > RATE_TOLERANCE ? 'warning' : 'success' })
    onClose(); setRate(''); setVendor('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Record a material purchase" subtitle="The rate is checked against today's market price before it reaches the client."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Record {rs(qty * r)}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Material"><select className={inputCls} value={materialId} onChange={(e) => { setMaterialId(e.target.value); setRate('') }}>{p.boq.map((b) => <option key={b.materialId} value={b.materialId}>{MATERIAL_BY_ID[b.materialId]!.name}</option>)}</select></Field></div>
        <Field label={`Quantity (${m.unit})`}><input type="number" className={inputCls} value={qty} onChange={(e) => setQty(+e.target.value)} /></Field>
        <Field label="Invoiced rate (Rs)" hint={`Market today: ${rs(market)} (${p.district})`}><input type="number" className={inputCls} value={rate} placeholder={String(Math.round(market))} onChange={(e) => setRate(e.target.value === '' ? '' : +e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Vendor"><input className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Sapumal Hardware, Kaduwela" /></Field></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} className="size-4 accent-[var(--accent)]" />Receipt / delivery note attached</label>
        <div className={clsx('sm:col-span-2 rounded-xl p-3 text-sm', variance > RATE_TOLERANCE ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800')}>
          {variance > RATE_TOLERANCE ? <AlertTriangle size={15} className="mr-1.5 inline" /> : <CheckCircle2 size={15} className="mr-1.5 inline" />}
          Rate check: <b>{variance >= 0 ? '+' : ''}{(variance * 100).toFixed(1)}%</b> vs {p.district} market ({rs(market)}/{m.unit}).{variance > RATE_TOLERANCE && ' This entry will be flagged to the client.'}
        </div>
      </div>
    </Modal>
  )
}
