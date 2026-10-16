import { BUILDING_TYPES, scaleFactor, type Sector } from './estimator'
import { MATERIAL_BY_ID, districtFactor, marketPriceAt } from './materials'
import type {
  Activity, BoqItem, ChangeOrder, DailyLog, LedgerEntry, Message, Milestone, Person, Phase, PlanSheet, Project, Role,
} from './types'
import { addDays, daysBetween, TODAY_ISO } from '../lib/format'
import { clamp, hashString, mulberry32 } from '../lib/random'

interface Seed {
  id: string
  sector: Sector
  name: string
  type: string
  typeId: string
  location: string
  district: string
  area: number
  floors: number
  start: string
  end: string
  contractSum: number
  progress: number
  health: Project['health']
  client: Person
  architect: Person
  contractor: Person
  cover: [string, string]
  /** Cost performance: actual cost ÷ earned value. */
  cpi: number
  /** Materials whose contract rate sits notably above market (transparency flags). */
  overpriced?: Record<string, number>
  changes: Omit<ChangeOrder, 'id'>[]
  plans: Omit<PlanSheet, 'id' | 'comments' | 'revisions'>[]
  messages: Omit<Message, 'id'>[]
}

const PHASES: Record<Sector, [string, number][]> = {
  residential: [
    ['Site preparation & setting out', 4], ['Foundation & plinth', 12], ['Ground-floor columns & slab', 15],
    ['Upper-floor structure & slab', 15], ['Brickwork & masonry', 10], ['Roof structure & covering', 9],
    ['Plumbing & electrical rough-in', 8], ['Plastering & screeding', 7], ['Flooring & wall tiling', 8],
    ['Doors, windows & joinery', 7], ['Painting, fittings & handover', 5],
  ],
  commercial: [
    ['Mobilisation & piling', 9], ['Substructure & basement', 11], ['Superstructure frame', 24],
    ['Façade & building envelope', 13], ['MEP & HVAC installation', 17], ['Lifts & vertical transport', 5],
    ['Internal fit-out', 12], ['External works & car park', 4], ['Testing, commissioning & handover', 5],
  ],
}

const MILESTONES: Record<Sector, [string, number, number][]> = {
  residential: [
    ['Mobilisation advance', 10, 0], ['Foundation complete', 15, 0.16], ['Ground-floor slab cast', 15, 0.31],
    ['Upper-floor slab cast', 15, 0.46], ['Roof complete', 12, 0.65], ['Plaster & services complete', 13, 0.8],
    ['Finishes & handover', 15, 1.0], ['Retention release (after 12-month DLP)', 5, 2],
  ],
  commercial: [
    ['Mobilisation advance', 10, 0], ['Piling & substructure', 12, 0.2], ['Frame to mid-level', 14, 0.32],
    ['Frame topped out', 14, 0.44], ['Envelope sealed', 12, 0.6], ['MEP first fix complete', 15, 0.76],
    ['Fit-out complete', 10, 0.9], ['Testing, commissioning & handover', 8, 1.0], ['Retention release (after 12-month DLP)', 5, 2],
  ],
}

const LOG_TEMPLATES: Record<string, { title: string; notes: string; kind: DailyLog['photos'][number]['kind'] }[]> = {
  'Site preparation': [
    { title: 'Site cleared and setting out complete', notes: 'Boundary pegs verified against survey plan. Building lines set out with profile boards; levels transferred from the benchmark on the road culvert.', kind: 'site' },
  ],
  'Foundation': [
    { title: 'Footing excavation to hard stratum', notes: 'Excavation reached lateritic hard stratum at 1.4m. Architect inspected bearing and approved. Dewatering pump on standby due to the inter-monsoon showers.', kind: 'site' },
    { title: 'Column footings cast (F1–F8)', notes: 'Cast 1:2:4 concrete with ¾" metal. 6 cube samples taken for 28-day test. Curing with wet hessian twice daily.', kind: 'slab' },
  ],
  'Ground-floor': [
    { title: 'Ground-floor column reinforcement fixed', notes: 'T16 main bars with R6 links @150mm. Cover blocks placed. Ready for the architect\'s rebar inspection before shuttering.', kind: 'rebar' },
    { title: 'Ground-floor slab poured', notes: 'Concrete poured using a mixer and vibrator. 22 workers on site. Slab cured with ponding; props stay for 14 days.', kind: 'slab' },
  ],
  'Upper-floor': [
    { title: 'Upper-floor beam & slab shuttering', notes: 'Plywood shuttering with steel props at 3ft c/c. Level checked with a water level across all bays.', kind: 'rebar' },
    { title: 'Upper-floor slab concreted', notes: 'Pour started 6:30am, finished 3:10pm. Used 214 bags of cement. Cube samples labelled UF-01 to UF-06.', kind: 'slab' },
  ],
  'Brickwork': [
    { title: 'Brickwork to lintel level, east wing', notes: 'Bricks soaked before laying; 1:5 mortar. Lintel beams over the master bedroom windows being shuttered.', kind: 'wall' },
    { title: 'Parapet and internal partitions completed', notes: 'All 4.5" partition walls complete on the upper floor. Chasing for conduits marked for the electrician.', kind: 'wall' },
  ],
  'Roof': [
    { title: 'Roof trusses fixed and anti-termite treated', notes: 'Treated timber rafters fixed at 2ft centres. Wall plates bolted to ring beam. Sheeting delivery confirmed for Friday.', kind: 'roof' },
    { title: 'Roof covering completed', notes: 'Roofing sheets laid with 6" end laps. Ridge capping and flashing done. Building is now watertight for the monsoon.', kind: 'roof' },
  ],
  'Plumbing': [
    { title: 'Concealed conduits and water lines laid', notes: 'PVC conduits fixed in wall chases; pressure-tested water lines at 10 bar for 2 hours with no drop.', kind: 'wall' },
  ],
  'Plastering': [
    { title: 'Internal plaster, ground floor', notes: '1:5 plaster, 12mm thick. Corner beads fixed. Skirting levels marked for the tiler.', kind: 'finish' },
  ],
  'Flooring': [
    { title: 'Porcelain tiling in living & dining', notes: '600×600 tiles laid with 2mm spacers. Client approved the tile layout and starting line on site.', kind: 'finish' },
  ],
  'Doors': [
    { title: 'Door frames and aluminium windows installed', notes: 'Teak frames fixed with hold-fasts. Aluminium sliding windows glazed and sealed.', kind: 'finish' },
  ],
  'Painting': [
    { title: 'First coat of emulsion applied', notes: 'Wall putty sanded; sealer and first coat complete on the ground floor. Snag list walkthrough scheduled.', kind: 'finish' },
  ],
  'Mobilisation': [
    { title: 'Piling rig mobilised; test pile complete', notes: 'Bored pile TP-1 (900mm Ø, 18m) cast. Static load test scheduled with the structural engineer.', kind: 'site' },
  ],
  'Substructure': [
    { title: 'Raft foundation pour, zone B', notes: '412 m³ of G35 ready-mix placed over 14 hours. Thermocouples installed to monitor heat of hydration.', kind: 'slab' },
  ],
  'Superstructure': [
    { title: 'Level slab cast, core walls rising', notes: 'Post-tensioning tendons stressed on the previous level. Jump-form for the lift core advanced one storey.', kind: 'slab' },
    { title: 'Column & core reinforcement inspected', notes: 'Structural engineer signed off rebar for the next pour. Tower crane availability at 94% this week.', kind: 'rebar' },
  ],
  'Façade': [
    { title: 'Curtain-wall brackets installed', notes: 'Façade subcontractor installed embed brackets on two levels. First unitised panels hoisted on the north face.', kind: 'wall' },
  ],
  'MEP': [
    { title: 'Chilled-water risers and cable trays', notes: 'Riser pipework pressure-tested. Cable trays installed on two floors; fire-stopping at slab penetrations pending.', kind: 'wall' },
  ],
  'Internal fit-out': [
    { title: 'Ceiling grid and drywall partitions', notes: 'Gypsum partitions erected in the tenant zones. Ceiling grid levelled; access panels coordinated with MEP.', kind: 'finish' },
  ],
  'Lifts': [{ title: 'Lift guide rails installed', notes: 'Rails installed in both passenger shafts. Machine room ventilation checked.', kind: 'site' }],
  'External': [{ title: 'Car park sub-base compacted', notes: 'ABC laid and compacted to 98% MDD. Drainage gully levels checked.', kind: 'site' }],
  'Testing': [{ title: 'Fire alarm cause & effect test', notes: 'Fire alarm, sprinkler and pressurisation fans tested with the fire brigade inspector present.', kind: 'finish' }],
}

function templatesFor(phaseName: string) {
  const key = Object.keys(LOG_TEMPLATES).find((k) => phaseName.startsWith(k) || phaseName.includes(k))
  return LOG_TEMPLATES[key ?? 'Superstructure']!
}

const VENDORS: Record<string, string[]> = {
  'Cement & Concrete': ['Sapumal Hardware, Kaduwela', 'Lanka Cement Distributors', 'INSEE Ready-mix Plant, Kelaniya'],
  'Steel': ['Lanka Steel Traders, Peliyagoda', 'Melwa Dealer — Nugegoda'],
  'Aggregates': ['Mahaweli Sand Suppliers', 'Avissawella Metal Crusher', 'Ruhunu Quarry Products'],
  'Masonry': ['Kurunegala Brick Kilns', 'Siyane Block Yard'],
  'Roofing': ['Rhino Roofing Dealer', 'Amano Roofing Centre'],
  'Finishes': ['Rocell Showroom, Battaramulla', 'Lanka Tiles Outlet', 'Dulux Paint Centre'],
  'Plumbing': ['S-Lon Distributor, Maharagama', 'Anton Hardware Hub'],
  'Electrical': ['Kelani Cables Dealer', 'ACL Electricals, Pettah'],
  'Timber & Joinery': ['State Timber Corporation, Kandy Rd', 'Moratuwa Timber Works'],
  'Glass & Aluminium': ['Alumex Fabricators', 'City Glass & Aluminium'],
}

function buildPhases(seed: Seed, rand: () => number): Phase[] {
  const tpl = PHASES[seed.sector]
  const total = daysBetween(seed.start, seed.end)
  let cum = 0
  let remaining = seed.progress * 100
  return tpl.map(([name, w], i) => {
    const start = addDays(seed.start, Math.round((cum / 100) * total * 0.86))
    const end = i === tpl.length - 1 ? seed.end : addDays(start, Math.max(10, Math.round((w / 100) * total * 1.45)))
    cum += w
    const done = clamp(remaining / w, 0, 1)
    remaining -= w
    const budget = seed.contractSum * (w / 100)
    const actual = budget * done * seed.cpi * (1 + (rand() - 0.5) * 0.08)
    return {
      id: `ph${i + 1}`, name, start, end: end > seed.end ? seed.end : end, weight: w, budget, actual,
      progress: Math.round(done * 100),
      verifiedBy: done >= 1 ? seed.architect.name : undefined,
    }
  })
}

const sCurve = (x: number) => {
  const f = (v: number) => 1 / (1 + Math.exp(-5 * (v - 0.5)))
  return (f(clamp(x, 0, 1)) - f(0)) / (f(1) - f(0))
}

function buildCurve(seed: Seed): Project['curve'] {
  const total = daysBetween(seed.start, seed.end)
  const elapsedToday = clamp(daysBetween(seed.start, TODAY_ISO) / total, 0, 1)
  const ev0 = seed.contractSum * seed.progress
  // Time-warp the planned S-curve so schedule performance (SPI) matches the project's health.
  const spiTarget = { 'On track': 0.985, 'At risk': 0.9, Delayed: 0.86, 'Pre-construction': 1 }[seed.health]
  let warp = 1
  if (seed.progress > 0 && elapsedToday > 0 && elapsedToday < 1) {
    const target = clamp(seed.progress / spiTarget, 0.01, 0.99)
    let lo = 0.2, hi = 5
    for (let i = 0; i < 40; i++) {
      warp = (lo + hi) / 2
      if (sCurve(Math.pow(elapsedToday, warp)) > target) lo = warp; else hi = warp
    }
  }
  const planned = (x: number) => sCurve(Math.pow(x, warp))
  const out: Project['curve'] = []
  const d = new Date(seed.start)
  d.setDate(1)
  const endD = new Date(seed.end)
  while (d <= endD) {
    const iso = d.toISOString().slice(0, 10)
    const x = clamp(daysBetween(seed.start, iso) / total, 0, 1)
    const pv = seed.contractSum * planned(x)
    let ev: number | null = null
    let ac: number | null = null
    if (iso <= TODAY_ISO && seed.progress > 0) {
      const shape = planned(elapsedToday) > 0 ? planned(x) / planned(elapsedToday) : 0
      ev = ev0 * clamp(shape, 0, 1)
      ac = ev * (1 + (seed.cpi - 1) * (elapsedToday > 0 ? x / elapsedToday : 0))
    }
    out.push({ month: iso, pv, ev, ac })
    d.setMonth(d.getMonth() + 1)
  }
  // Pin the final actual point to "today" for an exact current reading.
  if (seed.progress > 0) out.push({ month: TODAY_ISO, pv: seed.contractSum * planned(elapsedToday), ev: ev0, ac: ev0 * seed.cpi })
  return out.sort((a, b) => a.month.localeCompare(b.month))
}

const STRUCTURAL = new Set(['Cement & Concrete', 'Steel', 'Aggregates', 'Masonry'])

function buildBoq(seed: Seed, rand: () => number): BoqItem[] {
  const t = BUILDING_TYPES.find((b) => b.id === seed.typeId)!
  const scale = scaleFactor(seed.area, t.referenceArea)
  return Object.entries(t.norms).map(([id, perSqft]) => {
    const m = MATERIAL_BY_ID[id]!
    const planned = Math.round(perSqft * seed.area * scale * 10) / 10
    const markup = seed.overpriced?.[id] ?? (rand() - 0.35) * 0.06
    const contractRate = Math.round(marketPriceAt(id, seed.start) * districtFactor(seed.district) * (1 + markup))
    const frac = STRUCTURAL.has(m.category) ? clamp(seed.progress * 1.55, 0, 1) : clamp((seed.progress - 0.5) * 2.2, 0, 1)
    const delivered = Math.round(planned * frac * 10) / 10
    const used = Math.round(delivered * (0.86 + rand() * 0.1) * 10) / 10
    return { materialId: id, planned, delivered, used, contractRate }
  })
}

function buildLedger(seed: Seed, boq: BoqItem[], phases: Phase[], rand: () => number): LedgerEntry[] {
  const entries: LedgerEntry[] = []
  if (seed.progress <= 0) return entries
  const revised = seed.contractSum + seed.changes.filter((c) => c.status === 'Approved').reduce((t, c) => t + c.amount, 0)
  const elapsed = Math.max(1, daysBetween(seed.start, TODAY_ISO))
  let n = 0
  for (const b of boq) {
    if (b.delivered <= 0) continue
    const m = MATERIAL_BY_ID[b.materialId]!
    const parts = b.delivered > 50 ? 2 + Math.floor(rand() * 3) : 1
    const structural = STRUCTURAL.has(m.category)
    for (let p = 0; p < parts; p++) {
      const window = structural ? [0.04, 0.75] : [0.55, 0.98]
      const at = window[0]! + ((p + rand() * 0.8) / parts) * (window[1]! - window[0]!)
      const date = addDays(seed.start, Math.round(at * elapsed))
      const qty = Math.round((b.delivered / parts) * 10) / 10
      const over = seed.overpriced?.[b.materialId]
      const rate = Math.round(marketPriceAt(b.materialId, date) * districtFactor(seed.district) * (1 + (over ?? (rand() - 0.4) * 0.05)))
      const vendors = VENDORS[m.category] ?? ['General supplier']
      entries.push({
        id: `${seed.id}-L${++n}`, date, category: m.category, description: `${m.name} — delivery ${p + 1}/${parts}`,
        vendor: vendors[Math.floor(rand() * vendors.length)]!, materialId: m.id, qty, unit: m.unit, rate,
        amount: Math.round(qty * rate), postedBy: 'contractor', receipt: rand() > 0.06, status: 'Verified',
      })
    }
  }
  // Labour payroll, fortnightly, proportional to completed work.
  const labourShare = seed.sector === 'residential' ? 0.27 : 0.2
  const spent = Math.min(phases.reduce((s, p) => s + p.actual, 0), revised * seed.progress * seed.cpi * 0.85)
  const runs = Math.max(1, Math.floor(elapsed / 14))
  const perRun = (spent * labourShare) / runs
  for (let i = 0; i < runs; i++) {
    const date = addDays(seed.start, i * 14 + 13)
    if (date > TODAY_ISO) break
    const workers = Math.round((seed.sector === 'residential' ? 14 : 120) * (0.7 + rand() * 0.6))
    entries.push({
      id: `${seed.id}-L${++n}`, date, category: 'Labour', description: `Fortnightly payroll — ${workers} workers`,
      vendor: seed.contractor.org, amount: Math.round(perRun * (0.85 + rand() * 0.3)), postedBy: 'contractor', receipt: true, status: 'Verified',
    })
  }
  const plantHire = seed.sector === 'residential' ? ['Concrete mixer & vibrator hire', 'JCB excavator, 2 days', 'Scaffolding hire'] : ['Tower crane rental (monthly)', 'Concrete pump hire', 'Hoist & scaffolding']
  for (let i = 0; i < Math.min(6, Math.ceil(elapsed / 60)); i++) {
    const date = addDays(seed.start, Math.round(((i + 0.5) / 6) * elapsed))
    entries.push({
      id: `${seed.id}-L${++n}`, date, category: 'Plant & equipment', description: plantHire[i % plantHire.length]!,
      vendor: seed.sector === 'residential' ? 'Kaduwela Equipment Hire' : 'Heavy Lift Lanka (Pvt) Ltd',
      amount: Math.round(seed.contractSum * (seed.sector === 'residential' ? 0.0035 : 0.004) * (0.7 + rand() * 0.6)),
      postedBy: 'contractor', receipt: true, status: 'Verified',
    })
  }
  // Subcontracts and site overheads close the gap so the ledger reconciles to actual cost.
  const target = revised * seed.progress * seed.cpi
  const gap = target - entries.reduce((s, e) => s + e.amount, 0)
  if (gap > 0) {
    const subs = seed.sector === 'residential'
      ? [['Electrical subcontract — rough-in', 'Volt Electrical Services'], ['Plumbing subcontract', 'AquaFix Plumbing'], ['Aluminium fabrication', 'Alumex Fabricators'], ['Site supervision & overheads', seed.contractor.org], ['Formwork & scaffolding subcontract', 'FormTech Lanka'], ['Termite & waterproofing treatment', 'Ceylon Pest & Proof']]
      : [['Piling subcontract', 'Deep Foundations Lanka'], ['MEP subcontract — progress claim', 'Colombo MEP Engineering'], ['Façade subcontract — progress claim', 'Glazetech Façades'], ['Post-tensioning subcontract', 'PT Systems Asia'], ['Site management & overheads', seed.contractor.org], ['Fire protection subcontract', 'FireSafe Lanka']]
    const usable = subs.slice(0, Math.max(2, Math.round(subs.length * Math.min(1, seed.progress * 1.8))))
    const weights = usable.map(() => 0.6 + rand())
    const wsum = weights.reduce((s, w) => s + w, 0)
    usable.forEach(([desc, vendor], i) => {
      const claims = 1 + Math.floor(rand() * 3)
      for (let c = 0; c < claims; c++) {
        const at = 0.15 + ((i + (c + rand()) / claims) / usable.length) * 0.82
        entries.push({
          id: `${seed.id}-L${++n}`, date: addDays(seed.start, Math.round(at * elapsed)), category: 'Subcontract',
          description: claims > 1 ? `${desc} (claim ${c + 1})` : desc!, vendor: vendor!,
          amount: Math.round((gap * weights[i]!) / wsum / claims), postedBy: 'contractor', receipt: true, status: 'Verified',
        })
      }
    })
  }
  entries.sort((a, b) => b.date.localeCompare(a.date))
  // The latest entries are awaiting review; one is queried by the client.
  entries.slice(0, 4).forEach((e) => (e.status = 'Pending review'))
  const queried = entries.find((e) => e.materialId && seed.overpriced?.[e.materialId])
  if (queried) {
    queried.status = 'Queried'
    queried.query = 'This rate is above the market average for the same month. Can you share the supplier quotation?'
  }
  return entries
}

function buildMilestones(seed: Seed): Milestone[] {
  const total = daysBetween(seed.start, seed.end)
  return MILESTONES[seed.sector].map(([name, pctShare, trigger], i) => {
    const amount = seed.contractSum * (pctShare / 100)
    const due = trigger > 1 ? addDays(seed.end, 365) : addDays(seed.start, Math.round(trigger * total))
    let status: Milestone['status'] = 'Upcoming'
    if (trigger > 1) status = 'Retention'
    else if (seed.progress >= trigger + 0.04 || (trigger === 0 && seed.progress > 0)) status = 'Paid'
    else if (seed.progress >= trigger - 0.02 && seed.progress > 0) status = 'Invoiced'
    return {
      id: `m${i + 1}`, name, pct: pctShare, amount, due, status,
      paidOn: status === 'Paid' ? addDays(due, 9) : undefined,
      certifiedBy: status === 'Paid' || status === 'Invoiced' ? seed.architect.name : undefined,
    }
  })
}

function buildLogs(seed: Seed, phases: Phase[], rand: () => number): DailyLog[] {
  if (seed.progress <= 0.02) return []
  const logs: DailyLog[] = []
  const active = phases.filter((p) => p.progress > 0)
  const recent = active.slice(-3)
  const weathers: DailyLog['weather'][] = ['Sunny', 'Sunny', 'Cloudy', 'Light rain', 'Heavy rain']
  let day = 0
  let progressCursor = seed.progress * 100
  const count = seed.sector === 'residential' ? 9 : 11
  for (let i = 0; i < count; i++) {
    const phase = recent[recent.length - 1 - (i % recent.length)]!
    const tpls = templatesFor(phase.name)
    const tpl = tpls[i % tpls.length]!
    const date = addDays(TODAY_ISO, -day)
    day += 2 + Math.floor(rand() * 4)
    const weather = weathers[Math.floor(rand() * weathers.length)]!
    const kindHue: Record<string, number> = { rebar: 18, slab: 210, wall: 28, roof: 0, site: 95, finish: 175 }
    logs.push({
      id: `${seed.id}-D${i + 1}`,
      date,
      author: seed.contractor.name,
      role: 'contractor',
      weather,
      workers: Math.round((seed.sector === 'residential' ? 12 : 140) * (0.6 + rand() * 0.7) * (weather === 'Heavy rain' ? 0.5 : 1)),
      title: tpl.title,
      notes: tpl.notes + (weather === 'Heavy rain' ? ' Work stopped for 3 hours due to heavy rain; materials covered with tarpaulin.' : ''),
      phaseId: phase.id,
      progressAfter: Math.round(progressCursor * 10) / 10,
      photos: Array.from({ length: 1 + Math.floor(rand() * 3) }, (_, k) => ({
        caption: ['North elevation', 'Detail', 'Wide shot', 'Close-up'][k % 4]!,
        hue: kindHue[tpl.kind]! + Math.floor(rand() * 20),
        kind: tpl.kind,
      })),
      materials: [
        { materialId: seed.sector === 'residential' ? 'cement-opc' : 'rmc-g25', qty: seed.sector === 'residential' ? 20 + Math.floor(rand() * 60) : 30 + Math.floor(rand() * 120) },
      ],
      acknowledgedBy: i < 2 ? [] : ['client', 'architect'],
    })
    progressCursor -= 0.4 + rand() * 1.2
  }
  return logs
}

function seedProject(seed: Seed): Project {
  const rand = mulberry32(hashString(seed.id))
  const phases = buildPhases(seed, rand)
  // The most recently finished phase still awaits the architect's certificate.
  const lastDone = phases.filter((ph) => ph.progress === 100).pop()
  if (lastDone && seed.progress < 0.9) lastDone.verifiedBy = undefined
  const boq = buildBoq(seed, rand)
  const ledger = buildLedger(seed, boq, phases, rand)
  const milestones = buildMilestones(seed)
  const logs = buildLogs(seed, phases, rand)
  const changes = seed.changes.map((c, i) => ({ ...c, id: `${seed.id}-CO${i + 1}` }))
  const plans: PlanSheet[] = seed.plans.map((p, i) => {
    const revs = 'ABCDEFG'.indexOf(p.rev) + 1
    return {
      ...p,
      id: `${seed.id}-P${i + 1}`,
      revisions: Array.from({ length: revs }, (_, r) => ({
        rev: 'ABCDEFG'[r]!,
        date: addDays(p.date, -(revs - 1 - r) * 21),
        note: r === 0 ? 'Issued for review' : r === revs - 1 ? p.notes : ['Client comments incorporated', 'Coordinated with structural', 'Setback revised for UDA approval'][r % 3]!,
      })),
      comments: p.status === 'Awaiting client'
        ? [
            { id: `${seed.id}-P${i + 1}-c1`, x: 38, y: 34, text: 'Please confirm the finished floor level here. It affects the step at the entrance.', author: seed.contractor.name, role: 'contractor' as Role, date: addDays(TODAY_ISO, -2), resolved: false },
            { id: `${seed.id}-P${i + 1}-c2`, x: 68, y: 62, text: 'Revised to suit the structural grid. No cost impact.', author: seed.architect.name, role: 'architect' as Role, date: addDays(TODAY_ISO, -1), resolved: false },
          ]
        : [],
    }
  })
  const messages = seed.messages.map((m, i) => ({ ...m, id: `${seed.id}-M${i + 1}` }))

  const activity: Activity[] = []
  let a = 0
  const push = (date: string, role: Role, actor: string, text: string, kind: Activity['kind']) =>
    activity.push({ id: `${seed.id}-A${++a}`, date, role, actor, text, kind })
  logs.slice(0, 5).forEach((l) => push(l.date, 'contractor', l.author, `posted a daily log: “${l.title}”`, 'log'))
  changes.forEach((c) => {
    push(c.date, c.raisedBy, c.raisedBy === 'architect' ? seed.architect.name : seed.contractor.name, `raised ${c.code}: ${c.title}`, 'change')
    if (c.decidedOn) push(c.decidedOn, 'client', seed.client.name, `${c.status === 'Approved' ? 'approved' : 'rejected'} ${c.code}`, 'change')
  })
  plans.forEach((p) => push(p.date, 'architect', seed.architect.name, `issued ${p.code} ${p.title} (Rev ${p.rev})`, 'plan'))
  milestones.filter((m) => m.status === 'Paid' && m.paidOn! <= TODAY_ISO).forEach((m) => push(m.paidOn!, 'client', seed.client.name, `released payment: ${m.name}`, 'payment'))
  milestones.filter((m) => m.status === 'Invoiced').forEach((m) => push(addDays(TODAY_ISO, -3), 'contractor', seed.contractor.name, `invoiced milestone: ${m.name}`, 'payment'))
  ledger.filter((l) => l.status === 'Queried').forEach((l) => push(addDays(TODAY_ISO, -1), 'client', seed.client.name, `queried a ledger entry: ${l.description}`, 'ledger'))
  messages.forEach((m) => push(m.date, m.role, m.author, 'sent a message', 'message'))
  activity.sort((x, y) => y.date.localeCompare(x.date))

  return {
    id: seed.id, sector: seed.sector, name: seed.name, type: seed.type, typeId: seed.typeId, location: seed.location,
    district: seed.district, area: seed.area, floors: seed.floors, start: seed.start, end: seed.end,
    contractSum: seed.contractSum, progress: Math.round(seed.progress * 100), health: seed.health,
    stage: phases.find((p) => p.progress > 0 && p.progress < 100)?.name ?? (seed.progress === 0 ? 'Design & approvals' : phases[0]!.name),
    client: seed.client, architect: seed.architect, contractor: seed.contractor, cover: seed.cover,
    phases, logs, plans, boq, changes, milestones, ledger, messages, activity,
    curve: buildCurve(seed),
  }
}

const RES_PLANS = (date: string, pending: number): Seed['plans'] => {
  const all: Seed['plans'] = [
    { code: 'A-101', title: 'Ground Floor Plan', discipline: 'Architectural', rev: 'C', date: addDays(date, 0), status: 'Approved', drawing: 'res-gf', notes: 'Pantry opened to dining; store moved under stair' },
    { code: 'A-102', title: 'Upper Floor Plan', discipline: 'Architectural', rev: 'B', date: addDays(date, 6), status: 'Approved', drawing: 'res-ff', notes: 'Balcony extended by 600mm' },
    { code: 'A-201', title: 'Front & Side Elevations', discipline: 'Architectural', rev: 'B', date: addDays(date, 10), status: 'Approved', drawing: 'res-elev', notes: 'Window heads aligned; parapet height 900mm' },
    { code: 'S-101', title: 'Foundation & Column Layout', discipline: 'Structural', rev: 'A', date: addDays(date, -14), status: 'Approved', drawing: 'res-found', notes: 'Isolated pad footings, 1.2m depth' },
    { code: 'A-103', title: 'Roof Plan', discipline: 'Architectural', rev: 'D', date: addDays(date, 40), status: 'Approved', drawing: 'res-roof', notes: 'Roof pitch changed to 25° for better monsoon drainage' },
    { code: 'E-101', title: 'Electrical Layout — Ground Floor', discipline: 'MEP', rev: 'A', date: addDays(date, 48), status: 'Approved', drawing: 'res-elec', notes: 'Added 15A points for inverter AC in all bedrooms' },
  ]
  return all.map((p, i) => (i >= all.length - pending ? { ...p, status: 'Awaiting client' as const, date: addDays(TODAY_ISO, -(all.length - i) * 2) } : p))
}

const COM_PLANS = (date: string, pending: number, warehouse = false): Seed['plans'] => {
  const all: Seed['plans'] = warehouse
    ? [
        { code: 'A-001', title: 'Site Plan & Yard Layout', discipline: 'Architectural', rev: 'B', date, status: 'Approved', drawing: 'com-site', notes: 'Truck turning radius increased to 15m' },
        { code: 'A-101', title: 'Warehouse Floor Plan', discipline: 'Architectural', rev: 'C', date: addDays(date, 8), status: 'Approved', drawing: 'wh-plan', notes: 'Racking grid at 3.2m aisles; 12 dock doors' },
        { code: 'A-201', title: 'Elevations', discipline: 'Architectural', rev: 'A', date: addDays(date, 12), status: 'Approved', drawing: 'wh-elev', notes: 'Eaves height 12m clear' },
        { code: 'S-201', title: 'Portal Frame Details', discipline: 'Structural', rev: 'B', date: addDays(date, 20), status: 'Approved', drawing: 'wh-elev', notes: 'Frame spacing 7.5m' },
      ]
    : [
        { code: 'A-001', title: 'Site Plan', discipline: 'Architectural', rev: 'C', date, status: 'Approved', drawing: 'com-site', notes: 'UDA setbacks confirmed; 4m fire access road' },
        { code: 'A-110', title: 'Typical Floor Plan', discipline: 'Architectural', rev: 'D', date: addDays(date, 9), status: 'Approved', drawing: 'com-typ', notes: 'Core relocated east for larger lettable area' },
        { code: 'A-201', title: 'North Elevation — Façade', discipline: 'Architectural', rev: 'C', date: addDays(date, 14), status: 'Approved', drawing: 'com-elev', notes: 'Low-E double glazing; fins at 1.5m centres' },
        { code: 'M-110', title: 'HVAC Layout — Typical Floor', discipline: 'MEP', rev: 'B', date: addDays(date, 30), status: 'Approved', drawing: 'com-typ', notes: 'FCU zoning revised to suit tenant demising' },
        { code: 'A-120', title: 'Lobby & Podium Fit-out', discipline: 'Architectural', rev: 'A', date: addDays(date, 44), status: 'Approved', drawing: 'com-typ', notes: 'Double-height lobby with feature wall' },
      ]
  return all.map((p, i) => (i >= all.length - pending ? { ...p, status: 'Awaiting client' as const, date: addDays(TODAY_ISO, -(all.length - i) * 3) } : p))
}

const SEEDS: Seed[] = [
  {
    id: 'perera-residence', sector: 'residential', name: 'Perera Residence', type: 'Two-storey family house', typeId: 'house',
    location: 'Battaramulla', district: 'Colombo', area: 2850, floors: 2, start: '2026-02-02', end: '2027-01-29',
    contractSum: 41_800_000, progress: 0.64, health: 'On track', cpi: 1.018,
    client: { name: 'Ruwan & Dilani Perera', org: 'Homeowners', role: 'client', phone: '+94 77 341 2290' },
    architect: { name: 'Archt. Nadeesha Fernando', org: 'Fernando Atelier', role: 'architect', phone: '+94 71 802 4416', credential: 'SLIA Chartered Architect' },
    contractor: { name: 'Chaminda Rathnayake', org: 'Ceylon BuildWorks (Pvt) Ltd', role: 'contractor', phone: '+94 76 455 1180', credential: 'CIDA Grade C4' },
    cover: ['#0f766e', '#14b8a6'], overpriced: { 'sand-river': 0.14 },
    changes: [
      { code: 'CO-001', title: 'Upgrade master bathroom fittings', reason: 'Client request', description: 'Replace standard sanitaryware with an imported wall-hung WC, rain shower and vanity in the master bathroom.', raisedBy: 'contractor', date: '2026-05-14', amount: 685_000, days: 0, status: 'Approved', decidedOn: '2026-05-17', lines: [{ item: 'Wall-hung WC with concealed cistern', amount: 248_000 }, { item: 'Thermostatic rain shower set', amount: 192_000 }, { item: 'Vanity with solid-surface top', amount: 185_000 }, { item: 'Additional plumbing labour', amount: 60_000 }] },
      { code: 'CO-002', title: 'Omit pantry granite (client supplied)', reason: 'Value engineering', description: 'Client sources granite directly from a family supplier. Contractor installs only.', raisedBy: 'contractor', date: '2026-06-02', amount: -210_000, days: 0, status: 'Approved', decidedOn: '2026-06-03', lines: [{ item: 'Omit granite supply', amount: -265_000 }, { item: 'Installation only', amount: 55_000 }] },
      { code: 'CO-003', title: 'Retaining wall at rear boundary', reason: 'Site condition', description: 'Soil slip after the May monsoon exposed the rear embankment. A 22m rubble retaining wall with weep holes is required to protect the foundation.', raisedBy: 'architect', date: '2026-10-09', amount: 1_240_000, days: 12, status: 'Pending client', lines: [{ item: 'Excavation & disposal', amount: 165_000 }, { item: 'Rubble masonry 1:5 (38 m³)', amount: 798_000 }, { item: 'Weep holes, filter media & coping', amount: 142_000 }, { item: 'Labour & supervision', amount: 135_000 }] },
      { code: 'CO-004', title: 'Solar PV-ready roof provision', reason: 'Design change', description: 'Add conduit runs, mounting rails and DB space for a future 5kW rooftop solar system (CEB net-plus).', raisedBy: 'architect', date: '2026-10-13', amount: 318_000, days: 3, status: 'Pending client', lines: [{ item: 'Mounting rails & fixings', amount: 164_000 }, { item: 'Conduits & DC isolator space', amount: 96_000 }, { item: 'Labour', amount: 58_000 }] },
    ],
    plans: RES_PLANS('2025-12-10', 2),
    messages: [
      { author: 'Ruwan & Dilani Perera', role: 'client', date: '2026-10-12', text: 'Thank you for the slab photos. Can we visit on Saturday morning to see the roof work?' },
      { author: 'Chaminda Rathnayake', role: 'contractor', date: '2026-10-12', text: 'Of course. Saturday 9am works. Please wear closed shoes; we will have helmets ready.' },
      { author: 'Archt. Nadeesha Fernando', role: 'architect', date: '2026-10-14', text: 'I have uploaded the revised roof plan (Rev D) and the electrical layout. Please review and approve before Friday so the roofing sheets can be ordered at this week\'s price.' },
    ],
  },
  {
    id: 'hillview-villa', sector: 'residential', name: 'Hill View Villa', type: 'Three-level hillside villa', typeId: 'villa',
    location: 'Ampitiya, Kandy', district: 'Kandy', area: 3400, floors: 3, start: '2026-07-01', end: '2027-08-30',
    contractSum: 66_200_000, progress: 0.17, health: 'At risk', cpi: 1.06,
    client: { name: 'Dr. Ashan Wickramasinghe', org: 'Homeowner', role: 'client', phone: '+94 77 590 7712' },
    architect: { name: 'Archt. Kavinda Jayasuriya', org: 'KJ Architects', role: 'architect', phone: '+94 81 223 4567', credential: 'SLIA Chartered Architect' },
    contractor: { name: 'Mahesh Bandara', org: 'Hillcrest Constructions', role: 'contractor', phone: '+94 71 330 9921', credential: 'CIDA Grade C5' },
    cover: ['#065f46', '#34d399'], overpriced: { 'steel-t16': 0.09 },
    changes: [
      { code: 'CO-001', title: 'Additional soil nailing on slope', reason: 'Site condition', description: 'NBRO landslide risk assessment requires soil nailing on the upper cut slope before excavation continues.', raisedBy: 'architect', date: '2026-08-20', amount: 2_850_000, days: 21, status: 'Approved', decidedOn: '2026-08-24', lines: [{ item: 'Soil nails, 6m (48 nos)', amount: 1_920_000 }, { item: 'Shotcrete facing', amount: 640_000 }, { item: 'Drainage & monitoring', amount: 290_000 }] },
      { code: 'CO-002', title: 'Infinity-edge pool upgrade', reason: 'Client request', description: 'Convert the skimmer pool to an infinity edge facing the valley, with a balancing tank.', raisedBy: 'contractor', date: '2026-10-11', amount: 1_960_000, days: 14, status: 'Pending client', lines: [{ item: 'Structural modifications', amount: 840_000 }, { item: 'Balancing tank & pumps', amount: 720_000 }, { item: 'Glass mosaic finish', amount: 400_000 }] },
    ],
    plans: RES_PLANS('2026-05-12', 1),
    messages: [
      { author: 'Mahesh Bandara', role: 'contractor', date: '2026-10-10', text: 'We lost 6 working days to rain this month. Revised look-ahead schedule is attached to the daily log.' },
      { author: 'Dr. Ashan Wickramasinghe', role: 'client', date: '2026-10-11', text: 'Understood. Please keep the slope drainage as the top priority before the north-east monsoon.' },
    ],
  },
  {
    id: 'galle-fort-home', sector: 'residential', name: 'Fort Heritage Home', type: 'Heritage renovation', typeId: 'house',
    location: 'Galle Fort', district: 'Galle', area: 1950, floors: 2, start: '2025-12-01', end: '2026-11-20',
    contractSum: 31_400_000, progress: 0.91, health: 'On track', cpi: 0.992,
    client: { name: 'Mrs. Fathima Rizvi', org: 'Homeowner', role: 'client', phone: '+94 77 118 6623' },
    architect: { name: 'Archt. Ishara Gunawardena', org: 'Studio Ishara', role: 'architect', phone: '+94 91 224 1188', credential: 'SLIA, heritage specialist' },
    contractor: { name: 'Nuwan de Silva', org: 'Southern Restoration Co.', role: 'contractor', phone: '+94 77 909 1234', credential: 'CIDA Grade C6' },
    cover: ['#115e59', '#5eead4'],
    changes: [
      { code: 'CO-001', title: 'Restore original Dutch-period doors', reason: 'Regulatory', description: 'Galle Heritage Foundation requires restoration rather than replacement of the four street-facing doors.', raisedBy: 'architect', date: '2026-03-08', amount: 420_000, days: 10, status: 'Approved', decidedOn: '2026-03-09', lines: [{ item: 'Timber restoration (4 doors)', amount: 340_000 }, { item: 'Period ironmongery', amount: 80_000 }] },
    ],
    plans: RES_PLANS('2025-10-02', 0),
    messages: [{ author: 'Nuwan de Silva', role: 'contractor', date: '2026-10-13', text: 'Snag list walkthrough scheduled for 24 Oct. Final cleaning team booked for the following week.' }],
  },
  {
    id: 'nallur-home', sector: 'residential', name: 'Nallur Family Home', type: 'Single-storey courtyard house', typeId: 'house',
    location: 'Nallur, Jaffna', district: 'Jaffna', area: 2200, floors: 1, start: '2026-11-15', end: '2027-09-30',
    contractSum: 33_900_000, progress: 0, health: 'Pre-construction', cpi: 1,
    client: { name: 'S. Tharshan', org: 'Homeowner', role: 'client', phone: '+94 77 640 3321' },
    architect: { name: 'Archt. Senthil Kumaran', org: 'Northern Design Collective', role: 'architect', phone: '+94 21 222 7788', credential: 'SLIA Chartered Architect' },
    contractor: { name: 'R. Sivakumar', org: 'Peninsula Builders', role: 'contractor', phone: '+94 76 221 0099', credential: 'CIDA Grade C5' },
    cover: ['#134e4a', '#2dd4bf'],
    changes: [],
    plans: RES_PLANS('2026-09-01', 3),
    messages: [{ author: 'Archt. Senthil Kumaran', role: 'architect', date: '2026-10-14', text: 'Final drawings for council approval are uploaded. Once you approve, we submit to the Pradeshiya Sabha on Monday.' }],
  },
  {
    id: 'lotus-grove', sector: 'commercial', name: 'Lotus Grove Tower', type: 'Grade-A office tower', typeId: 'office',
    location: 'Kollupitiya, Colombo 03', district: 'Colombo', area: 86000, floors: 12, start: '2025-06-01', end: '2027-09-30',
    contractSum: 1_740_000_000, progress: 0.40, health: 'On track', cpi: 1.021,
    client: { name: 'Lotus Grove Holdings PLC', org: 'Developer', role: 'client', phone: '+94 11 230 4400' },
    architect: { name: 'Archt. Dilhan Senanayake', org: 'Meridian Architects', role: 'architect', phone: '+94 11 259 8800', credential: 'SLIA, LEED AP' },
    contractor: { name: 'Eng. Priyantha Silva', org: 'MegaSpan Engineering (Pvt) Ltd', role: 'contractor', phone: '+94 11 286 1100', credential: 'CIDA Grade CS2' },
    cover: ['#1e3a8a', '#3b82f6'], overpriced: { 'rmc-g25': 0.08 },
    changes: [
      { code: 'CO-001', title: 'Upgrade to Low-E double glazing', reason: 'Design change', description: 'Façade glazing upgraded from single to Low-E double-glazed units to meet the GREENSL® Gold target.', raisedBy: 'architect', date: '2026-02-11', amount: 38_600_000, days: 0, status: 'Approved', decidedOn: '2026-02-20', lines: [{ item: 'Glazing units (9,400 sq ft)', amount: 31_200_000 }, { item: 'Frame modifications', amount: 4_900_000 }, { item: 'Design & testing', amount: 2_500_000 }] },
      { code: 'CO-002', title: 'Additional basement dewatering', reason: 'Site condition', description: 'High groundwater during the May monsoon required extra well-points and pumping for 6 weeks.', raisedBy: 'contractor', date: '2025-09-04', amount: 6_450_000, days: 9, status: 'Approved', decidedOn: '2025-09-10', lines: [{ item: 'Well-point system', amount: 3_800_000 }, { item: 'Pumping & fuel (6 wks)', amount: 2_650_000 }] },
      { code: 'CO-003', title: 'Rooftop helipad structural provision', reason: 'Client request', description: 'Strengthen the roof slab and add a perimeter safety net for a future helipad.', raisedBy: 'contractor', date: '2026-10-08', amount: 24_800_000, days: 18, status: 'Pending client', lines: [{ item: 'Additional reinforcement & PT', amount: 14_600_000 }, { item: 'Perimeter safety net & lighting', amount: 6_200_000 }, { item: 'CAASL consultancy', amount: 4_000_000 }] },
      { code: 'CO-004', title: 'Omit podium water feature', reason: 'Value engineering', description: 'Replace the podium water feature with a landscaped garden to reduce maintenance cost.', raisedBy: 'architect', date: '2026-10-02', amount: -5_200_000, days: 0, status: 'Pending client', lines: [{ item: 'Omit water feature', amount: -7_900_000 }, { item: 'Landscaped garden', amount: 2_700_000 }] },
    ],
    plans: COM_PLANS('2025-03-10', 1),
    messages: [
      { author: 'Eng. Priyantha Silva', role: 'contractor', date: '2026-10-13', text: 'Level 7 slab cast yesterday. We are 4 days ahead of the frame programme. Tower crane inspection certificate renewed.' },
      { author: 'Lotus Grove Holdings PLC', role: 'client', date: '2026-10-14', text: 'Good progress. The board would like a cost-to-complete forecast before the November meeting.' },
      { author: 'Archt. Dilhan Senanayake', role: 'architect', date: '2026-10-15', text: 'The ready-mix rate on recent invoices is about 8% above the market average. Please justify it or renegotiate before the next pour.' },
    ],
  },
  {
    id: 'wayamba-plaza', sector: 'commercial', name: 'Wayamba Retail Plaza', type: 'Three-storey shopping plaza', typeId: 'retail',
    location: 'Kurunegala Town', district: 'Kurunegala', area: 24000, floors: 3, start: '2025-11-01', end: '2026-12-31',
    contractSum: 418_000_000, progress: 0.765, health: 'Delayed', cpi: 1.048,
    client: { name: 'Wayamba Commercial Properties', org: 'Developer', role: 'client', phone: '+94 37 222 5566' },
    architect: { name: 'Archt. Ruwini Herath', org: 'Herath & Partners', role: 'architect', phone: '+94 37 223 9090', credential: 'SLIA Chartered Architect' },
    contractor: { name: 'Eng. Lasantha Peiris', org: 'Ruhuna Infra (Pvt) Ltd', role: 'contractor', phone: '+94 77 712 3344', credential: 'CIDA Grade C1' },
    cover: ['#312e81', '#6366f1'], overpriced: { 'wire-25': 0.11 },
    changes: [
      { code: 'CO-001', title: 'Additional escalator pair', reason: 'Client request', description: 'Add a second escalator pair at the east atrium to improve circulation to Level 2.', raisedBy: 'contractor', date: '2026-04-02', amount: 21_400_000, days: 30, status: 'Approved', decidedOn: '2026-04-15', lines: [{ item: 'Escalator units (2)', amount: 16_800_000 }, { item: 'Structural opening & pit', amount: 3_100_000 }, { item: 'Installation', amount: 1_500_000 }] },
      { code: 'CO-002', title: 'Fire code: extra hydrant ring', reason: 'Regulatory', description: 'Fire department review requires a second hydrant ring main around the car park.', raisedBy: 'architect', date: '2026-09-28', amount: 4_850_000, days: 7, status: 'Pending client', lines: [{ item: 'DI pipework & hydrants', amount: 3_600_000 }, { item: 'Excavation & reinstatement', amount: 1_250_000 }] },
    ],
    plans: COM_PLANS('2025-08-20', 0),
    messages: [{ author: 'Wayamba Commercial Properties', role: 'client', date: '2026-10-12', text: 'Anchor tenant handover is fixed for 1 December. What is the recovery plan for the 3-week delay?' }],
  },
  {
    id: 'jaela-logistics', sector: 'commercial', name: 'Ja-Ela Logistics Hub', type: 'Warehouse & distribution centre', typeId: 'warehouse',
    location: 'Ja-Ela, Negombo Road', district: 'Gampaha', area: 48000, floors: 1, start: '2026-08-15', end: '2027-06-30',
    contractSum: 548_000_000, progress: 0.115, health: 'On track', cpi: 0.985,
    client: { name: 'BlueLine Logistics Lanka', org: 'Owner-operator', role: 'client', phone: '+94 11 223 7788' },
    architect: { name: 'Archt. Thilina Abeysekara', org: 'Axis Industrial Design', role: 'architect', phone: '+94 11 245 6677', credential: 'SLIA Chartered Architect' },
    contractor: { name: 'Eng. Roshan Fonseka', org: 'SteelFrame Lanka (Pvt) Ltd', role: 'contractor', phone: '+94 77 456 7788', credential: 'CIDA Grade C1' },
    cover: ['#1e40af', '#60a5fa'],
    changes: [
      { code: 'CO-001', title: 'Additional 4 dock levellers', reason: 'Client request', description: 'Increase dock doors from 12 to 16 to match the revised fleet plan.', raisedBy: 'contractor', date: '2026-10-06', amount: 9_600_000, days: 5, status: 'Pending client', lines: [{ item: 'Dock levellers & shelters (4)', amount: 7_200_000 }, { item: 'Structural & electrical', amount: 2_400_000 }] },
    ],
    plans: COM_PLANS('2026-05-02', 1, true),
    messages: [{ author: 'Eng. Roshan Fonseka', role: 'contractor', date: '2026-10-14', text: 'Steel portal frames fabricated and 40% delivered. Erection starts next Monday, weather permitting.' }],
  },
]

export const SEED_PROJECTS: Project[] = SEEDS.map(seedProject)
