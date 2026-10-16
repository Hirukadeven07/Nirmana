/**
 * Input plan for the 3D house model. Dimensions are in feet; the plan origin is the
 * north-west corner, x runs east and y runs south. The model, the 2D plan and every
 * section's details are all derived from this one object, so editing it updates all three.
 */

export type RoomType = 'living' | 'bedroom' | 'kitchen' | 'wet' | 'circulation' | 'stair' | 'utility' | 'study' | 'commercial' | 'outdoor'
export type WorkStatus = 'Not started' | 'In progress' | 'Complete'
export type RoofType = 'hip' | 'gable' | 'flat'

export interface PlanRoom {
  id: string
  name: string
  type: RoomType
  x: number
  y: number
  w: number
  d: number
  floorFinish: string
  wallFinish: string
  ceiling: string
  electrical: string
  notes: string
  status: WorkStatus
  progress: number
}

export interface PlanFloor {
  id: string
  name: string
  /** Floor-to-floor height in feet. */
  height: number
  rooms: PlanRoom[]
}

export interface HousePlan {
  name: string
  location: string
  client: string
  architect: string
  /** Plot size in feet, for the site around the house. */
  plot: { w: number; d: number }
  /** Where the house's (0, 0) sits on the plot. */
  setback: { x: number; y: number }
  wallThickness: number
  plinth: number
  roof: { type: RoofType; pitch: number; material: string; overhang: number }
  structure: { foundation: string; frame: string; walls: string; slab: string }
  floors: PlanFloor[]
  /** Progress (0–100) of the structural sections. Without it they show as complete and the roof as not started. */
  progress?: { foundation: number; groundSlab: number; slabs: number[]; stair: number; roof: number }
}

export const ROOM_TYPE_META: Record<RoomType, { label: string; color: string }> = {
  living: { label: 'Living', color: '#e7cfa6' },
  bedroom: { label: 'Bedroom', color: '#d8bf9c' },
  kitchen: { label: 'Kitchen', color: '#c9d6dc' },
  wet: { label: 'Bath / wet', color: '#a9d0de' },
  circulation: { label: 'Circulation', color: '#e3ddd1' },
  stair: { label: 'Stair', color: '#c6bba8' },
  utility: { label: 'Utility', color: '#d4cdc0' },
  study: { label: 'Study', color: '#dcc9a8' },
  commercial: { label: 'Commercial', color: '#cfc3dd' },
  outdoor: { label: 'Outdoor', color: '#b7c2a5' },
}

export const STATUS_META: Record<WorkStatus, { color: string; tone: 'slate' | 'amber' | 'green' }> = {
  'Not started': { color: '#cbd5e1', tone: 'slate' },
  'In progress': { color: '#fbbf24', tone: 'amber' },
  Complete: { color: '#34d399', tone: 'green' },
}

/** Indicative finish rates in LKR per sq ft, used for the section cost estimates. */
export const FINISH_RATES: Record<string, number> = {
  'Homogeneous tiles 600×600': 620,
  'Ceramic tiles 300×300': 410,
  'Anti-slip ceramic 300×300': 460,
  'Granite slab': 1450,
  'Teak timber flooring': 2100,
  'Polished cement (titanium)': 280,
  'Terrazzo': 900,
  'Cement paving blocks': 360,
  'Grano screed': 240,
}

let seq = 0
const room = (r: Omit<PlanRoom, 'id' | 'ceiling' | 'electrical' | 'notes' | 'status' | 'progress'> & Partial<PlanRoom>): PlanRoom => ({
  id: `r${++seq}`,
  ceiling: 'Gypsum board, emulsion paint',
  electrical: '2 light points, 2 socket outlets',
  notes: '',
  status: 'Not started',
  progress: 0,
  ...r,
})

export function samplePlan(): HousePlan {
  seq = 0
  return {
    name: 'Perera Residence',
    location: 'Battaramulla, Colombo',
    client: 'Mr & Mrs Perera',
    architect: 'Studio Lanka Architects',
    plot: { w: 64, d: 58 },
    setback: { x: 12, y: 12 },
    wallThickness: 0.75,
    plinth: 1.5,
    roof: { type: 'hip', pitch: 26, material: 'Calicut clay tiles on treated timber', overhang: 2 },
    structure: {
      foundation: 'Random rubble strip footing, 3 ft deep, with RCC plinth beam',
      frame: 'RCC columns 9"×9" with grade 25 concrete',
      walls: '9" brick walls (external), 4½" (internal), 1:5 cement mortar',
      slab: '5" RCC suspended slab, T10 @ 6" c/c both ways',
    },
    floors: [
      {
        id: 'gf',
        name: 'Ground floor',
        height: 10.5,
        rooms: [
          room({ name: 'Verandah', type: 'outdoor', x: 0, y: 0, w: 16, d: 8, floorFinish: 'Terrazzo', wallFinish: 'Weather-shield paint', ceiling: 'Exposed timber rafters', electrical: '2 wall lights', status: 'Complete', progress: 100 }),
          room({ name: 'Living room', type: 'living', x: 0, y: 8, w: 16, d: 14, floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', electrical: '4 light points, 6 sockets, TV point', notes: 'Double-height window to the verandah. Client chose warm-white downlights.', status: 'In progress', progress: 70 }),
          room({ name: 'Dining', type: 'living', x: 16, y: 8, w: 12, d: 12, floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', electrical: '1 pendant point, 3 sockets', status: 'In progress', progress: 65 }),
          room({ name: 'Kitchen', type: 'kitchen', x: 28, y: 8, w: 12, d: 12, floorFinish: 'Anti-slip ceramic 300×300', wallFinish: 'Ceramic dado to 4 ft, emulsion above', electrical: '3 light points, 8 sockets, cooker point, exhaust fan', notes: 'Granite worktop with pantry cupboards along the east wall.', status: 'In progress', progress: 45 }),
          room({ name: 'Stair', type: 'stair', x: 16, y: 20, w: 6, d: 10, floorFinish: 'Granite slab', wallFinish: 'Emulsion paint, 2 coats', electrical: '2-way light switch', status: 'Complete', progress: 100 }),
          room({ name: 'Guest bath', type: 'wet', x: 22, y: 20, w: 6, d: 6, floorFinish: 'Anti-slip ceramic 300×300', wallFinish: 'Full-height ceramic wall tiles', ceiling: 'PVC ceiling panels', electrical: '1 light, 1 shaver socket, exhaust fan', status: 'In progress', progress: 55 }),
          room({ name: 'Bedroom 1', type: 'bedroom', x: 28, y: 20, w: 12, d: 14, floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', electrical: '2 light points, 4 sockets, AC point', notes: 'Ground-floor bedroom for parents, step-free access.', status: 'In progress', progress: 60 }),
          room({ name: 'Store', type: 'utility', x: 22, y: 26, w: 6, d: 8, floorFinish: 'Polished cement (titanium)', wallFinish: 'Cement wash', ceiling: 'Exposed slab, painted', electrical: '1 light point', status: 'Complete', progress: 100 }),
          room({ name: 'Car porch', type: 'outdoor', x: 0, y: 22, w: 16, d: 12, floorFinish: 'Cement paving blocks', wallFinish: 'Weather-shield paint', ceiling: 'Exposed slab, painted', electrical: '2 light points, 1 weatherproof socket', status: 'Complete', progress: 100 }),
          room({ name: 'Lobby', type: 'circulation', x: 16, y: 30, w: 6, d: 4, floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', electrical: '1 light point', status: 'In progress', progress: 80 }),
        ],
      },
      {
        id: 'ff',
        name: 'First floor',
        height: 10,
        rooms: [
          room({ name: 'Balcony', type: 'outdoor', x: 0, y: 0, w: 16, d: 8, floorFinish: 'Anti-slip ceramic 300×300', wallFinish: 'Weather-shield paint', ceiling: 'Roof soffit, timber', electrical: '1 wall light', notes: 'Steel and timber balustrade, 3 ft high.' }),
          room({ name: 'Master bedroom', type: 'bedroom', x: 0, y: 8, w: 16, d: 14, floorFinish: 'Teak timber flooring', wallFinish: 'Emulsion paint, 2 coats', electrical: '3 light points, 6 sockets, AC point', notes: 'Opens onto the balcony through sliding doors.', status: 'In progress', progress: 20 }),
          room({ name: 'Master bath', type: 'wet', x: 0, y: 22, w: 8, d: 8, floorFinish: 'Anti-slip ceramic 300×300', wallFinish: 'Full-height ceramic wall tiles', ceiling: 'PVC ceiling panels', electrical: '2 lights, shaver socket, water heater point, exhaust fan' }),
          room({ name: 'Walk-in wardrobe', type: 'utility', x: 8, y: 22, w: 8, d: 8, floorFinish: 'Teak timber flooring', wallFinish: 'Emulsion paint, 2 coats', electrical: '1 light point, 1 socket' }),
          room({ name: 'Family lounge', type: 'living', x: 16, y: 8, w: 12, d: 12, floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', electrical: '3 light points, 4 sockets, TV point', status: 'In progress', progress: 15 }),
          room({ name: 'Bedroom 2', type: 'bedroom', x: 28, y: 8, w: 12, d: 12, floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', electrical: '2 light points, 4 sockets, AC point' }),
          room({ name: 'Stair', type: 'stair', x: 16, y: 20, w: 6, d: 10, floorFinish: 'Granite slab', wallFinish: 'Emulsion paint, 2 coats', electrical: '2-way light switch', status: 'Complete', progress: 100 }),
          room({ name: 'Bath', type: 'wet', x: 22, y: 20, w: 6, d: 6, floorFinish: 'Anti-slip ceramic 300×300', wallFinish: 'Full-height ceramic wall tiles', ceiling: 'PVC ceiling panels', electrical: '1 light, 1 shaver socket, exhaust fan' }),
          room({ name: 'Bedroom 3', type: 'bedroom', x: 28, y: 20, w: 12, d: 14, floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', electrical: '2 light points, 4 sockets, AC point' }),
          room({ name: 'Study', type: 'study', x: 22, y: 26, w: 6, d: 8, floorFinish: 'Teak timber flooring', wallFinish: 'Emulsion paint, 2 coats', electrical: '1 light point, 4 sockets, data point' }),
          room({ name: 'Terrace', type: 'outdoor', x: 0, y: 30, w: 16, d: 4, floorFinish: 'Anti-slip ceramic 300×300', wallFinish: 'Weather-shield paint', ceiling: 'Open', electrical: '1 weatherproof light' }),
          room({ name: 'Landing', type: 'circulation', x: 16, y: 30, w: 6, d: 4, floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', electrical: '1 light point', status: 'In progress', progress: 30 }),
        ],
      },
    ],
  }
}

/* ───────────────────────── Derived geometry & quantities ───────────────────────── */

export const isEnclosed = (r: PlanRoom) => r.type !== 'outdoor'

export function footprint(rooms: PlanRoom[]) {
  const enclosed = rooms.filter(isEnclosed)
  const list = enclosed.length ? enclosed : rooms
  if (!list.length) return { x: 0, y: 0, w: 0, d: 0 }
  const x = Math.min(...list.map((r) => r.x))
  const y = Math.min(...list.map((r) => r.y))
  const w = Math.max(...list.map((r) => r.x + r.w)) - x
  const d = Math.max(...list.map((r) => r.y + r.d)) - y
  return { x, y, w, d }
}

export function planExtent(plan: HousePlan) {
  const all = plan.floors.flatMap((f) => f.rooms)
  if (!all.length) return { w: 0, d: 0 }
  return { w: Math.max(...all.map((r) => r.x + r.w)), d: Math.max(...all.map((r) => r.y + r.d)) }
}

export type Side = 'N' | 'S' | 'E' | 'W'

/** True when the outside of this room edge is not covered by another enclosed room on the same floor. */
export function isExteriorEdge(r: PlanRoom, side: Side, rooms: PlanRoom[]) {
  const probe = (px: number, py: number) => rooms.some((o) => o !== r && isEnclosed(o) && px > o.x && px < o.x + o.w && py > o.y && py < o.y + o.d)
  const samples = [0.25, 0.5, 0.75]
  return samples.every((t) => {
    if (side === 'N') return !probe(r.x + r.w * t, r.y - 0.5)
    if (side === 'S') return !probe(r.x + r.w * t, r.y + r.d + 0.5)
    if (side === 'W') return !probe(r.x - 0.5, r.y + r.d * t)
    return !probe(r.x + r.w + 0.5, r.y + r.d * t)
  })
}

const SQFT_M2 = 0.0929

export interface SectionDetails {
  id: string
  title: string
  group: string
  kind: 'room' | 'structure'
  summary: string
  specs: [string, string][]
  quantities: { item: string; qty: number; unit: string }[]
  cost: number
  status: WorkStatus
  progress: number
  notes?: string
  floorId?: string
  roomId?: string
}

export function roomDetails(floor: PlanFloor, r: PlanRoom): SectionDetails {
  const area = r.w * r.d
  const perimeter = 2 * (r.w + r.d)
  const wallH = r.type === 'outdoor' ? 0 : floor.height - 1
  const wallArea = Math.max(0, perimeter * wallH * 0.82) // less ~18% for doors and windows
  const exterior = (['N', 'S', 'E', 'W'] as Side[]).filter((s) => isExteriorEdge(r, s, floor.rooms))
  const floorRate = FINISH_RATES[r.floorFinish] ?? 500
  const tiled = /tile|granite|ceramic/i.test(r.floorFinish)
  const fullTile = /full-height/i.test(r.wallFinish)
  const quantities = [
    { item: r.floorFinish, qty: Math.round(area * 1.05), unit: 'sq ft' },
    ...(tiled ? [{ item: 'Tile adhesive (20 kg)', qty: Math.ceil(area / 45), unit: 'bags' }] : []),
    ...(wallArea > 0 ? [{ item: 'Wall plaster 1:5, ½"', qty: Math.round(wallArea), unit: 'sq ft' }] : []),
    ...(wallArea > 0 && !fullTile ? [{ item: 'Emulsion paint, 2 coats', qty: Math.ceil((wallArea * 2) / 110), unit: 'litres' }] : []),
    ...(fullTile ? [{ item: 'Ceramic wall tiles', qty: Math.round(wallArea * 1.08), unit: 'sq ft' }] : []),
  ]
  const cost = area * floorRate + wallArea * (fullTile ? 520 : 165) + area * (r.type === 'wet' ? 950 : r.type === 'outdoor' ? 120 : 380)
  const windows = isEnclosed(r) && r.type !== 'stair' ? exterior.length : 0
  return {
    id: `${floor.id}:${r.id}`,
    title: r.name,
    group: floor.name,
    kind: 'room',
    summary: `${ROOM_TYPE_META[r.type].label} · ${floor.name.toLowerCase()} · ${r.w} × ${r.d} ft`,
    specs: [
      ['Size', `${r.w} ft × ${r.d} ft`],
      ['Floor area', `${area} sq ft (${(area * SQFT_M2).toFixed(1)} m²)`],
      ['Position', `${r.x} ft E, ${r.y} ft S of the north-west corner`],
      ['Ceiling height', r.type === 'outdoor' ? 'Open' : `${(floor.height - 1).toFixed(1)} ft clear`],
      ['Floor finish', r.floorFinish],
      ['Walls', r.wallFinish],
      ['Ceiling', r.ceiling],
      ['Electrical', r.electrical],
      ['External walls', exterior.length ? exterior.map((s) => ({ N: 'North', S: 'South', E: 'East', W: 'West' })[s]).join(', ') : 'None (internal room)'],
      ...(windows ? [['Windows', `${windows} × ${r.type === 'wet' ? 'louvre, 2 × 1.5 ft' : 'timber casement, 4 × 4 ft'}`] as [string, string]] : []),
    ],
    quantities,
    cost: Math.round(cost / 1000) * 1000,
    status: r.status,
    progress: r.progress,
    notes: r.notes || undefined,
    floorId: floor.id,
    roomId: r.id,
  }
}

export function roofArea(plan: HousePlan) {
  const top = plan.floors[plan.floors.length - 1]
  if (!top) return { plan: 0, slope: 0 }
  const fp = footprint(top.rooms)
  const o = plan.roof.overhang
  const planArea = (fp.w + 2 * o) * (fp.d + 2 * o)
  const slope = plan.roof.type === 'flat' ? planArea : planArea / Math.cos((plan.roof.pitch * Math.PI) / 180)
  return { plan: planArea, slope }
}

/** Status and progress of a structural section, from the plan's progress when it has one. */
function stage(pct: number | undefined, fallback: number): { status: WorkStatus; progress: number } {
  const progress = Math.round(pct ?? fallback)
  return { status: progress >= 100 ? 'Complete' : progress > 0 ? 'In progress' : 'Not started', progress }
}

export function structureDetails(plan: HousePlan): SectionDetails[] {
  const out: SectionDetails[] = []
  const pr = plan.progress
  const ground = plan.floors[0]
  if (!ground) return out
  const gfp = footprint(ground.rooms)
  const perim = 2 * (gfp.w + gfp.d)
  const footingM3 = (perim * 2 * 3) * 0.0283
  out.push({
    id: 'foundation',
    title: 'Foundation & plinth',
    group: 'Structure',
    kind: 'structure',
    summary: `Strip footing along ${perim} ft of external wall`,
    specs: [
      ['Type', plan.structure.foundation],
      ['Footing size', '2 ft wide × 3 ft deep'],
      ['Plinth height', `${plan.plinth} ft above ground`],
      ['Damp-proof course', 'Bitumen-based DPC on plinth beam'],
      ['Footprint', `${gfp.w} × ${gfp.d} ft`],
    ],
    quantities: [
      { item: 'Rubble masonry', qty: Math.round(footingM3 * 10) / 10, unit: 'm³' },
      { item: 'RCC plinth beam', qty: Math.round(perim * 0.75 * 0.75 * 0.0283 * 10) / 10, unit: 'm³' },
      { item: 'Cement (50 kg)', qty: Math.round(footingM3 * 2.6 + perim * 0.12), unit: 'bags' },
    ],
    cost: Math.round(perim * 9200 / 1000) * 1000,
    ...stage(pr?.foundation, 100),
  })
  const groundArea = ground.rooms.filter(isEnclosed).reduce((s, r) => s + r.w * r.d, 0)
  out.push({
    id: 'slab-0',
    title: 'Ground floor slab',
    group: 'Structure',
    kind: 'structure',
    summary: `${groundArea} sq ft slab on grade`,
    specs: [['Type', '4" grade 20 concrete on 2" sand bed, polythene membrane'], ['Area', `${groundArea} sq ft`], ['Level', `+${plan.plinth} ft`]],
    quantities: [
      { item: 'Concrete grade 20', qty: Math.round(groundArea * (4 / 12) * 0.0283 * 10) / 10, unit: 'm³' },
      { item: 'Polythene membrane', qty: Math.round(groundArea * 1.1), unit: 'sq ft' },
    ],
    cost: Math.round(groundArea * 520 / 1000) * 1000,
    ...stage(pr?.groundSlab, 100),
  })
  let level = plan.plinth
  plan.floors.forEach((f, i) => {
    level += i === 0 ? 0 : plan.floors[i - 1]!.height
    if (i === 0) return
    const area = f.rooms.reduce((s, r) => s + r.w * r.d, 0)
    const m3 = area * (5 / 12) * 0.0283
    out.push({
      id: `slab-${i}`,
      title: `${f.name} slab`,
      group: 'Structure',
      kind: 'structure',
      summary: `${area} sq ft suspended RCC slab at +${level.toFixed(1)} ft`,
      specs: [['Type', plan.structure.slab], ['Area', `${area} sq ft`], ['Level', `+${level.toFixed(1)} ft`], ['Frame', plan.structure.frame]],
      quantities: [
        { item: 'Concrete grade 25', qty: Math.round(m3 * 10) / 10, unit: 'm³' },
        { item: 'Steel rebar T10/T12', qty: Math.round(m3 * 95), unit: 'kg' },
        { item: 'Formwork', qty: Math.round(area * 1.1), unit: 'sq ft' },
      ],
      cost: Math.round(area * 1850 / 1000) * 1000,
      ...stage(pr?.slabs[i - 1], 100),
    })
  })
  const stair = ground.rooms.find((r) => r.type === 'stair')
  if (stair && plan.floors.length > 1) {
    const risers = Math.round((ground.height * 12) / 6.5)
    out.push({
      id: 'stair',
      title: 'Staircase',
      group: 'Structure',
      kind: 'structure',
      summary: `Dog-leg RCC stair, ${risers} risers`,
      specs: [['Type', 'RCC waist slab, dog-leg with mid landing'], ['Risers', `${risers} × ${((ground.height * 12) / risers).toFixed(1)}"`], ['Treads', '10" granite-clad'], ['Width', `${Math.min(stair.w, stair.d) / 2} ft per flight`], ['Balustrade', 'Mild steel with teak handrail']],
      quantities: [
        { item: 'Concrete grade 25', qty: 1.6, unit: 'm³' },
        { item: 'Granite treads & risers', qty: Math.round(risers * 4.2), unit: 'sq ft' },
      ],
      cost: 685000,
      ...stage(pr?.stair, 100),
    })
  }
  const ra = roofArea(plan)
  out.push({
    id: 'roof',
    title: 'Roof',
    group: 'Structure',
    kind: 'structure',
    summary: `${plan.roof.type === 'hip' ? 'Hipped' : plan.roof.type === 'gable' ? 'Gable' : 'Flat'} roof, ${Math.round(ra.slope)} sq ft`,
    specs: [
      ['Form', plan.roof.type === 'flat' ? 'Flat RCC roof with parapet' : `${plan.roof.type === 'hip' ? 'Hipped' : 'Gable'} roof at ${plan.roof.pitch}°`],
      ['Covering', plan.roof.type === 'flat' ? 'Waterproofing membrane with screed to falls' : plan.roof.material],
      ['Eaves overhang', `${plan.roof.overhang} ft`],
      ['Plan area', `${Math.round(ra.plan)} sq ft`],
      ['Roof surface', `${Math.round(ra.slope)} sq ft`],
      ['Rainwater', 'PVC gutters with 3" downpipes at each corner'],
    ],
    quantities: plan.roof.type === 'flat'
      ? [{ item: 'Waterproofing membrane', qty: Math.round(ra.slope * 1.1), unit: 'sq ft' }]
      : [
          { item: 'Calicut clay tiles', qty: Math.round(ra.slope * 1.35), unit: 'nos' },
          { item: 'Treated timber rafters 4"×2"', qty: Math.round(ra.plan / 2.2), unit: 'lin ft' },
          { item: 'Ridge tiles', qty: Math.round((plan.roof.type === 'hip' ? 2.4 : 1) * Math.sqrt(ra.plan)), unit: 'nos' },
        ],
    cost: Math.round(ra.slope * (plan.roof.type === 'flat' ? 1100 : 780) / 1000) * 1000,
    ...stage(pr?.roof, 0),
  })
  return out
}

export function allSections(plan: HousePlan): SectionDetails[] {
  return [...structureDetails(plan), ...plan.floors.flatMap((f) => f.rooms.map((r) => roomDetails(f, r)))]
}

export function newRoomId() {
  return `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}
