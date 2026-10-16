import { MATERIAL_BY_ID, type MaterialCategory } from './materials'
import { clamp } from '../lib/random'

export type Sector = 'residential' | 'commercial'
export type Grade = 'economy' | 'standard' | 'premium' | 'luxury'

export interface BuildingType {
  id: string
  sector: Sector
  label: string
  description: string
  /** Material quantity per sq ft of gross floor area. */
  norms: Record<string, number>
  /** Lump-sum items per sq ft (LKR, standard grade, Oct 2026). */
  allowances: { label: string; perSqft: number; finish: boolean }[]
  labourFactor: number
  referenceArea: number
  roof: 'sheet' | 'zinc' | 'slab'
}

const RES_STRUCTURE = {
  'cement-opc': 0.42,
  'steel-t16': 0.6,
  'steel-t12': 2.0,
  'steel-t10': 1.2,
  'binding-wire': 0.035,
  'sand-river': 0.008,
  'sand-msand': 0.01,
  'metal-20': 0.0135,
  'metal-abc': 0.004,
}

export const BUILDING_TYPES: BuildingType[] = [
  {
    id: 'house', sector: 'residential', label: 'Single-family house',
    description: 'RC frame with brick infill, Calicut/fibre-cement roof. The typical suburban Sri Lankan home.',
    norms: { ...RES_STRUCTURE, 'brick-clay': 8, 'tile-floor': 1.05, 'tile-wall': 0.25, 'granite': 0.02, 'paint-int': 0.12, 'paint-ext': 0.05, 'pvc-4': 0.012, 'pvc-half': 0.04, 'wire-25': 0.009, 'teak': 0.012, 'alu-section': 0.06, 'glass-5': 0.08 },
    allowances: [
      { label: 'Doors, windows & ironmongery', perSqft: 620, finish: true },
      { label: 'Sanitaryware & bathroom fittings', perSqft: 420, finish: true },
      { label: 'Electrical fittings, DB & earthing', perSqft: 360, finish: false },
      { label: 'Pantry cupboards & countertops', perSqft: 280, finish: true },
      { label: 'Ceiling (gypsum/T&G)', perSqft: 210, finish: true },
      { label: 'Waterproofing & termite treatment', perSqft: 90, finish: false },
    ],
    labourFactor: 0.78, referenceArea: 1800, roof: 'sheet',
  },
  {
    id: 'villa', sector: 'residential', label: 'Luxury villa',
    description: 'Large-span living areas, pool deck, extensive glazing and premium joinery.',
    norms: { ...RES_STRUCTURE, 'steel-t16': 0.9, 'cement-opc': 0.48, 'brick-clay': 7, 'tile-floor': 1.1, 'tile-wall': 0.32, 'granite': 0.05, 'paint-int': 0.13, 'paint-ext': 0.06, 'pvc-4': 0.015, 'pvc-half': 0.05, 'wire-25': 0.012, 'teak': 0.02, 'alu-section': 0.1, 'glass-5': 0.16 },
    allowances: [
      { label: 'Doors, windows & ironmongery', perSqft: 900, finish: true },
      { label: 'Sanitaryware & bathroom fittings', perSqft: 650, finish: true },
      { label: 'Electrical, lighting & automation', perSqft: 560, finish: false },
      { label: 'Kitchen & built-in joinery', perSqft: 520, finish: true },
      { label: 'Ceiling & feature lighting', perSqft: 320, finish: true },
      { label: 'Pool, deck & landscaping', perSqft: 450, finish: true },
      { label: 'Waterproofing & termite treatment', perSqft: 110, finish: false },
    ],
    labourFactor: 0.82, referenceArea: 3500, roof: 'zinc',
  },
  {
    id: 'apartment', sector: 'residential', label: 'Low-rise apartment',
    description: '3–6 storey residential block with shared stairs, lift and car park.',
    norms: { ...RES_STRUCTURE, 'cement-opc': 0.3, 'rmc-g25': 0.016, 'steel-t16': 1.2, 'steel-t12': 2.2, 'block-6': 1.0, 'tile-floor': 1.05, 'tile-wall': 0.28, 'granite': 0.02, 'paint-int': 0.12, 'paint-ext': 0.04, 'pvc-4': 0.014, 'pvc-half': 0.045, 'wire-25': 0.01, 'teak': 0.006, 'alu-section': 0.07, 'glass-5': 0.09 },
    allowances: [
      { label: 'Doors, windows & ironmongery', perSqft: 560, finish: true },
      { label: 'Sanitaryware & bathroom fittings', perSqft: 400, finish: true },
      { label: 'Electrical, DB & common lighting', perSqft: 380, finish: false },
      { label: 'Lift & vertical transport', perSqft: 420, finish: false },
      { label: 'Fire detection & hydrants', perSqft: 160, finish: false },
      { label: 'Pantry & ceiling', perSqft: 360, finish: true },
    ],
    labourFactor: 0.62, referenceArea: 12000, roof: 'slab',
  },
  {
    id: 'office', sector: 'commercial', label: 'Grade-A office',
    description: 'Post-tensioned RC frame, curtain-wall façade, central chilled-water HVAC.',
    norms: { 'cement-opc': 0.12, 'rmc-g25': 0.034, 'steel-t16': 2.4, 'steel-t12': 2.3, 'steel-t10': 1.3, 'binding-wire': 0.05, 'sand-msand': 0.008, 'metal-abc': 0.003, 'block-6': 0.9, 'tile-floor': 0.9, 'tile-wall': 0.12, 'granite': 0.06, 'paint-int': 0.1, 'paint-ext': 0.02, 'pvc-4': 0.008, 'pvc-half': 0.02, 'wire-25': 0.016, 'alu-section': 0.22, 'glass-5': 0.38 },
    allowances: [
      { label: 'HVAC (chilled water)', perSqft: 1450, finish: false },
      { label: 'Fire protection & sprinklers', perSqft: 380, finish: false },
      { label: 'Lifts & escalators', perSqft: 650, finish: false },
      { label: 'Curtain wall & façade systems', perSqft: 1050, finish: true },
      { label: 'ELV, BMS & security', perSqft: 280, finish: false },
      { label: 'Electrical, LV panels & generator', perSqft: 720, finish: false },
      { label: 'Lobby & common-area fit-out', perSqft: 420, finish: true },
    ],
    labourFactor: 0.62, referenceArea: 40000, roof: 'slab',
  },
  {
    id: 'retail', sector: 'commercial', label: 'Retail / shopping plaza',
    description: 'Large open floor plates, shopfronts, escalators and car parking.',
    norms: { 'cement-opc': 0.18, 'rmc-g25': 0.028, 'steel-t16': 2.0, 'steel-t12': 2.1, 'steel-t10': 1.1, 'binding-wire': 0.045, 'sand-msand': 0.01, 'metal-abc': 0.006, 'block-6': 0.8, 'tile-floor': 1.0, 'tile-wall': 0.1, 'granite': 0.03, 'paint-int': 0.09, 'paint-ext': 0.03, 'pvc-4': 0.009, 'pvc-half': 0.02, 'wire-25': 0.014, 'alu-section': 0.15, 'glass-5': 0.25 },
    allowances: [
      { label: 'HVAC (VRF / package units)', perSqft: 1100, finish: false },
      { label: 'Fire protection & sprinklers', perSqft: 360, finish: false },
      { label: 'Escalators & lifts', perSqft: 480, finish: false },
      { label: 'Shopfronts & glazing', perSqft: 620, finish: true },
      { label: 'Electrical, LV panels & generator', perSqft: 640, finish: false },
      { label: 'Car park & external works', perSqft: 380, finish: false },
    ],
    labourFactor: 0.68, referenceArea: 25000, roof: 'slab',
  },
  {
    id: 'warehouse', sector: 'commercial', label: 'Warehouse / logistics',
    description: 'Pre-engineered steel portal frame, zinc-alum cladding, heavy-duty floor slab.',
    norms: { 'cement-opc': 0.08, 'rmc-g25': 0.022, 'steel-t16': 0.6, 'steel-t12': 1.2, 'steel-t10': 0.6, 'binding-wire': 0.02, 'sand-msand': 0.004, 'metal-abc': 0.012, 'block-6': 0.25, 'paint-ext': 0.02, 'pvc-4': 0.004, 'wire-25': 0.006, 'glass-5': 0.02 },
    allowances: [
      { label: 'Pre-engineered steel structure', perSqft: 2350, finish: false },
      { label: 'Roller shutters & dock levellers', perSqft: 380, finish: false },
      { label: 'Fire protection & hydrants', perSqft: 240, finish: false },
      { label: 'Electrical, high-bay lighting', perSqft: 320, finish: false },
      { label: 'Yard paving & drainage', perSqft: 420, finish: false },
    ],
    labourFactor: 0.55, referenceArea: 40000, roof: 'zinc',
  },
  {
    id: 'hotel', sector: 'commercial', label: 'Boutique hotel',
    description: 'Guest rooms with en-suites, restaurant, pool and back-of-house.',
    norms: { 'cement-opc': 0.28, 'rmc-g25': 0.02, 'steel-t16': 1.4, 'steel-t12': 2.3, 'steel-t10': 1.3, 'binding-wire': 0.045, 'sand-river': 0.006, 'sand-msand': 0.01, 'metal-20': 0.008, 'block-6': 1.0, 'tile-floor': 1.05, 'tile-wall': 0.45, 'granite': 0.06, 'paint-int': 0.14, 'paint-ext': 0.05, 'pvc-4': 0.018, 'pvc-half': 0.06, 'wire-25': 0.014, 'teak': 0.015, 'alu-section': 0.12, 'glass-5': 0.16 },
    allowances: [
      { label: 'HVAC (VRF)', perSqft: 1150, finish: false },
      { label: 'Sanitaryware & bathroom fittings', perSqft: 780, finish: true },
      { label: 'FF&E and joinery', perSqft: 1250, finish: true },
      { label: 'Fire protection', perSqft: 320, finish: false },
      { label: 'Lifts', perSqft: 380, finish: false },
      { label: 'Electrical, ELV & generator', perSqft: 720, finish: false },
      { label: 'Pool & landscaping', perSqft: 380, finish: true },
    ],
    labourFactor: 0.66, referenceArea: 20000, roof: 'slab',
  },
]

export const GRADES: { id: Grade; label: string; finishMult: number; note: string }[] = [
  { id: 'economy', label: 'Economy', finishMult: 0.72, note: 'Local ceramic tiles, basic sanitaryware, emulsion finishes' },
  { id: 'standard', label: 'Standard', finishMult: 1.0, note: 'Porcelain tiles, mid-range fittings, aluminium windows' },
  { id: 'premium', label: 'Premium', finishMult: 1.55, note: 'Large-format tiles, imported fittings, granite tops, teak joinery' },
  { id: 'luxury', label: 'Luxury', finishMult: 2.35, note: 'Natural stone, designer fittings, automation, bespoke joinery' },
]

/** Escalates the 2025-based allowance rates to Oct 2026 subcontract pricing. */
const ALLOWANCE_INDEX = 1.22

const FINISH_CATEGORIES: MaterialCategory[] = ['Finishes', 'Timber & Joinery', 'Glass & Aluminium']

export interface EstimateInput {
  typeId: string
  area: number
  floors: number
  grade: Grade
  districtFactor: number
  includeVat: boolean
  contingencyPct: number
}

export interface EstimateLine {
  materialId: string
  name: string
  category: MaterialCategory
  unit: string
  qty: number
  rate: number
  amount: number
}

export interface Estimate {
  lines: EstimateLine[]
  materials: number
  allowances: { label: string; amount: number }[]
  allowanceTotal: number
  labour: number
  labourDays: number
  prelims: number
  margin: number
  contingency: number
  vat: number
  total: number
  perSqft: number
  months: number
  byCategory: { name: string; value: number }[]
}

/** Economies of scale: smaller buildings cost more per sq ft (kitchens, baths and foundations don't shrink). */
export function scaleFactor(area: number, ref: number): number {
  return clamp(1 + 0.16 * Math.log(ref / Math.max(area, 100)), 0.84, 1.3)
}

function floorsFactor(t: BuildingType, floors: number): number {
  if (t.sector === 'residential') return 1 + Math.max(0, floors - 2) * 0.025
  return 1 + Math.max(0, floors - 4) * 0.012
}

export function estimate(input: EstimateInput, priceOf: (id: string) => number): Estimate {
  const t = BUILDING_TYPES.find((b) => b.id === input.typeId) ?? BUILDING_TYPES[0]!
  const g = GRADES.find((x) => x.id === input.grade)!
  const scale = scaleFactor(input.area, t.referenceArea) * floorsFactor(t, input.floors)
  const lines: EstimateLine[] = []

  for (const [id, perSqft] of Object.entries(t.norms)) {
    const m = MATERIAL_BY_ID[id]!
    const finish = FINISH_CATEGORIES.includes(m.category)
    // Higher grades use pricier products for the same quantity, modelled on the rate.
    const rate = priceOf(id) * input.districtFactor * (finish ? g.finishMult : 1)
    const qty = perSqft * input.area * scale
    lines.push({ materialId: id, name: m.name, category: m.category, unit: m.unit, qty, rate, amount: qty * rate })
  }
  const footprint = input.area / Math.max(1, input.floors)
  if (t.roof === 'sheet') {
    const qty = Math.ceil((footprint * 1.25) / 22)
    const rate = priceOf('roof-sheet') * input.districtFactor
    lines.push({ materialId: 'roof-sheet', name: MATERIAL_BY_ID['roof-sheet']!.name, category: 'Roofing', unit: 'sheet', qty, rate, amount: qty * rate })
  } else if (t.roof === 'zinc') {
    const qty = Math.ceil((footprint * 1.12) / 3.4)
    const rate = priceOf('roof-zinc') * input.districtFactor
    lines.push({ materialId: 'roof-zinc', name: MATERIAL_BY_ID['roof-zinc']!.name, category: 'Roofing', unit: 'lin. ft', qty, rate, amount: qty * rate })
  }
  lines.sort((a, b) => b.amount - a.amount)

  const materials = lines.reduce((s, l) => s + l.amount, 0)
  const allowances = t.allowances.map((a) => ({
    label: a.label,
    amount: a.perSqft * ALLOWANCE_INDEX * input.area * scale * input.districtFactor * (a.finish ? g.finishMult : 1),
  }))
  const allowanceTotal = allowances.reduce((s, a) => s + a.amount, 0)

  const labourIndex = (priceOf('lab-mason') * 0.45 + priceOf('lab-unskilled') * 0.4 + priceOf('lab-carpenter') * 0.15)
  const labour = materials * t.labourFactor * (labourIndex / 4300) * input.districtFactor
  const labourDays = labour / (labourIndex * input.districtFactor)

  const direct = materials + allowanceTotal + labour
  const prelims = direct * 0.06
  const margin = (direct + prelims) * 0.1
  const contingency = (direct + prelims + margin) * (input.contingencyPct / 100)
  const subtotal = direct + prelims + margin + contingency
  const vat = input.includeVat ? subtotal * 0.18 : 0
  const total = subtotal + vat

  const cat = new Map<string, number>()
  for (const l of lines) cat.set(l.category, (cat.get(l.category) ?? 0) + l.amount)
  cat.set('Fittings & services', allowanceTotal)
  cat.set('Labour', labour)
  cat.set('Prelims, margin & contingency', prelims + margin + contingency)
  if (vat) cat.set('VAT (18%)', vat)

  const months = t.sector === 'residential'
    ? Math.round(4 + Math.sqrt(input.area) / 8 + input.floors * 0.8)
    : Math.round(7 + Math.sqrt(input.area) / 28 + input.floors * 0.9)

  return {
    lines, materials, allowances, allowanceTotal, labour, labourDays, prelims, margin, contingency, vat, total,
    perSqft: total / input.area,
    months,
    byCategory: Array.from(cat, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  }
}
