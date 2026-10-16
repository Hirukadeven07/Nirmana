import { gaussian, hashString, mulberry32 } from '../lib/random'

export type MaterialCategory =
  | 'Cement & Concrete'
  | 'Steel'
  | 'Aggregates'
  | 'Masonry'
  | 'Roofing'
  | 'Finishes'
  | 'Plumbing'
  | 'Electrical'
  | 'Timber & Joinery'
  | 'Glass & Aluminium'
  | 'Labour'

export interface Material {
  id: string
  name: string
  category: MaterialCategory
  unit: string
  /** Indicative Colombo price, October 2026 (LKR). */
  base: number
  /** Annual drift used to back-cast 24 months of history. */
  drift: number
  /** Monthly volatility (std-dev of log returns). */
  vol: number
  spec: string
  supply: 'Local' | 'Imported' | 'Mixed'
  brands: string[]
  /** Known price shock: [monthIndex in history, % jump]. */
  shock?: [number, number]
}

// Indicative seed prices. Cement reflects the March 2026 increase of ~Rs 150–175/bag reported by Ada Derana.
// Other figures are calibrated so a standard house lands near Rs 13–15k/sq ft. Replace with a supplier/CIDA feed in production.
export const MATERIALS: Material[] = [
  { id: 'cement-opc', name: 'Portland Cement (OPC) 50kg', category: 'Cement & Concrete', unit: 'bag', base: 2450, drift: 0.07, vol: 0.012, spec: 'SLS 107, 42.5N', supply: 'Mixed', brands: ['INSEE Sanstha', 'Tokyo Super', 'Ultra Tech'], shock: [16, 0.068] },
  { id: 'cement-ppc', name: 'Blended Cement (PPC) 50kg', category: 'Cement & Concrete', unit: 'bag', base: 2340, drift: 0.065, vol: 0.012, spec: 'SLS 1253', supply: 'Mixed', brands: ['INSEE Mahaweli Marine', 'Tokyo Supercrete'], shock: [16, 0.07] },
  { id: 'rmc-g25', name: 'Ready-mix Concrete G25', category: 'Cement & Concrete', unit: 'm³', base: 33800, drift: 0.06, vol: 0.01, spec: 'Grade 25, 20mm agg.', supply: 'Local', brands: ['INSEE Ready-mix', 'Tokyo Ready-mix'], shock: [16, 0.04] },
  { id: 'steel-t16', name: 'Tor Steel Bar T16', category: 'Steel', unit: 'kg', base: 282, drift: 0.05, vol: 0.026, spec: 'SLS 375, Gr 500', supply: 'Mixed', brands: ['Lanwa', 'Melwa', 'Ceylon Steel'] },
  { id: 'steel-t12', name: 'Tor Steel Bar T12', category: 'Steel', unit: 'kg', base: 286, drift: 0.05, vol: 0.026, spec: 'SLS 375, Gr 500', supply: 'Mixed', brands: ['Lanwa', 'Melwa', 'Ceylon Steel'] },
  { id: 'steel-t10', name: 'Tor Steel Bar T10', category: 'Steel', unit: 'kg', base: 291, drift: 0.05, vol: 0.026, spec: 'SLS 375, Gr 500', supply: 'Mixed', brands: ['Lanwa', 'Melwa'] },
  { id: 'binding-wire', name: 'Binding Wire 18G', category: 'Steel', unit: 'kg', base: 525, drift: 0.04, vol: 0.02, spec: 'Annealed GI', supply: 'Imported', brands: ['Various'] },
  { id: 'sand-river', name: 'River Sand', category: 'Aggregates', unit: 'cube', base: 26500, drift: 0.11, vol: 0.03, spec: '100 cu ft, washed', supply: 'Local', brands: ['GSMB-licensed suppliers'] },
  { id: 'sand-msand', name: 'Manufactured Sand (M-sand)', category: 'Aggregates', unit: 'cube', base: 17800, drift: 0.05, vol: 0.018, spec: '100 cu ft, 0–4.75mm', supply: 'Local', brands: ['Quarry direct'] },
  { id: 'sand-offshore', name: 'Offshore Sand', category: 'Aggregates', unit: 'cube', base: 19500, drift: 0.04, vol: 0.015, spec: '100 cu ft, desalinated', supply: 'Local', brands: ['SLLRDC'] },
  { id: 'metal-20', name: 'Aggregate ¾" (20mm metal)', category: 'Aggregates', unit: 'cube', base: 13800, drift: 0.08, vol: 0.02, spec: '100 cu ft', supply: 'Local', brands: ['Quarry direct'] },
  { id: 'metal-abc', name: 'ABC Sub-base', category: 'Aggregates', unit: 'cube', base: 8600, drift: 0.07, vol: 0.02, spec: '100 cu ft, graded', supply: 'Local', brands: ['Quarry direct'] },
  { id: 'brick-clay', name: 'Wire-cut Clay Brick', category: 'Masonry', unit: 'nos', base: 38, drift: 0.09, vol: 0.022, spec: '215×102×65mm', supply: 'Local', brands: ['Local kilns'] },
  { id: 'block-4', name: 'Cement Block 4"', category: 'Masonry', unit: 'nos', base: 88, drift: 0.06, vol: 0.015, spec: '400×100×200mm', supply: 'Local', brands: ['Local yards'] },
  { id: 'block-6', name: 'Cement Block 6"', category: 'Masonry', unit: 'nos', base: 118, drift: 0.06, vol: 0.015, spec: '400×150×200mm', supply: 'Local', brands: ['Local yards'] },
  { id: 'roof-sheet', name: 'Fibre Cement Roofing Sheet 8ft', category: 'Roofing', unit: 'sheet', base: 3950, drift: 0.05, vol: 0.012, spec: 'Non-asbestos, 6mm', supply: 'Local', brands: ['Rhino', 'Amano'] },
  { id: 'roof-zinc', name: 'Zinc-Alum Roofing 0.47mm', category: 'Roofing', unit: 'lin. ft', base: 1160, drift: 0.06, vol: 0.022, spec: 'AZ150, colour coated', supply: 'Imported', brands: ['Amano', 'Lysaght'] },
  { id: 'tile-floor', name: 'Porcelain Floor Tile 600×600', category: 'Finishes', unit: 'sq ft', base: 480, drift: 0.05, vol: 0.012, spec: 'Glazed vitrified', supply: 'Mixed', brands: ['Rocell', 'Lanka Tiles'] },
  { id: 'tile-wall', name: 'Ceramic Wall Tile 300×600', category: 'Finishes', unit: 'sq ft', base: 390, drift: 0.05, vol: 0.012, spec: 'Glazed ceramic', supply: 'Mixed', brands: ['Rocell', 'Lanka Wall Tiles'] },
  { id: 'granite', name: 'Granite Slab 18mm', category: 'Finishes', unit: 'sq ft', base: 2150, drift: 0.04, vol: 0.015, spec: 'Polished, imported', supply: 'Imported', brands: ['Indian Black Galaxy', 'Tan Brown'] },
  { id: 'paint-int', name: 'Interior Emulsion Paint', category: 'Finishes', unit: 'litre', base: 1680, drift: 0.05, vol: 0.01, spec: 'Washable matt', supply: 'Local', brands: ['Dulux', 'Nippon', 'Multilac'] },
  { id: 'paint-ext', name: 'Exterior Weather Paint', category: 'Finishes', unit: 'litre', base: 2480, drift: 0.05, vol: 0.01, spec: 'Anti-fungal acrylic', supply: 'Local', brands: ['Dulux Weathershield', 'Nippon Weatherbond'] },
  { id: 'pvc-4', name: 'PVC Pipe 110mm Type 600', category: 'Plumbing', unit: '20ft length', base: 7850, drift: 0.05, vol: 0.012, spec: 'SLS 147', supply: 'Local', brands: ['S-Lon', 'Anton'] },
  { id: 'pvc-half', name: 'PVC Pipe 20mm Type 1000', category: 'Plumbing', unit: '20ft length', base: 990, drift: 0.05, vol: 0.012, spec: 'SLS 147, pressure', supply: 'Local', brands: ['S-Lon', 'Anton'] },
  { id: 'wire-25', name: 'Copper Wire 2.5mm² (100m)', category: 'Electrical', unit: 'coil', base: 21800, drift: 0.09, vol: 0.03, spec: 'PVC/PVC, SLS 733', supply: 'Local', brands: ['Kelani Cables', 'ACL'] },
  { id: 'teak', name: 'Teak Timber (local)', category: 'Timber & Joinery', unit: 'cu ft', base: 14800, drift: 0.06, vol: 0.012, spec: 'Seasoned, STC', supply: 'Local', brands: ['State Timber Corp.'] },
  { id: 'alu-section', name: 'Aluminium Window Section', category: 'Glass & Aluminium', unit: 'kg', base: 1880, drift: 0.04, vol: 0.022, spec: '6063-T5 powder coated', supply: 'Mixed', brands: ['Alumex', 'Tropical'] },
  { id: 'glass-5', name: 'Clear Float Glass 5mm', category: 'Glass & Aluminium', unit: 'sq ft', base: 520, drift: 0.04, vol: 0.012, spec: 'Float, clear', supply: 'Imported', brands: ['Saint-Gobain', 'AGC'] },
  { id: 'lab-mason', name: 'Skilled Mason', category: 'Labour', unit: 'day', base: 4800, drift: 0.08, vol: 0.006, spec: '8-hour day', supply: 'Local', brands: [] },
  { id: 'lab-carpenter', name: 'Skilled Carpenter', category: 'Labour', unit: 'day', base: 5000, drift: 0.08, vol: 0.006, spec: '8-hour day', supply: 'Local', brands: [] },
  { id: 'lab-unskilled', name: 'Unskilled Labourer', category: 'Labour', unit: 'day', base: 3200, drift: 0.08, vol: 0.006, spec: '8-hour day', supply: 'Local', brands: [] },
]

export const MATERIAL_BY_ID: Record<string, Material> = Object.fromEntries(MATERIALS.map((m) => [m.id, m]))

export const CATEGORIES = Array.from(new Set(MATERIALS.map((m) => m.category))) as MaterialCategory[]

/** Regional price multipliers vs Colombo, reflecting transport distance from ports/quarries. */
export const DISTRICTS: { name: string; factor: number }[] = [
  { name: 'Colombo', factor: 1.0 },
  { name: 'Gampaha', factor: 0.985 },
  { name: 'Kalutara', factor: 0.995 },
  { name: 'Kandy', factor: 1.03 },
  { name: 'Galle', factor: 1.02 },
  { name: 'Matara', factor: 1.03 },
  { name: 'Kurunegala', factor: 0.99 },
  { name: 'Anuradhapura', factor: 1.045 },
  { name: 'Ratnapura', factor: 1.025 },
  { name: 'Nuwara Eliya', factor: 1.095 },
  { name: 'Batticaloa', factor: 1.07 },
  { name: 'Trincomalee', factor: 1.06 },
  { name: 'Jaffna', factor: 1.085 },
]

export const districtFactor = (d: string) => DISTRICTS.find((x) => x.name === d)?.factor ?? 1

// 24 monthly points, Nov 2024 → Oct 2026 (index 23 = current month).
export const HISTORY_MONTHS: string[] = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(2024, 10 + i, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
})

const historyCache = new Map<string, number[]>()

/** Back-casts a monthly price series ending at today's base price. */
export function priceHistory(m: Material): number[] {
  const hit = historyCache.get(m.id)
  if (hit) return hit
  const rand = mulberry32(hashString(m.id))
  const n = HISTORY_MONTHS.length
  const out = new Array<number>(n)
  let logP = Math.log(m.base)
  out[n - 1] = m.base
  for (let i = n - 2; i >= 0; i--) {
    // Step backwards: remove drift, add noise, undo any shock that happened at i+1.
    logP -= m.drift / 12 + gaussian(rand) * m.vol
    if (m.shock && m.shock[0] === i + 1) logP -= Math.log(1 + m.shock[1])
    // Monsoon months (May–Jun, Oct–Nov) push sand/aggregate prices up slightly.
    const month = new Date(HISTORY_MONTHS[i]!).getMonth()
    const seasonal = m.category === 'Aggregates' && [4, 5, 9, 10].includes(month) ? 0.025 : 0
    out[i] = Math.round(Math.exp(logP) * (1 + seasonal))
  }
  historyCache.set(m.id, out)
  return out
}

/** Typical-house basket weights used for the Nirmana Construction Cost Index (NCCI). */
export const INDEX_BASKET: Record<string, number> = {
  'cement-opc': 0.17,
  'steel-t12': 0.11,
  'steel-t10': 0.06,
  'sand-river': 0.06,
  'sand-msand': 0.04,
  'metal-20': 0.05,
  'brick-clay': 0.06,
  'tile-floor': 0.07,
  'paint-int': 0.04,
  'wire-25': 0.04,
  'teak': 0.04,
  'alu-section': 0.03,
  'lab-mason': 0.13,
  'lab-unskilled': 0.10,
}

export function costIndexHistory(): number[] {
  const series = HISTORY_MONTHS.map((_, i) => {
    let v = 0
    for (const [id, w] of Object.entries(INDEX_BASKET)) {
      const h = priceHistory(MATERIAL_BY_ID[id]!)
      v += w * (h[i]! / h[0]!)
    }
    return v
  })
  return series.map((v) => +(v * 100).toFixed(1))
}

/** Market price of a material in a given month (YYYY-MM-DD), falling back to the nearest point. */
export function marketPriceAt(id: string, iso: string): number {
  const m = MATERIAL_BY_ID[id]
  if (!m) return 0
  const h = priceHistory(m)
  const key = iso.slice(0, 7)
  const idx = HISTORY_MONTHS.findIndex((x) => x.startsWith(key))
  if (idx >= 0) return h[idx]!
  return iso < HISTORY_MONTHS[0]! ? h[0]! : h[h.length - 1]!
}
