import type { PlanSheet, Project } from './types'

/**
 * Structured floor-plan data, in feet. Plan origin is the top-left (north-west)
 * corner; x runs east, y runs south. The 2D sheets in `components/Drawing.tsx`
 * and the 3D tour in `components/tour` are both generated from this data.
 */
export type RoomKind = 'dashed' | 'stair' | 'wet' | 'glass' | 'core'
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

/** A free-standing object in plan feet: desks, racks, columns, lifts. */
export interface PlanObject {
  x: number
  y: number
  w: number
  d: number
  h: number
  kind: 'desk' | 'rack' | 'column' | 'lift' | 'plant' | 'tree'
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

export interface TourModel {
  id: string
  style: 'house' | 'office' | 'warehouse'
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
}

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

const trees = (pts: [number, number][]): PlanObject[] => pts.map(([x, y]) => ({ x, y, w: 3, d: 3, h: 16, kind: 'tree' }))

function houseModel(project: Project, gf: PlanSheet, ff?: PlanSheet): TourModel {
  const levels: TourLevel[] = [{
    name: 'Ground floor', rooms: RES_GF, height: 10,
    openings: [{ side: 'S', from: 18.25, to: 21.75, kind: 'door' }],
  }]
  if (ff && project.floors > 1) levels.push({ name: 'Upper floor', rooms: RES_FF, height: 10 })
  return {
    id: `${project.id}-house`, style: 'house', width: 46, depth: 38, baseElevation: 0, levels,
    lot: { minX: -18, minY: -16, maxX: 64, maxY: 54 },
    start: { x: 8, y: -6, level: 0, facing: Math.PI },
    sources: ff ? [gf, ff] : [gf],
    outdoor: [
      ...[20, 25.5, 31, 36.5, 42].map((x) => ({ x: x - 1, y: 3, w: 2, d: 2, h: 3.5, kind: 'plant' as const })),
      ...trees([[-12, -10], [56, -8], [58, 30], [-12, 46], [52, 48], [30, -12]]),
    ],
  }
}

function officeModel(project: Project, typ: PlanSheet): TourModel {
  return {
    id: `${project.id}-office`, style: 'office', width: 120, depth: 80, baseElevation: 48,
    levels: [{
      name: 'Typical floor', height: 12, fill: 'Open office', objects: officeObjects(),
      rooms: [
        ...[0, 1, 2, 3].map((i): Room => [i * 15, 0, 15, 16, `Meeting ${i + 1}`, 'glass']),
        [46, 26, 28, 28, 'Core', 'core'],
      ],
    }],
    lot: { minX: 0, minY: 0, maxX: 120, maxY: 80 },
    start: { x: 30, y: 74, level: 0, facing: 0 },
    sources: [typ],
  }
}

function warehouseModel(project: Project, plan: PlanSheet): TourModel {
  const docks: ExteriorOpening[] = Array.from({ length: 12 }, (_, i) => ({ side: 'S', from: 14.5 + i * 18.2, to: 26.9 + i * 18.2, kind: 'dock' }))
  return {
    id: `${project.id}-warehouse`, style: 'warehouse', width: 240, depth: 145, baseElevation: 0,
    levels: [{
      name: 'Warehouse floor', height: 40, fill: 'Racking hall', objects: warehouseObjects(),
      rooms: [[4, 4, 29, 40, 'Site office']], roomHeights: { 'Site office': 10 },
      openings: [...docks, { side: 'W', from: 60, to: 64, kind: 'door' }],
    }],
    lot: { minX: -30, minY: -20, maxX: 270, maxY: 200 },
    start: { x: 120, y: 130, level: 0, facing: 0 },
    sources: [plan],
    outdoor: trees([[-20, -10], [-20, 60], [-20, 130], [260, -10], [260, 80], [260, 170]]),
  }
}

/** Builds the walk-through model from a project's uploaded plan sheets, if it has floor plans. */
export function tourModelFor(project: Project): TourModel | null {
  const latest = (kind: PlanSheet['drawing']) => project.plans.filter((s) => s.drawing === kind && s.status !== 'Superseded')[0]
  const gf = latest('res-gf')
  if (gf) return houseModel(project, gf, latest('res-ff'))
  const typ = latest('com-typ')
  if (typ) return officeModel(project, typ)
  const wh = latest('wh-plan')
  if (wh) return warehouseModel(project, wh)
  return null
}

/** Plan sheets that a 3D tour can be generated from. */
export const TOURABLE: PlanSheet['drawing'][] = ['res-gf', 'res-ff', 'com-typ', 'wh-plan']
