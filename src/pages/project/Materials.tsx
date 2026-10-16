import clsx from 'clsx'
import { AlertTriangle, PackageCheck, TrendingDown, TrendingUp, Warehouse } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Card, CardHeader, Delta, Stat, Tabs } from '../../components/ui'
import { Sparkline } from '../../components/visuals'
import { MATERIAL_BY_ID, districtFactor, priceHistory } from '../../data/materials'
import { num, rs, rsCompact } from '../../lib/format'
import { usePrices } from '../../store/store'
import { useProject } from './ProjectLayout'

type View = 'all' | 'remaining' | 'stock'

export default function Materials() {
  const p = useProject()
  const { priceOf, prices } = usePrices()
  const [view, setView] = useState<View>('all')
  const f = districtFactor(p.district)

  const rows = useMemo(() => p.boq.map((b) => {
    const m = MATERIAL_BY_ID[b.materialId]!
    const live = priceOf(b.materialId) * f
    const remaining = Math.max(0, b.planned - b.delivered)
    const stock = Math.max(0, b.delivered - b.used)
    const h = priceHistory(m)
    const trend3m = h[h.length - 1]! / h[h.length - 4]! - 1
    return { b, m, live, remaining, stock, trend3m, spark: [...h.slice(-11), prices[m.id]!.price], diff: live / b.contractRate - 1 }
  }), [p.boq, priceOf, prices, f])

  const contractValue = rows.reduce((s, r) => s + r.b.planned * r.b.contractRate, 0)
  const liveValue = rows.reduce((s, r) => s + r.b.planned * r.live, 0)
  const remainingContract = rows.reduce((s, r) => s + r.remaining * r.b.contractRate, 0)
  const remainingLive = rows.reduce((s, r) => s + r.remaining * r.live, 0)
  const stockValue = rows.reduce((s, r) => s + r.stock * r.live, 0)
  const exposure = remainingLive - remainingContract

  const shown = rows.filter((r) => view === 'all' || (view === 'remaining' && r.remaining > 0) || (view === 'stock' && r.stock > 0)).sort((a, b) => b.remaining * b.live - a.remaining * a.live)
  const buyNow = rows.filter((r) => r.remaining * r.live > 100_000 && r.trend3m > 0.015).sort((a, b) => b.trend3m - a.trend3m).slice(0, 3)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold">Materials & bill of quantities</h2>
        <p className="text-sm text-slate-500">Quantities taken off the architect's drawings, re-priced live at {p.district} market rates.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="BOQ at contract rates" value={rsCompact(contractValue)} icon={<PackageCheck size={15} />} sub="Measured materials only" />
        <Stat label="Same BOQ at today's prices" value={rsCompact(liveValue)} icon={liveValue > contractValue ? <TrendingUp size={15} /> : <TrendingDown size={15} />} sub={<><Delta value={liveValue / contractValue - 1} invert /> since contract</>} />
        <Stat label="Escalation exposure" value={rsCompact(exposure)} icon={<AlertTriangle size={15} />} tone={exposure > 0 ? 'down' : 'up'} sub={`On ${rsCompact(remainingLive)} still to purchase`} />
        <Stat label="Stock on site" value={rsCompact(stockValue)} icon={<Warehouse size={15} />} sub="Delivered but not yet used" />
      </div>

      {buyNow.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-start gap-3">
            <TrendingUp size={18} className="mt-0.5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Buy-timing insight</p>
              <p className="mt-0.5 text-sm text-amber-800">These materials have risen over the last 3 months and still have large quantities to buy. Forward-purchasing at today's rate could reduce escalation:</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {buyNow.map((r) => <span key={r.m.id} className="rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-sm ring-1 ring-amber-200"><b>{r.m.name}</b> · <Delta value={r.trend3m} invert /> 3 mo · {num(r.remaining)} {r.m.unit} left (≈ {rsCompact(r.remaining * r.live)})</span>)}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Quantity tracker" subtitle="Planned → delivered → used, with live re-pricing" action={<Tabs<View> value={view} onChange={setView} tabs={[{ id: 'all', label: 'All' }, { id: 'remaining', label: 'To buy' }, { id: 'stock', label: 'On site' }]} />} />
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs text-slate-500">
                <th className="px-5 py-2.5 font-semibold">Material</th>
                <th className="px-3 font-semibold">Planned</th>
                <th className="w-44 px-3 font-semibold">Delivered / used</th>
                <th className="px-3 text-right font-semibold">On site</th>
                <th className="px-3 text-right font-semibold">To buy</th>
                <th className="px-3 text-right font-semibold">Contract rate</th>
                <th className="px-3 text-right font-semibold">Live rate</th>
                <th className="px-3 font-semibold">12 mo</th>
                <th className="px-5 text-right font-semibold">Remaining @ live</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ b, m, live, remaining, stock, spark, diff }) => {
                const dPct = b.planned ? (b.delivered / b.planned) * 100 : 0
                const uPct = b.planned ? (b.used / b.planned) * 100 : 0
                return (
                  <tr key={b.materialId} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3"><p className="font-medium text-slate-800">{m.name}</p><p className="text-[11px] text-slate-400">{m.category} · {m.spec}</p></td>
                    <td className="num px-3 whitespace-nowrap">{num(b.planned, b.planned < 100 ? 1 : 0)} <span className="text-[11px] text-slate-400">{m.unit}</span></td>
                    <td className="px-3">
                      <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-accent/30" style={{ width: `${Math.min(100, dPct)}%` }} />
                        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.min(100, uPct)}%` }} />
                      </div>
                      <p className="num mt-1 text-[11px] text-slate-500">{dPct.toFixed(0)}% delivered · {uPct.toFixed(0)}% used</p>
                    </td>
                    <td className="num px-3 text-right">{stock > 0 ? num(stock, stock < 100 ? 1 : 0) : <span className="text-slate-300">—</span>}</td>
                    <td className="num px-3 text-right">{remaining > 0 ? num(remaining, remaining < 100 ? 1 : 0) : <Badge tone="green">Complete</Badge>}</td>
                    <td className="num px-3 text-right">{rs(b.contractRate)}</td>
                    <td className="px-3 text-right"><span className="num font-semibold">{rs(live)}</span><br /><Delta value={diff} invert /></td>
                    <td className="px-3"><Sparkline data={spark} width={70} height={22} /></td>
                    <td className={clsx('num px-5 text-right font-semibold', remaining === 0 && 'text-slate-300')}>{remaining > 0 ? rsCompact(remaining * live) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">Live rates are Colombo prices × the {p.district} regional factor ({f.toFixed(3)}). Contract rates come from the priced BOQ at contract signing ({p.start.slice(0, 7)}).</p>
      </Card>
    </div>
  )
}
