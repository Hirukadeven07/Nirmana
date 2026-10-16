import clsx from 'clsx'
import { Building, Building2, Factory, Home, Hotel, Printer, Store, Warehouse } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, CartesianGrid, Line, LineChart, Pie, PieChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, useSector } from '../components/Layout'
import { Button, Card, CardHeader, Field, inputCls } from '../components/ui'
import { ChartTooltip } from '../components/visuals'
import { BUILDING_TYPES, GRADES, estimate, type Grade } from '../data/estimator'
import { DISTRICTS, districtFactor } from '../data/materials'
import { axisRs, num, pct, rs, rsCompact } from '../lib/format'
import { usePrices } from '../store/store'

const ICONS: Record<string, typeof Home> = { house: Home, villa: Hotel, apartment: Building, office: Building2, retail: Store, warehouse: Warehouse, hotel: Factory }
const PALETTE = ['#0d9488', '#3b5bdb', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#ec4899', '#64748b', '#14b8a6', '#a855f7', '#f97316', '#0ea5e9']

export default function Estimator() {
  const sector = useSector()
  const { priceOf, district: globalDistrict } = usePrices()
  const types = BUILDING_TYPES.filter((t) => t.sector === sector)
  const [typeId, setTypeId] = useState(types[0]!.id)
  const type = types.find((t) => t.id === typeId) ?? types[0]!
  const [area, setArea] = useState(sector === 'residential' ? 2200 : 30000)
  const [floors, setFloors] = useState(sector === 'residential' ? 2 : 8)
  const [grade, setGrade] = useState<Grade>('standard')
  const [district, setDistrict] = useState(globalDistrict)
  const [contingency, setContingency] = useState(5)
  const [vat, setVat] = useState(false)

  // Reset to sensible defaults when switching sides of the app.
  const [lastSector, setLastSector] = useState(sector)
  if (lastSector !== sector) {
    setLastSector(sector)
    setTypeId(types[0]!.id)
    setArea(sector === 'residential' ? 2200 : 30000)
    setFloors(sector === 'residential' ? 2 : 8)
  }

  const input = { typeId: type.id, area, floors, grade, districtFactor: districtFactor(district), includeVat: vat, contingencyPct: contingency }
  const e = estimate(input, priceOf)

  const maxArea = sector === 'residential' ? (type.id === 'apartment' ? 60000 : 8000) : 200000
  const minArea = sector === 'residential' ? 600 : 3000
  const curve = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 40; i++) {
      const a = Math.round(minArea * Math.pow(maxArea / minArea, i / 40))
      pts.push({ area: a, perSqft: Math.round(estimate({ ...input, area: a }, priceOf).perSqft) })
    }
    return pts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type.id, floors, grade, district, vat, contingency, priceOf, minArea, maxArea])

  const sensitivity = useMemo(() => {
    const ids = e.lines.slice(0, 6).map((l) => l.materialId)
    return ids.map((id) => {
      const up = estimate(input, (x) => priceOf(x) * (x === id ? 1.1 : 1)).total
      return { name: e.lines.find((l) => l.materialId === id)!.name.replace(/ \(.*\)/, '').replace('Tor Steel Bar', 'Steel'), impact: up - e.total }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.total])

  const gradeCompare = GRADES.map((g) => ({ name: g.label, total: estimate({ ...input, grade: g.id }, priceOf).total }))

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Cost estimator"
        subtitle="Quantity-based estimate at today's live material prices. Know what your building should cost before you sign the contract."
        actions={<Button onClick={() => window.print()}><Printer size={15} />Print estimate</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card className="h-fit p-5 xl:sticky xl:top-6">
          <p className="mb-2 text-xs font-semibold text-slate-600">Building type</p>
          <div className="grid grid-cols-2 gap-2">
            {types.map((t) => {
              const I = ICONS[t.id] ?? Home
              return (
                <button key={t.id} onClick={() => setTypeId(t.id)} className={clsx('rounded-xl border p-3 text-left transition cursor-pointer', t.id === type.id ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-slate-200 hover:border-slate-300')}>
                  <I size={18} className={t.id === type.id ? 'text-accent' : 'text-slate-400'} />
                  <p className="mt-2 text-sm font-semibold leading-tight text-slate-800">{t.label}</p>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{type.description}</p>

          <div className="mt-5 space-y-5">
            <Field label={`Gross floor area: ${num(area)} sq ft (${num(area * 0.0929, 0)} m²)`}>
              <input type="range" min={minArea} max={maxArea} step={sector === 'residential' ? 50 : 500} value={Math.min(area, maxArea)} onChange={(ev) => setArea(+ev.target.value)} className="w-full accent-[var(--accent)]" />
              <input type="number" className={clsx(inputCls, 'mt-2 num')} value={area} onChange={(ev) => setArea(Math.max(100, +ev.target.value))} />
            </Field>
            <Field label="Floors">
              <div className="flex gap-1.5">
                {(sector === 'residential' ? [1, 2, 3, 4, 5] : [1, 3, 5, 8, 12, 20]).map((f) => (
                  <button key={f} onClick={() => setFloors(f)} className={clsx('h-9 flex-1 rounded-lg border text-sm font-semibold cursor-pointer', floors === f ? 'border-accent bg-accent text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>{f}</button>
                ))}
              </div>
            </Field>
            <Field label="Finish grade">
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
                {GRADES.map((g) => <button key={g.id} onClick={() => setGrade(g.id)} className={clsx('rounded-md py-1.5 text-xs font-semibold cursor-pointer', grade === g.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>{g.label}</button>)}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">{GRADES.find((g) => g.id === grade)!.note}</p>
            </Field>
            <Field label="District">
              <select className={inputCls} value={district} onChange={(ev) => setDistrict(ev.target.value)}>{DISTRICTS.map((d) => <option key={d.name} value={d.name}>{d.name} ({d.factor >= 1 ? '+' : ''}{((d.factor - 1) * 100).toFixed(1)}%)</option>)}</select>
            </Field>
            <Field label={`Contingency: ${contingency}%`}>
              <input type="range" min={0} max={15} value={contingency} onChange={(ev) => setContingency(+ev.target.value)} className="w-full accent-[var(--accent)]" />
            </Field>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
              <span><span className="font-medium">Include VAT (18%)</span><span className="block text-[11px] text-slate-500">Applies to VAT-registered contractors</span></span>
              <input type="checkbox" checked={vat} onChange={(ev) => setVat(ev.target.checked)} className="size-4 accent-[var(--accent)]" />
            </label>
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <div className="grid gap-px bg-slate-100 sm:grid-cols-2 2xl:grid-cols-4">
              <div className="bg-ink p-5 text-white sm:col-span-2">
                <p className="text-xs text-slate-400">Estimated total cost · {type.label}</p>
                <p className="num mt-1 font-display text-4xl font-extrabold">{rsCompact(e.total)}</p>
                <p className="num mt-1 text-sm text-slate-300">{rs(e.total)}</p>
                <p className="mt-3 text-xs text-slate-400">Range ±8%: <span className="num text-slate-200">{rsCompact(e.total * 0.92)} – {rsCompact(e.total * 1.08)}</span></p>
              </div>
              <div className="bg-white p-5"><p className="text-xs text-slate-500">Cost per sq ft</p><p className="num mt-1 whitespace-nowrap font-display text-2xl font-bold">{rs(e.perSqft)}</p><p className="mt-1 text-xs text-slate-500">{rs(e.perSqft / 0.0929)} / m²</p></div>
              <div className="bg-white p-5"><p className="text-xs text-slate-500">Build time</p><p className="num mt-1 whitespace-nowrap font-display text-2xl font-bold">{e.months} months</p><p className="mt-1 text-xs text-slate-500">≈ {num(e.labourDays)} worker-days</p></div>
            </div>
          </Card>

          <div className="grid gap-6 2xl:grid-cols-2">
            <Card>
              <CardHeader title="Cost breakdown" />
              <div className="flex flex-col items-center gap-3 px-5 pb-5 sm:flex-row">
                <div className="size-44 shrink-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={e.byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={1.2} stroke="none">
                        {e.byCategory.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-1.5">
                  {e.byCategory.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="flex-1 truncate text-slate-600">{c.name}</span>
                      <span className="num text-slate-500">{rsCompact(c.value)}</span>
                      <span className="num w-10 text-right font-semibold">{pct((c.value / e.total) * 100, 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader title="Cost curve: size vs Rs / sq ft" subtitle="Smaller buildings cost more per sq ft because kitchens, baths and foundations don't shrink" />
              <div className="h-52 px-2 pb-3">
                <ResponsiveContainer>
                  <LineChart data={curve} margin={{ left: 0, right: 16, top: 10 }}>
                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="area" type="number" scale="log" domain={[minArea, maxArea]} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={36} domain={['dataMin - 500', 'dataMax + 500']} />
                    <Tooltip content={<ChartTooltip fmt={(v) => rs(v)} labelFmt={(l) => `${num(+l)} sq ft`} />} />
                    <Line dataKey="perSqft" name="Rs / sq ft" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                    <ReferenceDot x={Math.min(area, maxArea)} y={Math.round(e.perSqft)} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Price sensitivity" subtitle="Change in total if each material's price rises 10%" />
              <div className="h-52 px-2 pb-3">
                <ResponsiveContainer>
                  <BarChart data={sensitivity} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tickFormatter={axisRs} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="impact" name="+10% price" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Finish grade comparison" subtitle="Same building, different specifications" />
              <div className="space-y-3 px-5 pb-5">
                {gradeCompare.map((g) => {
                  const max = gradeCompare[gradeCompare.length - 1]!.total
                  return (
                    <div key={g.name}>
                      <div className="flex justify-between text-xs"><span className={clsx('font-medium', g.name.toLowerCase() === grade && 'text-accent')}>{g.name}</span><span className="num font-semibold">{rsCompact(g.total)} · {rs(g.total / area)}/sq ft</span></div>
                      <div className="mt-1 h-2.5 rounded-full bg-slate-100"><div className={clsx('h-full rounded-full', g.name.toLowerCase() === grade ? 'bg-accent' : 'bg-slate-300')} style={{ width: `${(g.total / max) * 100}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Material take-off at live prices" subtitle={`${e.lines.length} measured items · ${district} rates · updates as the market moves`} />
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs text-slate-500"><th className="px-5 py-2.5 font-semibold">Material</th><th className="px-3 text-right font-semibold">Quantity</th><th className="px-3 text-right font-semibold">Live rate</th><th className="px-5 text-right font-semibold">Amount</th></tr></thead>
                <tbody>
                  {e.lines.map((l) => (
                    <tr key={l.materialId} className="border-b border-slate-50">
                      <td className="px-5 py-2"><p className="font-medium text-slate-800">{l.name}</p><p className="text-[11px] text-slate-400">{l.category}</p></td>
                      <td className="num px-3 text-right">{num(l.qty, l.qty < 50 ? 1 : 0)} <span className="text-[11px] text-slate-400">{l.unit}</span></td>
                      <td className="num px-3 text-right">{rs(l.rate)}</td>
                      <td className="num px-5 text-right font-semibold">{rs(l.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold"><td className="px-5 py-2.5" colSpan={3}>Measured materials subtotal</td><td className="num px-5 text-right">{rs(e.materials)}</td></tr>
                  {e.allowances.map((a) => <tr key={a.label} className="border-b border-slate-50"><td className="px-5 py-2 text-slate-700" colSpan={3}>{a.label} <span className="text-[11px] text-slate-400">· prime-cost allowance</span></td><td className="num px-5 text-right">{rs(a.amount)}</td></tr>)}
                  <tr className="border-b border-slate-50"><td className="px-5 py-2 text-slate-700" colSpan={3}>Labour (masons, carpenters, helpers) · {num(e.labourDays)} worker-days</td><td className="num px-5 text-right">{rs(e.labour)}</td></tr>
                  <tr className="border-b border-slate-50"><td className="px-5 py-2 text-slate-700" colSpan={3}>Preliminaries & site overheads (6%)</td><td className="num px-5 text-right">{rs(e.prelims)}</td></tr>
                  <tr className="border-b border-slate-50"><td className="px-5 py-2 text-slate-700" colSpan={3}>Contractor overhead & profit (10%)</td><td className="num px-5 text-right">{rs(e.margin)}</td></tr>
                  <tr className="border-b border-slate-50"><td className="px-5 py-2 text-slate-700" colSpan={3}>Contingency ({contingency}%)</td><td className="num px-5 text-right">{rs(e.contingency)}</td></tr>
                  {vat && <tr className="border-b border-slate-50"><td className="px-5 py-2 text-slate-700" colSpan={3}>VAT (18%)</td><td className="num px-5 text-right">{rs(e.vat)}</td></tr>}
                  <tr className="bg-ink text-white"><td className="px-5 py-3 font-bold" colSpan={3}>Estimated total</td><td className="num px-5 text-right text-base font-bold">{rs(e.total)}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-[11px] text-slate-400">Quantity norms are typical rule-of-thumb rates for Sri Lankan RC-frame construction and are refined from the architect's drawings once a project starts. This estimate is a guide, not a quotation.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
