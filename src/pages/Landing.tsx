import clsx from 'clsx'
import {
  ArrowRight, BadgeCheck, Building2, Calculator, Camera, CheckCircle2, FileStack, Home, Landmark, LineChart, Receipt, ShieldCheck, Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Logo } from '../components/Layout'
import { Ticker } from '../components/Ticker'
import { ChartTooltip } from '../components/visuals'
import type { Sector } from '../data/estimator'
import { MATERIAL_BY_ID } from '../data/materials'
import type { Role } from '../data/types'
import { monthLabel, num, rsCompact } from '../lib/format'
import { useAuth } from '../store/auth'
import { ROLE_META, useApp, usePrices } from '../store/store'

const FEATURES = [
  { icon: LineChart, title: 'Live material prices', body: 'Cement, steel, sand, aggregates and finishes, tracked across 13 districts with 24-month cost curves and the Nirmana Construction Cost Index.' },
  { icon: Calculator, title: 'Estimates at real prices', body: 'Quantity take-offs priced at today\'s market rates. See what your house or tower should cost before you sign the BOQ.' },
  { icon: FileStack, title: 'Architect plans, versioned', body: 'Every drawing revision in one place, with pin-point comments and client sign-off before anything is built.' },
  { icon: Camera, title: 'Real-time site progress', body: 'Daily logs from the contractor with photos, weather, crew size and materials used, acknowledged by the architect.' },
  { icon: Receipt, title: 'Open-book cost ledger', body: 'Every purchase is matched to the market rate for that month. Over-priced items are flagged before they are paid.' },
  { icon: ShieldCheck, title: 'Approvals & payments', body: 'Change orders, milestone certificates and retention, all approved by the client with a full audit trail.' },
]

export default function Landing() {
  const navigate = useNavigate()
  const { projects } = useApp()
  const { user } = useAuth()
  const { prices, localPrice } = usePrices()
  const [sector, setSector] = useState<Sector>('residential')

  useEffect(() => {
    document.documentElement.dataset.sector = sector
  }, [sector])

  // Signed-in users go straight to their workspace; everyone else logs in first.
  const enter = (s: Sector, r?: Role) => {
    if (user) navigate(`/${s}/dashboard`)
    else navigate(`/login?sector=${s}${r ? `&role=${r}` : ''}`)
  }

  const hero = projects.find((p) => p.id === (sector === 'residential' ? 'perera-residence' : 'lotus-grove'))!
  const curve = hero.curve.map((c) => ({ month: c.month, Planned: c.pv, Actual: c.ac }))
  const live = ['cement-opc', 'steel-t12', 'sand-river', 'brick-clay']

  return (
    <div className="min-h-full bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 blueprint-bg opacity-40" />
        <div className="absolute -top-40 right-[-10%] size-[640px] rounded-full bg-accent/30 blur-[120px]" />
        <div className="absolute bottom-[-30%] left-[-10%] size-[520px] rounded-full bg-brand/15 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <nav className="flex h-20 items-center justify-between">
            <Logo light />
            <div className="hidden md:flex items-center gap-8 text-sm text-slate-300">
              <a href="#features" className="hover:text-white">Platform</a>
              <a href="#transparency" className="hover:text-white">How it works</a>
              <a href="#sectors" className="hover:text-white">Residential & Commercial</a>
            </div>
            <button onClick={() => enter(sector)} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 cursor-pointer">{user ? 'Open workspace' : 'Log in'}</button>
          </nav>

          <div className="grid gap-12 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
            <div className="rise">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/15">
                <Sparkles size={13} className="text-brand" /> Built for Sri Lankan construction
              </span>
              <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                Build with <span className="bg-gradient-to-r from-brand to-amber-200 bg-clip-text text-transparent">clarity.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
                One shared workspace for clients, architects and contractors, with live material prices, real-time site progress and every rupee checked against the market.
              </p>

              <div className="mt-8 inline-grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
                {(['residential', 'commercial'] as Sector[]).map((s) => (
                  <button key={s} onClick={() => setSector(s)} className={clsx('flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition cursor-pointer', sector === s ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white')}>
                    {s === 'residential' ? <Home size={16} /> : <Building2 size={16} />}
                    {s === 'residential' ? 'Residential' : 'Commercial'}
                  </button>
                ))}
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">{user ? `Signed in as ${user.name}` : 'Log in or sign up as'}</p>
              <div className="mt-2.5 grid max-w-xl gap-2 sm:grid-cols-3">
                {(Object.keys(ROLE_META) as Role[]).map((r) => (
                  <button key={r} onClick={() => enter(sector, r)} className="group rounded-xl bg-white/[0.06] p-3.5 text-left ring-1 ring-white/10 transition hover:bg-white/[0.12] hover:ring-white/25 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{ROLE_META[r].label}</span>
                      <ArrowRight size={15} className="text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-brand" />
                    </div>
                    <p className="mt-1 text-xs leading-snug text-slate-400">{ROLE_META[r].description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Product preview */}
            <div className="relative rise" style={{ animationDelay: '120ms' }}>
              <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-2xl ring-1 ring-black/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-accent">{hero.location}</p>
                    <p className="font-display text-lg font-bold">{hero.name}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{hero.progress}% complete</span>
                </div>
                <div className="mt-3 h-40">
                  <ResponsiveContainer>
                    <AreaChart data={curve} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="lp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity={0.35} /><stop offset="1" stopColor="var(--accent)" stopOpacity={0} /></linearGradient>
                      </defs>
                      <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
                      <Tooltip content={<ChartTooltip labelFmt={monthLabel} />} />
                      <Area dataKey="Planned" stroke="#94a3b8" strokeDasharray="4 4" fill="none" strokeWidth={1.5} />
                      <Area dataKey="Actual" stroke="var(--accent)" fill="url(#lp)" strokeWidth={2.5} connectNulls={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {live.map((id) => {
                    const p = prices[id]!
                    const m = MATERIAL_BY_ID[id]!
                    return (
                      <div key={id} className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="truncate text-[11px] text-slate-500">{m.name}</p>
                        <p key={p.at} className={clsx('num text-sm font-bold rounded', p.at && (p.dir > 0 ? 'flash-up' : 'flash-down'))}>Rs {num(localPrice(id))}<span className="ml-1 text-[10px] font-medium text-slate-400">/{m.unit}</span></p>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 hidden w-64 rounded-xl bg-white p-3.5 text-slate-900 shadow-xl ring-1 ring-black/5 sm:block">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700"><BadgeCheck size={15} /> Rate check flagged</div>
                <p className="mt-1 text-xs text-slate-600">
                  {sector === 'residential' ? <>River sand invoiced at <b>14% above</b> the Colombo market rate.</> : <>Ready-mix G25 invoiced at <b>8% above</b> the Colombo market rate.</>} The client has asked for the supplier quote.
                </p>
              </div>
              <div className="absolute -right-4 -top-14 hidden rounded-xl bg-white px-3.5 py-2.5 text-slate-900 shadow-xl ring-1 ring-black/5 sm:block">
                <p className="text-[11px] text-slate-500">Contract value</p>
                <p className="num font-display text-base font-bold">{rsCompact(hero.contractSum)}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative border-t border-white/10 bg-black/20 py-2.5"><Ticker dark /></div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-accent">The platform</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-slate-900">Everything your project needs, visible to everyone who pays for it.</h2>
          <p className="mt-4 text-lg text-slate-500">Construction is the biggest purchase most families and businesses make. Nirmana gives you the same information the contractor has.</p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 p-6 transition hover:border-accent/40 hover:shadow-lg">
              <div className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent"><f.icon size={21} /></div>
              <h3 className="mt-5 font-display text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Transparency triangle */}
      <section id="transparency" className="bg-slate-50 py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-accent">How transparency works</p>
            <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-slate-900">Three parties. One source of truth.</h2>
            <div className="mt-8 space-y-5">
              {[
                ['Architect issues', 'Plans, revisions and specifications go to the client for sign-off. The architect certifies progress before any payment is released.'],
                ['Contractor reports', 'Daily logs, deliveries and invoices are posted with receipts. Each material rate is compared with the live market rate for that district.'],
                ['Client decides', 'Change orders, plan revisions and milestone payments wait for the client\'s approval, with cost and schedule impact shown up front.'],
              ].map(([t, b], i) => (
                <div key={t} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                  <div><p className="font-semibold text-slate-900">{t}</p><p className="mt-1 text-sm leading-relaxed text-slate-500">{b}</p></div>
                </div>
              ))}
            </div>
          </div>
          <TrustTriangle />
        </div>
      </section>

      {/* Sectors */}
      <section id="sectors" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {([
            ['residential', Home, 'Residential', 'Houses, villas, renovations and low-rise apartments. Built for homeowners spending their life savings, often from abroad.', ['Plain-language progress for families overseas', 'Rate checks on cement, steel and sand', 'Milestone payments with 5% retention', 'Estimator calibrated to local Rs/sq ft']],
            ['commercial', Building2, 'Commercial', 'Offices, retail, hotels and warehouses. Built for developers, boards and lenders who need earned-value reporting.', ['Earned value: CPI, SPI and forecast at completion', 'Multi-trade change control with schedule impact', 'Façade, MEP and HVAC cost norms', 'Cost-to-complete at today\'s market prices']],
          ] as const).map(([s, Icon, title, body, bullets]) => (
            <div key={s} data-sector={s} className={clsx('relative overflow-hidden rounded-3xl p-8 text-white', s === 'residential' ? 'bg-gradient-to-br from-teal-800 to-teal-600' : 'bg-gradient-to-br from-indigo-900 to-blue-600')}>
              <Icon size={30} className="opacity-90" />
              <h3 className="mt-5 font-display text-3xl font-extrabold">{title}</h3>
              <p className="mt-3 max-w-md text-white/80">{body}</p>
              <ul className="mt-6 space-y-2">
                {bullets.map((b) => <li key={b} className="flex items-center gap-2 text-sm"><CheckCircle2 size={16} className="text-white/80" />{b}</li>)}
              </ul>
              <button onClick={() => enter(s)} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 cursor-pointer">
                Open {title.toLowerCase()} workspace <ArrowRight size={15} />
              </button>
              <Landmark size={220} className="absolute -bottom-10 -right-10 opacity-[0.07]" />
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:px-8">
          <Logo />
          <p>Demo build · prices are indicative and simulated · © 2026 Nirmana</p>
        </div>
      </footer>
    </div>
  )
}

function TrustTriangle() {
  const nodes = [
    { x: 260, y: 60, label: 'Client', sub: 'Approves & pays', color: ROLE_META.client.color, bg: ROLE_META.client.bg },
    { x: 70, y: 380, label: 'Architect', sub: 'Designs & certifies', color: ROLE_META.architect.color, bg: ROLE_META.architect.bg },
    { x: 450, y: 380, label: 'Contractor', sub: 'Builds & reports', color: ROLE_META.contractor.color, bg: ROLE_META.contractor.bg },
  ]
  const edges = [
    [0, 1, 'Plans for sign-off'], [1, 2, 'Drawings → Certificates'], [2, 0, 'Logs, invoices, receipts'],
  ] as const
  return (
    <svg viewBox="0 0 520 460" className="w-full">
      <defs>
        <marker id="tri-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#94a3b8" /></marker>
      </defs>
      {edges.map(([a, b, label]) => {
        const A = nodes[a]!, B = nodes[b]!
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2
        return (
          <g key={label}>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#cbd5e1" strokeWidth={2} strokeDasharray="6 6" markerEnd="url(#tri-arrow)" markerStart="url(#tri-arrow)" />
            <rect x={mx - 84} y={my - 14} width={168} height={28} rx={14} fill="#fff" stroke="#e2e8f0" />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#475569" fontFamily="Inter">{label}</text>
          </g>
        )
      })}
      <circle cx={260} cy={273} r={58} fill="var(--accent)" opacity={0.1} />
      <circle cx={260} cy={273} r={40} fill="var(--accent)" />
      <text x={260} y={269} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" fontFamily="Inter">NIRMANA</text>
      <text x={260} y={284} textAnchor="middle" fontSize={9} fill="#fff" opacity={0.85} fontFamily="Inter">audit trail</text>
      {nodes.map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r={44} fill={n.bg} stroke={n.color} strokeWidth={2} />
          <text x={n.x} y={n.y - 2} textAnchor="middle" fontSize={14} fontWeight={800} fill={n.color} fontFamily="Plus Jakarta Sans">{n.label}</text>
          <text x={n.x} y={n.y + 14} textAnchor="middle" fontSize={10} fill="#475569" fontFamily="Inter">{n.sub}</text>
        </g>
      ))}
    </svg>
  )
}
