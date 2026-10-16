import clsx from 'clsx'
import { Info } from 'lucide-react'
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardHeader, Progress } from '../../components/ui'
import { ChartTooltip } from '../../components/visuals'
import { axisRs, TODAY_ISO, date, monthLabel, pct, rs, rsCompact } from '../../lib/format'
import { projectMetrics } from '../../lib/metrics'
import { useProject } from './ProjectLayout'

const PALETTE = ['#0d9488', '#3b5bdb', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#ec4899', '#64748b', '#14b8a6', '#a855f7', '#f97316']

export default function Budget() {
  const p = useProject()
  const m = projectMetrics(p)
  const bac = m.revised
  const ev = m.earned
  const ac = m.costToDate
  const pv = [...p.curve].reverse().find((c) => c.month <= TODAY_ISO)?.pv ?? 0
  const etc = Math.max(0, m.eac - ac)
  const tcpi = bac - ac > 0 ? (bac - ev) / (bac - ac) : 1

  // Project forward from today to completion at the current cost performance.
  const lastAc = ac
  const curve = p.curve.map((c) => {
    const after = c.month > TODAY_ISO
    const forecast = after && p.progress > 0 ? lastAc + (m.eac - lastAc) * ((c.pv - pv) / Math.max(1, p.contractSum - pv)) : c.month === TODAY_ISO ? lastAc : null
    return { month: c.month, Planned: c.pv, Earned: c.ev, Actual: c.ac, Forecast: forecast }
  })

  const evm = [
    { k: 'BAC', label: 'Budget at completion', v: rs(bac), help: 'The total agreed price, including approved change orders.' },
    { k: 'PV', label: 'Planned value (today)', v: rs(pv), help: 'Value of the work that should be done by today according to the programme.' },
    { k: 'EV', label: 'Earned value', v: rs(ev), help: 'Value of the work actually completed, certified by the architect.' },
    { k: 'AC', label: 'Actual cost', v: rs(ac), help: 'Money actually spent so far, from the open-book ledger.' },
    { k: 'CV', label: 'Cost variance', v: rs(ev - ac), bad: ev - ac < 0, help: 'Negative means more money has been spent than the completed work is worth.' },
    { k: 'SV', label: 'Schedule variance', v: rs(ev - pv), bad: ev - pv < 0, help: 'Negative means the project is behind the planned programme.' },
    { k: 'CPI', label: 'Cost performance index', v: m.cpi.toFixed(3), bad: m.cpi < 1, help: 'Value earned per Rs 1 spent. Below 1.00 means over budget.' },
    { k: 'SPI', label: 'Schedule performance index', v: m.spi.toFixed(3), bad: m.spi < 0.97, help: 'Work done ÷ work planned. Below 1.00 means behind schedule.' },
    { k: 'EAC', label: 'Estimate at completion', v: rs(m.eac), bad: m.variance > 0, help: 'Forecast final cost if current performance continues.' },
    { k: 'ETC', label: 'Estimate to complete', v: rs(etc), help: 'How much more money is needed to finish.' },
    { k: 'VAC', label: 'Variance at completion', v: rs(bac - m.eac), bad: bac - m.eac < 0, help: 'Expected saving (positive) or overrun (negative) at handover.' },
    { k: 'TCPI', label: 'To-complete performance', v: tcpi.toFixed(3), bad: tcpi > 1.05, help: 'Efficiency needed on remaining work to finish on budget. Above 1.05 is hard to achieve.' },
  ]

  const byCat = new Map<string, number>()
  p.ledger.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount))
  const catData = Array.from(byCat, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const phaseData = p.phases.map((ph) => ({ name: ph.name.split(/[ &,]/)[0], full: ph.name, Budget: ph.budget, Earned: ph.budget * (ph.progress / 100), Actual: ph.actual }))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Cost curve: planned vs earned vs actual" subtitle="Cumulative S-curve. The dotted orange line projects the final cost at today's cost performance." />
        <div className="h-80 px-2 pb-4">
          <ResponsiveContainer>
            <ComposedChart data={curve} margin={{ left: 8, right: 20, top: 8 }}>
              <defs><linearGradient id="b-ev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity={0.22} /><stop offset="1" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickFormatter={axisRs} tickLine={false} axisLine={false} width={64} />
              <Tooltip content={<ChartTooltip labelFmt={date} />} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={bac} stroke="#0f172a" strokeDasharray="2 4" label={{ value: `Budget ${rsCompact(bac)}`, position: 'insideTopLeft', fontSize: 11, fill: '#334155' }} />
              <ReferenceLine x={TODAY_ISO} stroke="#ef4444" strokeDasharray="3 3" />
              <Line name="Planned (PV)" dataKey="Planned" stroke="#94a3b8" strokeDasharray="6 4" dot={false} strokeWidth={2} />
              <Area name="Earned (EV)" dataKey="Earned" stroke="var(--accent)" fill="url(#b-ev)" strokeWidth={2.5} />
              <Line name="Actual (AC)" dataKey="Actual" stroke="#f59e0b" dot={false} strokeWidth={2.5} />
              <Line name="Forecast" dataKey="Forecast" stroke="#f59e0b" strokeDasharray="2 4" dot={false} strokeWidth={2} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div>
        <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold">Earned value, in plain language <Info size={15} className="text-slate-400" /></h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {evm.map((x) => (
            <Card key={x.k} className="p-4">
              <div className="flex items-center justify-between"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{x.k}</span>{x.bad != null && <span className={clsx('size-2 rounded-full', x.bad ? 'bg-red-500' : 'bg-emerald-500')} />}</div>
              <p className="mt-2 text-xs text-slate-500">{x.label}</p>
              <p className={clsx('num mt-0.5 text-lg font-bold', x.bad && 'text-red-600')}>{x.v}</p>
              <p className="mt-1.5 text-[11.5px] leading-snug text-slate-500">{x.help}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Budget by phase" subtitle="Budget vs value earned vs actual spend" />
          <div className="h-72 px-2 pb-4">
            <ResponsiveContainer>
              <BarChart data={phaseData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis tickFormatter={axisRs} tickLine={false} axisLine={false} width={60} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="Budget" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Earned" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Actual" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Where the money went" subtitle={`${rsCompact(ac)} spent by category`} />
          <div className="flex flex-col items-center gap-2 px-5 pb-5 sm:flex-row">
            <div className="size-44 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={1.5} stroke="none">
                    {catData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full space-y-1.5">
              {catData.slice(0, 8).map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="size-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="flex-1 truncate text-slate-600">{c.name}</span>
                  <span className="num font-semibold">{pct((c.value / ac) * 100, 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Phase cost table" />
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs text-slate-500"><th className="px-5 py-2.5 font-semibold">Phase</th><th className="px-3 font-semibold">Progress</th><th className="px-3 text-right font-semibold">Budget</th><th className="px-3 text-right font-semibold">Earned</th><th className="px-3 text-right font-semibold">Actual</th><th className="px-5 text-right font-semibold">Variance</th></tr></thead>
            <tbody>
              {phaseData.map((ph, i) => {
                const v = ph.Earned - ph.Actual
                return (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-5 py-2.5 font-medium text-slate-800">{ph.full}</td>
                    <td className="w-40 px-3"><div className="flex items-center gap-2"><Progress value={p.phases[i]!.progress} height={5} /><span className="num w-9 text-xs">{p.phases[i]!.progress}%</span></div></td>
                    <td className="num px-3 text-right">{rsCompact(ph.Budget)}</td>
                    <td className="num px-3 text-right">{rsCompact(ph.Earned)}</td>
                    <td className="num px-3 text-right">{rsCompact(ph.Actual)}</td>
                    <td className={clsx('num px-5 text-right font-semibold', Math.abs(v) < 1000 ? 'text-slate-400' : v < 0 ? 'text-red-600' : 'text-emerald-600')}>{Math.abs(v) < 1000 ? '—' : `${v > 0 ? '+' : '−'}${rsCompact(Math.abs(v)).replace('Rs ', '')}`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
