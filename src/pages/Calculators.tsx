import clsx from 'clsx'
import { BrickWall, Grid3x3, Layers, Paintbrush, PaintRoller, Ruler, SquareStack } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { Card, Field, inputCls } from '../components/ui'
import { MATERIAL_BY_ID } from '../data/materials'
import { num, rs } from '../lib/format'
import { usePrices } from '../store/store'

// Standard conversion constants used by Sri Lankan QS practice.
const BAG_M3 = 0.0347 // 50 kg cement bag
const CUBE_M3 = 2.8317 // 1 cube = 100 cu ft
const SQFT_M2 = 0.0929
const FT_M = 0.3048

type Result = { label: string; qty: number; unit: string; materialId?: string; digits?: number }

type CalcId = 'concrete' | 'brick' | 'block' | 'plaster' | 'tiles' | 'paint' | 'rebar'

const CALCS: { id: CalcId; label: string; icon: typeof Layers; blurb: string }[] = [
  { id: 'concrete', label: 'Concrete', icon: Layers, blurb: 'Slabs, beams, footings: cement, sand and metal for a nominal mix' },
  { id: 'brick', label: 'Brick wall', icon: BrickWall, blurb: 'Wire-cut clay bricks with 1:5 cement mortar' },
  { id: 'block', label: 'Block wall', icon: SquareStack, blurb: '4" or 6" cement blocks with mortar' },
  { id: 'plaster', label: 'Plastering', icon: PaintRoller, blurb: 'Cement : sand plaster at a chosen thickness' },
  { id: 'tiles', label: 'Tiling', icon: Grid3x3, blurb: 'Floor or wall tiles with cutting wastage' },
  { id: 'paint', label: 'Painting', icon: Paintbrush, blurb: 'Emulsion or weather paint by coverage' },
  { id: 'rebar', label: 'Steel rebar', icon: Ruler, blurb: 'Bar weight from diameter and length (d²/162)' },
]

function Num({ label, value, onChange, step = 1, hint }: { label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string }) {
  return <Field label={label} hint={hint}><input type="number" step={step} min={0} className={clsx(inputCls, 'num')} value={value} onChange={(e) => onChange(Math.max(0, +e.target.value))} /></Field>
}

function Select<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return <Field label={label}><select className={inputCls} value={String(value)} onChange={(e) => onChange((typeof value === 'number' ? +e.target.value : e.target.value) as T)}>{options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}</select></Field>
}

function mortar(dryM3: number, cementParts: number, sandParts: number): Result[] {
  const s = cementParts + sandParts
  return [
    { label: 'Cement', qty: (dryM3 * cementParts) / s / BAG_M3, unit: 'bags', materialId: 'cement-opc', digits: 1 },
    { label: 'Sand', qty: (dryM3 * sandParts) / s / CUBE_M3, unit: 'cubes', materialId: 'sand-msand', digits: 2 },
  ]
}

export default function Calculators() {
  const { localPrice, district } = usePrices()
  const [calc, setCalc] = useState<CalcId>('concrete')
  const [s, setS] = useState({
    cL: 30, cW: 20, cT: 5, mix: '1:2:4', walls: 400, wallType: 'half', blockSize: 'block-6', pArea: 800, pThk: 12, pMix: 5,
    tArea: 450, tSize: 2, tWaste: 7, tKind: 'tile-floor', paintArea: 2400, coats: 2, paintKind: 'paint-int', rDia: 12, rLen: 12, rCount: 40,
  })
  const set = <K extends keyof typeof s>(k: K) => (v: (typeof s)[K]) => setS((x) => ({ ...x, [k]: v }))

  let inputs: React.ReactNode = null
  let results: Result[] = []
  let note = ''

  if (calc === 'concrete') {
    const vol = s.cL * s.cW * (s.cT / 12) * FT_M ** 3
    const [a, b, c] = s.mix.split(':').map(Number) as [number, number, number]
    const dry = vol * 1.54
    const sum = a + b + c
    inputs = <>
      <Num label="Length (ft)" value={s.cL} onChange={set('cL')} />
      <Num label="Width (ft)" value={s.cW} onChange={set('cW')} />
      <Num label="Thickness (inches)" value={s.cT} onChange={set('cT')} step={0.5} />
      <Select label="Mix ratio" value={s.mix} onChange={set('mix')} options={[['1:1.5:3', '1:1.5:3 (Grade 25: columns, beams)'], ['1:2:4', '1:2:4 (Grade 20: slabs, footings)'], ['1:3:6', '1:3:6 (Grade 15: blinding)']]} />
    </>
    results = [
      { label: 'Wet concrete volume', qty: vol, unit: 'm³', digits: 2 },
      { label: 'Cement', qty: (dry * a) / sum / BAG_M3, unit: 'bags', materialId: 'cement-opc', digits: 1 },
      { label: 'Sand', qty: (dry * b) / sum / CUBE_M3, unit: 'cubes', materialId: 'sand-river', digits: 2 },
      { label: 'Metal ¾"', qty: (dry * c) / sum / CUBE_M3, unit: 'cubes', materialId: 'metal-20', digits: 2 },
    ]
    note = 'Dry volume = wet volume × 1.54 to allow for voids and bulking. 1 bag of cement = 0.0347 m³; 1 cube = 100 cu ft.'
  }
  if (calc === 'brick') {
    const m2 = s.walls * SQFT_M2
    const perM2 = s.wallType === 'half' ? 50 : 100
    const wet = m2 * (s.wallType === 'half' ? 0.022 : 0.05)
    inputs = <>
      <Num label="Wall area (sq ft)" value={s.walls} onChange={set('walls')} hint="Length × height, minus doors and windows" />
      <Select label="Wall thickness" value={s.wallType} onChange={set('wallType')} options={[['half', '4½" (half brick)'], ['full', '9" (one brick)']]} />
    </>
    results = [{ label: 'Bricks (incl. 5% breakage)', qty: m2 * perM2 * 1.05, unit: 'nos', materialId: 'brick-clay' }, ...mortar(wet * 1.33, 1, 5)]
    note = 'Wire-cut brick 215×102×65 mm with 10 mm joints: about 50 bricks per m² of half-brick wall. Mortar 1:5.'
  }
  if (calc === 'block') {
    const m2 = s.walls * SQFT_M2
    inputs = <>
      <Num label="Wall area (sq ft)" value={s.walls} onChange={set('walls')} />
      <Select label="Block size" value={s.blockSize} onChange={set('blockSize')} options={[['block-4', '4" block (400×100×200)'], ['block-6', '6" block (400×150×200)']]} />
    </>
    results = [{ label: 'Blocks (incl. 5% breakage)', qty: m2 * 11.6 * 1.05, unit: 'nos', materialId: s.blockSize }, ...mortar(m2 * (s.blockSize === 'block-6' ? 0.014 : 0.01) * 1.33, 1, 6)]
    note = 'About 11.6 blocks per m² with 10 mm joints. Mortar 1:6.'
  }
  if (calc === 'plaster') {
    const wet = s.pArea * SQFT_M2 * (s.pThk / 1000)
    inputs = <>
      <Num label="Plaster area (sq ft)" value={s.pArea} onChange={set('pArea')} />
      <Select label="Thickness" value={s.pThk} onChange={set('pThk')} options={[[12, '12 mm (internal)'], [15, '15 mm'], [20, '20 mm (external)']]} />
      <Select label="Mix" value={s.pMix} onChange={set('pMix')} options={[[4, '1:4'], [5, '1:5'], [6, '1:6']]} />
    </>
    results = [{ label: 'Wet plaster volume', qty: wet, unit: 'm³', digits: 3 }, ...mortar(wet * 1.27 * 1.1, 1, s.pMix)]
    note = 'Dry volume = wet × 1.27, plus 10% for uneven surfaces and wastage.'
  }
  if (calc === 'tiles') {
    const tileArea = s.tSize ** 2
    const total = s.tArea * (1 + s.tWaste / 100)
    inputs = <>
      <Num label="Area to tile (sq ft)" value={s.tArea} onChange={set('tArea')} />
      <Select label="Tile size" value={s.tSize} onChange={set('tSize')} options={[[1, '1×1 ft (300×300)'], [2, '2×2 ft (600×600)'], [4, '4×4 ft (1200×1200)']]} />
      <Select label="Tile type" value={s.tKind} onChange={set('tKind')} options={[['tile-floor', 'Porcelain floor tile'], ['tile-wall', 'Ceramic wall tile'], ['granite', 'Granite slab']]} />
      <Num label="Cutting wastage (%)" value={s.tWaste} onChange={set('tWaste')} />
    </>
    results = [
      { label: 'Tiles to buy', qty: total, unit: 'sq ft', materialId: s.tKind },
      { label: 'Number of tiles', qty: Math.ceil(total / tileArea), unit: 'nos' },
      ...mortar(s.tArea * SQFT_M2 * 0.02 * 1.27, 1, 4),
    ]
    note = 'Bedding of 20 mm in 1:4 mortar. Use 7% wastage for straight patterns and 12–15% for diagonal layouts.'
  }
  if (calc === 'paint') {
    inputs = <>
      <Num label="Wall & ceiling area (sq ft)" value={s.paintArea} onChange={set('paintArea')} hint="A room's wall area is roughly 3–3.5 × its floor area" />
      <Select label="Coats" value={s.coats} onChange={set('coats')} options={[[1, '1 coat'], [2, '2 coats'], [3, '3 coats']]} />
      <Select label="Paint" value={s.paintKind} onChange={set('paintKind')} options={[['paint-int', 'Interior emulsion'], ['paint-ext', 'Exterior weather paint']]} />
    </>
    results = [{ label: 'Paint', qty: (s.paintArea * s.coats) / (s.paintKind === 'paint-int' ? 110 : 90), unit: 'litres', materialId: s.paintKind, digits: 1 }]
    note = 'Coverage of about 110 sq ft per litre per coat for emulsion and 90 for weather paint. Add primer and sealer separately.'
  }
  if (calc === 'rebar') {
    const kg = ((s.rDia ** 2) / 162) * s.rLen * s.rCount
    const id = s.rDia >= 16 ? 'steel-t16' : s.rDia >= 12 ? 'steel-t12' : 'steel-t10'
    inputs = <>
      <Select label="Bar diameter" value={s.rDia} onChange={set('rDia')} options={[[10, 'T10'], [12, 'T12'], [16, 'T16'], [20, 'T20'], [25, 'T25']]} />
      <Num label="Length per bar (m)" value={s.rLen} onChange={set('rLen')} step={0.5} />
      <Num label="Number of bars" value={s.rCount} onChange={set('rCount')} />
    </>
    results = [
      { label: 'Steel weight', qty: kg, unit: 'kg', materialId: id, digits: 1 },
      { label: 'Binding wire (~1%)', qty: kg * 0.01, unit: 'kg', materialId: 'binding-wire', digits: 1 },
      { label: 'Standard 12 m bars', qty: Math.ceil((s.rLen * s.rCount) / 12), unit: 'bars' },
    ]
    note = 'Unit weight (kg/m) = d² ÷ 162 with d in mm. T20 and T25 are priced at the T16 rate.'
  }

  const priced = results.filter((r) => r.materialId)
  const total = priced.reduce((sum, r) => sum + r.qty * localPrice(r.materialId!), 0)
  const meta = CALCS.find((c) => c.id === calc)!

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Material calculators" subtitle={`Work out exactly how much to buy, priced at live ${district} rates, so you can check any quotation yourself.`} />
      <div className="flex gap-2 overflow-x-auto pb-1 scroll-thin">
        {CALCS.map((c) => (
          <button key={c.id} onClick={() => setCalc(c.id)} className={clsx('flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition cursor-pointer', calc === c.id ? 'border-accent bg-accent text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
            <c.icon size={16} />{c.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"><meta.icon size={20} /></span>
            <div><h2 className="font-display text-lg font-bold">{meta.label}</h2><p className="text-xs text-slate-500">{meta.blurb}</p></div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">{inputs}</div>
        </Card>

        <Card className="overflow-hidden">
          <div className="bg-ink p-5 text-white">
            <p className="text-xs text-slate-400">Estimated material cost · {district}</p>
            <p className="num mt-1 font-display text-3xl font-extrabold">{rs(total)}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {results.map((r) => {
              const m = r.materialId ? MATERIAL_BY_ID[r.materialId] : undefined
              return (
                <div key={r.label} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{r.label}</p>
                    {m && <p className="text-xs text-slate-500">{m.name} @ <span className="num">{rs(localPrice(m.id))}</span>/{m.unit}</p>}
                  </div>
                  <p className="num text-right text-lg font-bold">{num(r.qty, r.digits ?? 0)} <span className="text-xs font-medium text-slate-400">{r.unit}</span></p>
                  <p className="num w-28 text-right text-sm font-semibold text-slate-600">{m ? rs(r.qty * localPrice(m.id)) : '—'}</p>
                </div>
              )
            })}
          </div>
          <p className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-[11.5px] leading-relaxed text-slate-500">{note}</p>
        </Card>
      </div>
    </div>
  )
}
