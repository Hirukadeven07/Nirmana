import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight, Bell, BellRing, Pause, Play, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, useSector } from '../components/Layout'
import { Badge, Button, Card, CardHeader, Delta, Tabs, inputCls } from '../components/ui'
import { ChartTooltip, Sparkline } from '../components/visuals'
import { estimate } from '../data/estimator'
import { CATEGORIES, DISTRICTS, districtFactor, HISTORY_MONTHS, MATERIALS, MATERIAL_BY_ID, costIndexHistory, priceHistory, type Material } from '../data/materials'
import { monthLabel, num, rs } from '../lib/format'
import { useApp, usePrices } from '../store/store'

const COMPARE_COLORS = ['#0d9488', '#3b5bdb', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
type Range = 6 | 12 | 24

export default function Market() {
  const sector = useSector()
  const { prices, localPrice, district, lastTick, paused, setPaused } = usePrices()
  const { toast } = useApp()
  const [cat, setCat] = useState<string>('All')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string>('cement-opc')
  const [compare, setCompare] = useState<string[]>(['cement-opc', 'steel-t12', 'sand-river', 'brick-clay'])
  const [alerts, setAlerts] = useState<Record<string, { target: number; dir: 'above' | 'below' }>>({})
  const fired = useRef(new Set<string>())

  useEffect(() => {
    for (const [id, a] of Object.entries(alerts)) {
      const price = localPrice(id)
      const hit = a.dir === 'above' ? price >= a.target : price <= a.target
      if (hit && !fired.current.has(id)) {
        fired.current.add(id)
        toast({ title: `Price alert: ${MATERIAL_BY_ID[id]!.name}`, body: `Now ${rs(price)} (${a.dir} ${rs(a.target)})`, tone: 'warning' })
      }
    }
  }, [lastTick, alerts, localPrice, toast])

  const list = MATERIALS.filter((m) => (cat === 'All' || m.category === cat) && (!q || `${m.name} ${m.brands.join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  const index = costIndexHistory()
  const ncci = HISTORY_MONTHS.map((m, i) => ({ month: m, NCCI: index[i] }))

  const compareData = HISTORY_MONTHS.map((month, i) => {
    const row: Record<string, number | string> = { month }
    compare.forEach((id) => { const h = priceHistory(MATERIAL_BY_ID[id]!); row[id] = +((h[i]! / h[0]!) * 100).toFixed(1) })
    return row
  })

  // Typical-home cost curve: the same building priced at each month's market rates.
  const homeCurve = useMemo(() => HISTORY_MONTHS.map((month, i) => {
    const e = estimate({ typeId: sector === 'residential' ? 'house' : 'office', area: sector === 'residential' ? 2000 : 40000, floors: sector === 'residential' ? 2 : 10, grade: 'standard', districtFactor: 1, includeVat: false, contingencyPct: 5 }, (id) => priceHistory(MATERIAL_BY_ID[id]!)[i]!)
    return { month, 'Rs / sq ft': Math.round(e.perSqft) }
  }), [sector])
  const homeChange = homeCurve[23]!['Rs / sq ft'] / homeCurve[11]!['Rs / sq ft'] - 1

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={<span className="inline-flex items-center gap-3">Market prices <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><span className={clsx('size-2 rounded-full bg-emerald-500', !paused && 'live-dot')} />{paused ? 'PAUSED' : 'LIVE'}</span></span>}
        subtitle={`Construction material prices in ${district}, updated as quotes come in. Last tick ${new Date(lastTick).toLocaleTimeString()}.`}
        actions={<Button onClick={() => setPaused(!paused)}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? 'Resume feed' : 'Pause feed'}</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Nirmana Construction Cost Index (NCCI)" subtitle="Weighted basket of 14 materials and labour rates for a typical building · Nov 2024 = 100" />
          <div className="flex flex-wrap gap-6 px-5">
            <div><p className="text-xs text-slate-500">Current</p><p className="num font-display text-3xl font-bold">{index[23]!.toFixed(1)}</p></div>
            <div><p className="text-xs text-slate-500">1 month</p><Delta value={index[23]! / index[22]! - 1} invert className="!text-base" /></div>
            <div><p className="text-xs text-slate-500">12 months</p><Delta value={index[23]! / index[11]! - 1} invert className="!text-base" /></div>
            <div><p className="text-xs text-slate-500">24 months</p><Delta value={index[23]! / index[0]! - 1} invert className="!text-base" /></div>
          </div>
          <div className="h-56 px-2 pb-3">
            <ResponsiveContainer>
              <AreaChart data={ncci} margin={{ left: 0, right: 16, top: 10 }}>
                <defs><linearGradient id="m-ncci" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="1" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis domain={['dataMin - 3', 'dataMax + 3']} tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<ChartTooltip fmt={(v) => v.toFixed(1)} labelFmt={monthLabel} />} />
                <ReferenceLine x="2026-03-01" stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Cement price hike', fontSize: 10, fill: '#64748b', position: 'insideTopLeft' }} />
                <Area dataKey="NCCI" stroke="#f59e0b" strokeWidth={2.5} fill="url(#m-ncci)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title={sector === 'residential' ? 'Cost curve: typical 2,000 sq ft house' : 'Cost curve: 40,000 sq ft office'} subtitle="The same standard-grade building priced at each month's rates" />
          <div className="px-5"><span className="num font-display text-3xl font-bold">{rs(homeCurve[23]!['Rs / sq ft'])}</span><span className="ml-1 text-sm text-slate-500">/ sq ft</span><p className="mt-0.5 text-xs text-slate-500"><Delta value={homeChange} invert /> in 12 months</p></div>
          <div className="h-52 px-2 pb-3">
            <ResponsiveContainer>
              <LineChart data={homeCurve} margin={{ left: 0, right: 12, top: 10 }}>
                <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis domain={['dataMin - 300', 'dataMax + 300']} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<ChartTooltip fmt={(v) => rs(v)} labelFmt={monthLabel} />} />
                <Line dataKey="Rs / sq ft" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {['All', ...CATEGORIES].map((c) => <button key={c} onClick={() => setCat(c)} className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer', cat === c ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{c}</button>)}
            </div>
            <label className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search material or brand" className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-2 text-sm outline-none focus:border-accent sm:w-56" /></label>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="bg-slate-50/60 text-left text-xs text-slate-500"><th className="px-4 py-2.5 font-semibold">Material</th><th className="px-3 text-right font-semibold">Live price</th><th className="px-3 text-right font-semibold">Today</th><th className="px-3 text-right font-semibold">1 mo</th><th className="px-3 text-right font-semibold">12 mo</th><th className="px-3 font-semibold">Trend</th><th className="px-3 text-center font-semibold">Compare</th></tr></thead>
              <tbody>
                {list.map((m) => {
                  const p = prices[m.id]!
                  const h = priceHistory(m)
                  const live = localPrice(m.id)
                  const day = p.price / p.open - 1
                  return (
                    <tr key={m.id} onClick={() => setSelected(m.id)} className={clsx('cursor-pointer border-t border-slate-50', selected === m.id ? 'bg-accent-soft/60' : 'hover:bg-slate-50')}>
                      <td className="px-4 py-2.5"><p className="font-medium text-slate-800">{m.name}</p><p className="text-[11px] text-slate-400">{m.category} · per {m.unit}{m.brands.length ? ` · ${m.brands.slice(0, 2).join(', ')}` : ''}</p></td>
                      <td className="px-3 text-right"><span key={p.at} className={clsx('num rounded px-1 font-bold', p.at && (p.dir > 0 ? 'flash-up' : 'flash-down'))}>{num(live, live < 100 ? 2 : 0)}</span></td>
                      <td className="px-3 text-right"><span className={clsx('num inline-flex items-center text-xs font-semibold', day > 0.00005 ? 'text-red-600' : day < -0.00005 ? 'text-emerald-600' : 'text-slate-400')}>{day > 0.00005 ? <ArrowUpRight size={12} /> : day < -0.00005 ? <ArrowDownRight size={12} /> : null}{(Math.abs(day) * 100).toFixed(2)}%</span></td>
                      <td className="px-3 text-right"><Delta value={h[23]! / h[22]! - 1} invert /></td>
                      <td className="px-3 text-right"><Delta value={h[23]! / h[11]! - 1} invert /></td>
                      <td className="px-3"><Sparkline data={[...h.slice(-12), p.price]} width={80} height={24} /></td>
                      <td className="px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="size-4 cursor-pointer accent-[var(--accent)]" checked={compare.includes(m.id)} disabled={!compare.includes(m.id) && compare.length >= 6} onChange={(e) => setCompare(e.target.checked ? [...compare, m.id] : compare.filter((x) => x !== m.id))} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">Indicative prices for demonstration. Cement reflects the March 2026 increase of about Rs 150–175 per bag. In production this connects to supplier quotes, CIDA indices and CBSL housing-cost data. Red means a price rise (bad for buyers).</p>
        </Card>

        <MaterialDetail m={MATERIAL_BY_ID[selected]!} alert={alerts[selected]} onAlert={(a) => { fired.current.delete(selected); setAlerts((cur) => { const n = { ...cur }; if (a) n[selected] = a; else delete n[selected]; return n }) }} />
      </div>

      <Card>
        <CardHeader title="Compare cost curves" subtitle="Price change rebased to 100 at Nov 2024. Tick materials in the table to add them (up to 6)." action={<div className="flex flex-wrap gap-1.5">{compare.map((id, i) => <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2 pr-1 text-xs font-medium"><span className="size-2 rounded-full" style={{ background: COMPARE_COLORS[i] }} />{MATERIAL_BY_ID[id]!.name.split(' (')[0]}<button onClick={() => setCompare(compare.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-slate-200 cursor-pointer" aria-label="Remove"><X size={11} /></button></span>)}</div>} />
        <div className="h-72 px-2 pb-4">
          <ResponsiveContainer>
            <LineChart data={compareData} margin={{ left: 0, right: 16, top: 6 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis domain={['dataMin - 3', 'dataMax + 3']} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<ChartTooltip fmt={(v) => v.toFixed(1)} labelFmt={monthLabel} />} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} formatter={(v) => MATERIAL_BY_ID[v]?.name ?? v} />
              <ReferenceLine y={100} stroke="#cbd5e1" />
              {compare.map((id, i) => <Line key={id} dataKey={id} name={id} stroke={COMPARE_COLORS[i]} strokeWidth={2.2} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

function MaterialDetail({ m, alert, onAlert }: { m: Material; alert?: { target: number; dir: 'above' | 'below' }; onAlert: (a: { target: number; dir: 'above' | 'below' } | null) => void }) {
  const { prices, district } = usePrices()
  const [range, setRange] = useState<Range>(12)
  const [target, setTarget] = useState('')
  const f = districtFactor(district)
  const h = priceHistory(m).map((v) => v * f)
  const colombo = prices[m.id]!.price
  const live = colombo * f
  const data = [...HISTORY_MONTHS.map((month, i) => ({ month, Price: h[i]! })).slice(-range), { month: 'Live', Price: live }]
  const lo = Math.min(...h), hi = Math.max(...h)

  return (
    <Card className="order-first h-fit 2xl:order-none">
      <div className="px-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge tone="accent">{m.category}</Badge>
            <h3 className="mt-2 font-display text-lg font-bold">{m.name}</h3>
            <p className="text-xs text-slate-500">{m.spec} · {m.supply} supply{m.brands.length ? ` · ${m.brands.join(', ')}` : ''}</p>
          </div>
          <Tabs<string> value={String(range)} onChange={(v) => setRange(+v as Range)} tabs={[{ id: '6', label: '6M' }, { id: '12', label: '1Y' }, { id: '24', label: '2Y' }]} />
        </div>
        <p className="mt-3"><span className="num font-display text-3xl font-bold">{rs(live, live < 100)}</span><span className="ml-1 text-sm text-slate-500">/ {m.unit} · {district}</span></p>
      </div>
      <div className="h-48 px-2">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ left: 0, right: 12, top: 10 }}>
            <defs><linearGradient id="md" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity={0.3} /><stop offset="1" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
            <XAxis dataKey="month" tickFormatter={(v) => (v === 'Live' ? 'Now' : monthLabel(v))} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={['dataMin', 'dataMax']} hide />
            <Tooltip content={<ChartTooltip fmt={(v) => rs(v, v < 100)} labelFmt={(l) => (l === 'Live' ? 'Live' : monthLabel(l))} />} />
            {alert && <ReferenceLine y={alert.target} stroke="#ef4444" strokeDasharray="4 3" />}
            <Area dataKey="Price" stroke="var(--accent)" strokeWidth={2.4} fill="url(#md)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-px border-y border-slate-100 bg-slate-100 text-center">
        {[['24-mo low', rs(lo)], ['24-mo high', rs(hi)], ['Volatility', `${(m.vol * 100 * Math.sqrt(12)).toFixed(1)}% / yr`]].map(([k, v]) => <div key={k} className="bg-white py-2.5"><p className="text-[11px] text-slate-500">{k}</p><p className="num text-sm font-semibold">{v}</p></div>)}
      </div>
      <div className="px-5 py-4">
        <p className="mb-2 text-xs font-semibold text-slate-600">Regional prices today</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {DISTRICTS.map((d) => (
            <div key={d.name} className={clsx('flex justify-between rounded px-1.5 py-1', d.name === district && 'bg-accent-soft font-semibold')}>
              <span className="text-slate-600">{d.name}</span><span className="num">{num(colombo * d.factor, colombo < 100 ? 2 : 0)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 px-5 py-4">
        {alert ? (
          <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="inline-flex items-center gap-2"><BellRing size={15} />Alert when {alert.dir} {rs(alert.target)}</span>
            <button onClick={() => onAlert(null)} className="text-xs font-semibold hover:underline cursor-pointer">Remove</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input className={inputCls} type="number" placeholder={`Alert price (${district})`} value={target} onChange={(e) => setTarget(e.target.value)} />
            <Button disabled={!target} onClick={() => { onAlert({ target: +target, dir: +target < live ? 'below' : 'above' }); setTarget('') }}><Bell size={15} />Set alert</Button>
          </div>
        )}
      </div>
    </Card>
  )
}
