import type { PlanSheet, Project } from './types'

/**
 * Structured floor-plan data, in feet. Plan origin is the top-left (north-west)
 * corner; x runs east, y runs south. The 2D sheets in `components/Drawing.tsx`
 * and the 3D tour in `components/tour` are both generated from this data.
 *
 * Room kinds:
 * - `dashed`: open-sided (verandahs, terraces, courtyards); no ceiling
 * - `stair`:  stair or escalator, rising from south to north; the same rectangle on the
 *             level above is its void
 * - `wet`:    tiled bathrooms and service rooms
 * - `glass`:  glazed partitions, e.g. meeting rooms or shopfronts
 * - `core`:   solid lift and stair core
 * - `open`:   open-plan zones (malls, food courts) with no walls to each other
 * - `void`:   a hole in the floor (atrium), edged with balustrades
 */
export type RoomKind = 'dashed' | 'stair' | 'wet' | 'glass' | 'core' | 'open' | 'void'
export type Room = [x: number, y: number, w: number, h: number, label: string, kind?: RoomKind]

export const RES_GF: Room[] = [
  [0, 0, 16, 8, 'Verandah', 'dashed'], [0, 8, 16, 16, 'Living'], [16, 8, 14, 14, 'Dining'], [30, 8, 16, 12, 'Pantry', 'wet'],
  [16, 22, 8, 10, 'Stair', 'stair'], [24, 22, 6, 8, 'Bath', 'wet'], [30, 20, 16, 18, 'Bedroom 1'], [24, 30, 6, 8, 'Store'],
  [0, 24, 16, 14, 'Car porch', 'dashed'], [16, 32, 8, 6, 'Lobby'],
]
export const RES_FF: Room[] = [
  [0, 0, 16, 8, 'Balcony', 'dashed'], [0, 8, 16, 16, 'Master bed'], [0, 24, 8, 8, 'M. bath', 'wet'], [8, 24, 8, 8, 'Walk-in'],
  [16, 8, 14, 14, 'Family lounge'], [16, 22, 8, 10, 'Stair', 'stair'], [24, 22, 6, 8, 'Bath', 'wet'], [30, 8, 16, 12, 'Bedroom 2'],
  [30, 20, 16, 18, 'Bedroom 3'], [24, 30, 6, 8, 'Study'], [0, 32, 16, 6, 'Terrace', 'dashed'], [16, 32, 8, 6, 'Landing'],
]

/** A free-standing object in plan feet: desks, racks, columns, lifts, cars, pools. */
export interface PlanObject {
  x: number
  y: number
  w: number
  d: number
  h: number
  kind: 'desk' | 'rack' | 'column' | 'lift' | 'plant' | 'tree' | 'car' | 'pool'
}

/** An explicit opening in an exterior wall, measured along that side. */
export interface ExteriorOpening {
  side: 'N' | 'S' | 'E' | 'W'
  from: number
  to: number
  kind: 'door' | 'dock'
}

export interface TourLevel {
  name: string
  rooms: Room[]
  /** Label for any area not covered by a room (open-plan floors). */
  fill?: string
  height: number
  /** Rooms whose walls and ceiling stop short of the full level height. */
  roomHeights?: Record<string, number>
  objects?: PlanObject[]
  openings?: ExteriorOpening[]
}

export interface Rect { x: number; y: number; w: number; d: number }

/** Roof over the top level, in plan feet. A hip roof can be open over a courtyard. */
export type RoofSpec =
  | { kind: 'gable'; x0: number; x1: number; z0: number; z1: number; pitch: number }
  | { kind: 'hip'; x0: number; x1: number; z0: number; z1: number; pitch: number; court?: { x0: number; x1: number; z0: number; z1: number } }
  | { kind: 'flat' }

export interface SiteSpec {
  paving?: Rect[]
  /** Boundary wall around the lot, with a gate on one side. */
  compound?: { side: 'N' | 'S'; from: number; to: number }
  /** Raised ground, e.g. the hillside behind a split-level house. */
  berms?: (Rect & { h: number })[]
  /** Painted parking bays: `n` bays of width `step` starting at x, each `d` deep. */
  parking?: { x: number; y: number; n: number; step: number; d: number }[]
}

export interface TourModel {
  id: string
  style: 'house' | 'office' | 'warehouse' | 'retail'
  width: number
  depth: number
  /** Height of the lowest modelled floor above ground (office floors sit on a podium). */
  baseElevation: number
  levels: TourLevel[]
  /** Walkable area around the building, in plan feet. */
  lot: { minX: number; minY: number; maxX: number; maxY: number }
  start: { x: number; y: number; level: number; facing: number }
  /** Sheets the model was generated from. */
  sources: PlanSheet[]
  outdoor?: PlanObject[]
  roof?: RoofSpec
  site?: SiteSpec
}

/** A building layout before it is tied to a project's plan sheets. */
export type Layout = Omit<TourModel, 'id' | 'sources'>

const officeObjects = (): PlanObject[] => {
  const o: PlanObject[] = []
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) o.push({ x: i * 30 - 0.75, y: j * (80 / 3) - 0.75, w: 1.5, d: 1.5, h: 12, kind: 'column' })
  for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) o.push({ x: 6 + c * 9, y: 24 + r * 8.5, w: 7, d: 3.5, h: 2.5, kind: 'desk' })
  for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) o.push({ x: 80 + c * 9, y: 8 + r * 11, w: 7, d: 3.5, h: 2.5, kind: 'desk' })
  for (let i = 0; i < 3; i++) o.push({ x: 48 + i * 8, y: 54.05, w: 7, d: 0.5, h: 8, kind: 'lift' })
  o.push({ x: 42, y: 4, w: 2, d: 2, h: 4, kind: 'plant' }, { x: 116, y: 74, w: 2, d: 2, h: 4, kind: 'plant' }, { x: 2, y: 74, w: 2, d: 2, h: 4, kind: 'plant' })
  return o
}

const warehouseObjects = (): PlanObject[] => {
  const o: PlanObject[] = []
  for (let i = 0; i < 9; i++) o.push({ x: 36.4 + i * 21.1, y: 11, w: 5, d: 102, h: 24, kind: 'rack' })
  for (let i = 0; i <= 11; i++) for (const y of [0, 145]) o.push({ x: i * 21.8 - 0.75, y: y - 0.75, w: 1.5, d: 1.5, h: 40, kind: 'column' })
  return o
}

const trees = (pts: [number, number][], h = 16): PlanObject[] => pts.map(([x, y]) => ({ x, y, w: 3, d: 3, h, kind: 'tree' }))
const plants = (pts: [number, number][], h = 3.5): PlanObject[] => pts.map(([x, y]) => ({ x: x - 1, y: y - 1, w: 2, d: 2, h, kind: 'plant' }))
/** Verandah posts, centred on each point. */
const posts = (pts: [number, number][], h: number): PlanObject[] => pts.map(([x, y]) => ({ x: x - 0.4, y: y - 0.4, w: 0.8, d: 0.8, h, kind: 'column' }))

// ---------------------------------------------------------------------------
// Archetype layouts

/** Two-storey family house (Perera Residence). */
function houseLayout(floors: number): Layout {
  const levels: TourLevel[] = [{
    name: 'Ground floor', rooms: RES_GF, height: 10,
    openings: [{ side: 'S', from: 18.25, to: 21.75, kind: 'door' }],
  }]
  if (floors > 1) levels.push({ name: 'Upper floor', rooms: RES_FF, height: 10 })
  return {
    style: 'house', width: 46, depth: 38, baseElevation: 0, levels,
    lot: { minX: -18, minY: -16, maxX: 64, maxY: 54 },
    start: { x: 8, y: -6, level: 0, facing: Math.PI },
    outdoor: [
      ...plants([20, 25.5, 31, 36.5, 42].map((x) => [x, 4])),
      ...trees([[-12, -10], [56, -8], [58, 30], [-12, 46], [52, 48], [30, -12]]),
    ],
    roof: { kind: 'gable', x0: -2, x1: 48, z0: 6, z1: 40, pitch: 25 },
    site: {
      paving: [{ x: 0, y: 38, w: 16, d: 18 }, { x: 0, y: -10, w: 16, d: 10 }],
      compound: { side: 'S', from: 18, to: 34 },
    },
  }
}

/** Grade-A office tower: one typical floor on a podium (Lotus Grove Tower). */
function officeLayout(): Layout {
  return {
    style: 'office', width: 120, depth: 80, baseElevation: 48,
    levels: [{
      name: 'Typical floor', height: 12, fill: 'Open office', objects: officeObjects(),
      rooms: [
        ...[0, 1, 2, 3].map((i): Room => [i * 15, 0, 15, 16, `Meeting ${i + 1}`, 'glass']),
        [46, 26, 28, 28, 'Core', 'core'],
      ],
    }],
    lot: { minX: 0, minY: 0, maxX: 120, maxY: 80 },
    start: { x: 30, y: 74, level: 0, facing: 0 },
  }
}

/** Racked distribution warehouse with a dock face (Ja-Ela Logistics Hub). */
function warehouseLayout(): Layout {
  const docks: ExteriorOpening[] = Array.from({ length: 12 }, (_, i) => ({ side: 'S', from: 14.5 + i * 18.2, to: 26.9 + i * 18.2, kind: 'dock' }))
  return {
    style: 'warehouse', width: 240, depth: 145, baseElevation: 0,
    levels: [{
      name: 'Warehouse floor', height: 40, fill: 'Racking hall', objects: warehouseObjects(),
      rooms: [[4, 4, 29, 40, 'Site office']], roomHeights: { 'Site office': 10 },
      openings: [...docks, { side: 'W', from: 60, to: 64, kind: 'door' }],
    }],
    lot: { minX: -30, minY: -20, maxX: 270, maxY: 200 },
    start: { x: 120, y: 130, level: 0, facing: 0 },
    outdoor: trees([[-20, -10], [-20, 60], [-20, 130], [260, -10], [260, 80], [260, 170]]),
  }
}

// ---------------------------------------------------------------------------
// Project-specific layouts

/**
 * Hill View Villa, Kandy: three split levels stepping down a slope. The lower ground
 * floor opens to the pool garden on the valley side; the hill rises behind it.
 */
function villaLayout(): Layout {
  return {
    style: 'house', width: 56, depth: 40, baseElevation: 0,
    levels: [
      {
        name: 'Lower ground', height: 10,
        rooms: [
          [0, 0, 22, 22, 'Garage'], [22, 0, 14, 10, 'Gym'], [22, 10, 7, 12, 'Stair', 'stair'], [29, 10, 7, 12, 'Store'],
          [36, 0, 20, 22, 'Guest bed'], [0, 22, 14, 18, 'Media room'], [14, 22, 22, 18, 'Foyer'],
          [36, 22, 8, 10, 'Guest bath', 'wet'], [44, 22, 12, 10, 'Laundry', 'wet'],
        ],
        openings: [{ side: 'W', from: 4, to: 18, kind: 'dock' }, { side: 'S', from: 23, to: 27, kind: 'door' }],
        objects: [{ x: 40, y: 46, w: 22, d: 10, h: 0, kind: 'pool' }],
      },
      {
        name: 'Living level', height: 10,
        rooms: [
          [0, 0, 14, 12, 'Kitchen'], [14, 0, 8, 12, 'Powder room', 'wet'], [22, 0, 14, 10, 'Hall'], [36, 0, 20, 10, 'Study'],
          [0, 12, 22, 10, 'Dining'], [22, 10, 7, 12, 'Stair', 'stair'], [29, 10, 7, 12, 'Stair ', 'stair'],
          [36, 10, 20, 16, 'Master bed'], [0, 22, 36, 18, 'Living'], [36, 26, 20, 14, 'Terrace', 'dashed'],
        ],
      },
      {
        name: 'Upper level', height: 10,
        rooms: [
          [0, 0, 22, 22, 'Bedroom 2'], [22, 0, 14, 10, 'Landing'], [36, 0, 20, 22, 'Bedroom 3'],
          [22, 10, 7, 12, 'Upper hall'], [29, 10, 7, 12, 'Stair ', 'stair'],
          [0, 22, 36, 10, 'Family lounge'], [36, 22, 8, 10, 'Bath', 'wet'], [44, 22, 12, 10, 'Study nook'],
          [0, 32, 36, 8, 'Balcony', 'dashed'],
        ],
      },
    ],
    lot: { minX: -16, minY: -3, maxX: 72, maxY: 70 },
    start: { x: 25, y: 52, level: 0, facing: 0 },
    outdoor: [
      ...plants([[36, 43], [36, 60], [66, 43], [66, 60], [20, 44], [30, 44]], 4),
      ...trees([[-10, 30], [-10, 58], [-12, 66], [68, 8]], 18),
    ],
    roof: { kind: 'gable', x0: -2, x1: 58, z0: -2, z1: 34, pitch: 25 },
    site: {
      paving: [{ x: 34, y: 40, w: 34, d: 22 }, { x: 21, y: 40, w: 8, d: 30 }, { x: -16, y: 2, w: 16, d: 18 }],
      berms: [{ x: -60, y: -80, w: 180, d: 77, h: 10.7 }],
    },
  }
}

/**
 * Fort Heritage Home, Galle Fort: a Dutch-period townhouse, narrow and deep, with a
 * street verandah and rooms wrapped around an open courtyard on both floors.
 */
function heritageLayout(): Layout {
  return {
    style: 'house', width: 34, depth: 60, baseElevation: 0,
    levels: [
      {
        name: 'Ground floor', height: 11,
        rooms: [
          [0, 0, 34, 7, 'Street verandah', 'dashed'], [0, 7, 20, 14, 'Saloon'], [20, 7, 14, 14, 'Study'],
          [0, 21, 10, 20, 'Dining'], [10, 21, 16, 20, 'Courtyard', 'dashed'], [26, 21, 8, 12, 'Stair', 'stair'], [26, 33, 8, 8, 'Passage'],
          [0, 41, 10, 10, 'Kitchen'], [0, 51, 10, 9, 'Bath', 'wet'], [10, 41, 24, 19, 'Bedroom 1'],
        ],
        openings: [{ side: 'W', from: 43, to: 46.5, kind: 'door' }],
        objects: posts([[0.6, 0.6], [11.3, 0.6], [22.7, 0.6], [33.4, 0.6]], 11),
      },
      {
        name: 'Upper floor', height: 11,
        rooms: [
          [0, 0, 34, 7, 'Upper verandah', 'dashed'], [0, 7, 20, 14, 'Master bed'], [20, 7, 14, 14, 'Sitting room'],
          [0, 21, 10, 20, 'Bedroom 2'], [26, 21, 8, 12, 'Stair', 'stair'], [26, 33, 8, 8, 'Landing'],
          [0, 41, 10, 9, 'Bath', 'wet'], [0, 50, 10, 10, 'Walk-in'], [10, 41, 24, 19, 'Bedroom 3'],
        ],
      },
    ],
    lot: { minX: -8, minY: -14, maxX: 42, maxY: 74 },
    start: { x: 17, y: -8, level: 0, facing: Math.PI },
    outdoor: [
      ...trees([[16.5, 29.5]], 20),
      ...trees([[2, 64], [28, 66], [38, 40]], 15),
    ],
    roof: { kind: 'hip', x0: -1.5, x1: 35.5, z0: 7, z1: 61.5, pitch: 35, court: { x0: 10, x1: 26, z0: 21, z1: 41 } },
    site: {
      paving: [{ x: -8, y: -14, w: 50, d: 14 }],
      compound: { side: 'N', from: -8, to: 42 },
    },
  }
}

/**
 * Nallur Family Home, Jaffna: a single-storey northern courtyard house. A front thinnai
 * verandah leads through the entrance hall to a shaded verandah around the open mutram.
 */
function courtyardLayout(): Layout {
  const verandah = 'Court verandah'
  return {
    style: 'house', width: 52, depth: 48, baseElevation: 0,
    levels: [{
      name: 'Ground floor', height: 10,
      rooms: [
        [0, 0, 52, 8, 'Thinnai', 'dashed'], [0, 8, 12, 16, 'Living'], [12, 8, 28, 4, 'Entrance hall'], [40, 8, 12, 14, 'Bedroom 1'],
        [12, 12, 28, 6, verandah, 'dashed'], [12, 18, 6, 14, verandah, 'dashed'], [34, 18, 6, 14, verandah, 'dashed'], [12, 32, 28, 6, verandah, 'dashed'],
        [18, 18, 16, 14, 'Mutram courtyard', 'dashed'],
        [0, 24, 12, 8, 'Prayer room'], [40, 22, 6, 10, 'Store'], [46, 22, 6, 10, 'Bath', 'wet'],
        [0, 32, 12, 16, 'Bedroom 2'], [12, 38, 14, 10, 'Dining'], [26, 38, 14, 10, 'Kitchen'], [40, 32, 12, 16, 'Bedroom 3'],
      ],
      openings: [{ side: 'S', from: 31, to: 34.5, kind: 'door' }],
      objects: posts([
        [0.6, 0.6], [13, 0.6], [26, 0.6], [39, 0.6], [51.4, 0.6],
        [18, 18], [26, 18], [34, 18], [18, 25], [34, 25], [18, 32], [26, 32], [34, 32],
      ], 10),
    }],
    lot: { minX: -16, minY: -18, maxX: 68, maxY: 62 },
    start: { x: 26, y: -10, level: 0, facing: Math.PI },
    outdoor: [
      ...trees([[24.5, 23.5]], 17),
      ...trees([[-10, -10], [60, -12], [-12, 18], [-10, 44], [8, 56], [62, 6]], 18),
      ...plants([[14, 2], [38, 2]], 4),
    ],
    roof: { kind: 'hip', x0: -2, x1: 54, z0: -2, z1: 50, pitch: 25, court: { x0: 18, x1: 34, z0: 18, z1: 32 } },
    site: {
      paving: [{ x: 20, y: -18, w: 12, d: 18 }],
      compound: { side: 'N', from: 18, to: 34 },
    },
  }
}

/**
 * Wayamba Retail Plaza, Kurunegala: three trading levels of shops around a central
 * top-lit atrium, linked by escalators, with a food court and a roof terrace.
 */
function retailLayout(): Layout {
  const north = (names: string[]): Room[] => names.map((n, i): Room => [50 + i * 20, 0, 20, 30, n, 'glass'])
  const south = (names: string[]): Room[] => names.map((n, i): Room => [90 + i * 20, 70, 20, 30, n, 'glass'])
  const atrium: Room = [55, 38, 40, 24, 'Atrium void', 'void']
  const esc1: Room = [48, 40, 5, 20, 'Escalator', 'stair']
  const esc2: Room = [97, 40, 5, 20, 'Escalator ', 'stair']
  const planters = plants([[20, 36], [20, 64], [130, 36], [130, 64]], 5)
  return {
    style: 'retail', width: 150, depth: 100, baseElevation: 0,
    levels: [
      {
        name: 'Ground floor', height: 14,
        rooms: [
          [0, 30, 150, 40, 'Mall concourse', 'open'], [0, 0, 50, 30, 'Supermarket', 'glass'],
          ...north(['Fashion boutique', 'Electronics', 'Jewellers', 'Pharmacy', 'Bank branch']),
          [0, 70, 16, 30, 'Washrooms', 'wet'], [16, 70, 22, 30, 'Café', 'glass'], [38, 70, 22, 30, 'Bookshop', 'glass'],
          [60, 70, 30, 30, 'Entrance hall', 'open'],
          ...south(['Mobile & telco', 'Sports', 'Opticians']),
          [55, 38, 40, 24, 'Atrium', 'open'], esc1,
        ],
        openings: [{ side: 'S', from: 66, to: 84, kind: 'door' }],
        objects: [...planters, ...trees([[73.5, 48.5]], 20)],
      },
      {
        name: 'Level 1', height: 14,
        rooms: [
          [0, 30, 150, 40, 'Upper mall', 'open'], [0, 0, 50, 30, 'Department store', 'glass'],
          ...north(['Homeware', 'Kids & toys', 'Salon', 'Cosmetics', 'Gadget hub']),
          [0, 70, 16, 30, 'Washrooms', 'wet'], [16, 70, 74, 30, 'Food court', 'open'],
          ...south(['Watch gallery', 'Footwear', 'Travel agent']),
          atrium, esc1, esc2,
        ],
        objects: planters,
      },
      {
        name: 'Level 2', height: 14,
        rooms: [
          [0, 30, 150, 40, 'Top mall', 'open'], [0, 0, 50, 30, 'Fitness centre', 'glass'],
          ...north(['Learning centre', 'Medical clinic', 'Bridal studio', 'Art gallery', 'Music']),
          [0, 70, 16, 30, 'Washrooms', 'wet'], [16, 70, 74, 30, 'Roof terrace', 'dashed'], [90, 70, 60, 30, 'Rooftop restaurant', 'glass'],
          atrium, esc2,
        ],
        objects: planters,
      },
    ],
    lot: { minX: -20, minY: -20, maxX: 170, maxY: 150 },
    start: { x: 75, y: 112, level: 0, facing: 0 },
    outdoor: [
      ...[[4, 0], [4, 1], [4, 2], [4, 4], [4, 6], [92, 0], [92, 2], [92, 3], [92, 5], [92, 6]].map(([x0, bay]): PlanObject => ({ x: x0 + bay * 10 + 2, y: 122, w: 6, d: 13.6, h: 5, kind: 'car' })),
      ...trees([[-14, 110], [-14, 140], [160, 110], [160, 140], [-14, 20], [160, 20]], 18),
      ...plants([[56, 104], [94, 104]], 4.5),
    ],
    roof: { kind: 'flat' },
    site: {
      paving: [{ x: 0, y: 100, w: 150, d: 14 }],
      parking: [{ x: 4, y: 120, n: 7, step: 10, d: 17 }, { x: 92, y: 120, n: 7, step: 10, d: 17 }],
    },
  }
}

const BESPOKE: Record<string, () => Layout> = {
  'hillview-villa': villaLayout,
  'galle-fort-home': heritageLayout,
  'nallur-home': courtyardLayout,
  'wayamba-plaza': retailLayout,
}

/** A project's own layout, if it has one; used by the 2D floor-plan sheets as well. */
export function bespokeLayout(project: Pick<Project, 'id'>): Layout | null {
  return BESPOKE[project.id]?.() ?? null
}

/** The project's layout, falling back to the archetype for its building type. */
export function layoutFor(project: Project): Layout {
  const own = bespokeLayout(project)
  if (own) return own
  switch (project.typeId) {
    case 'villa': return villaLayout()
    case 'office': return officeLayout()
    case 'retail': return retailLayout()
    case 'warehouse': return warehouseLayout()
    default: return project.sector === 'commercial' ? officeLayout() : houseLayout(project.floors)
  }
}

/** Plan sheets that a 3D tour can be generated from. */
export const TOURABLE: PlanSheet['drawing'][] = ['res-gf', 'res-ff', 'com-typ', 'wh-plan']

/** Builds the walk-through model from a project's uploaded plan sheets, if it has floor plans. */
export function tourModelFor(project: Project): TourModel | null {
  const latest = (kind: PlanSheet['drawing']) => project.plans.find((s) => s.drawing === kind && s.status !== 'Superseded')
  const layout = layoutFor(project)
  const sources = TOURABLE
    .filter((kind) => kind !== 'res-ff' || layout.levels.length > 1)
    .map(latest)
    .filter((s): s is PlanSheet => !!s)
  if (!sources.length) return null
  return { ...layout, id: `${project.id}-${layout.style}`, sources }
}
