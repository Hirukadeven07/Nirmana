import * as THREE from 'three'
import {
  footprint, isEnclosed, isExteriorEdge,
  type HousePlan, type PlanRoom, type RoomType, type Side,
} from '../../data/housePlan'
import { pitchedRoof, SLAB_T } from './buildHouse'
import { boxGeometry, ceilingKind, FinishLibrary, floorKind, textureFeet, wallKind } from './finishes'
import { furnishRoom, type Rect } from './furnish'

export type { Rect } from './furnish'

/*
 * Builds a walkable, furnished interior from a HousePlan. Unlike the orbit model this keeps plan coordinates
 * (x east, z south, one unit = one foot), cuts real doorways between rooms, textures every surface from the
 * room's listed finishes, and returns the collision boxes and stair geometry the walker needs.
 */

export const EYE = 5.4
const FLOOR_T = 0.12
const DOOR_W = 3
const DOOR_H = 7
const CLEAR_DEPTH = 3.8

interface Op { a: number; b: number; sill: number; head: number; kind: 'door' | 'arch' | 'window' }

export interface WalkRoom {
  level: number
  room: PlanRoom
  /** Centre of the ceiling, where a light hangs. */
  x: number
  z: number
}

export interface StairInfo {
  level: number
  room: PlanRoom
  alongZ: boolean
  base: number
  rise: number
  /** Distances in feet along (L) and across (W) the flight area; origin at the start edge. */
  L: number
  W: number
  run: number
  going: number
  steps: number
  stepRise: number
  /** World coordinate of the start edge and of the across origin. */
  u0: number
  v0: number
}

export interface WalkScene {
  root: THREE.Group
  colliders: Rect[][]
  rooms: WalkRoom[][]
  levelBase: number[]
  levelNames: string[]
  stairs: StairInfo[]
  plotRect: Rect
  start: { x: number; z: number; yaw: number; level: number }
  centre: THREE.Vector3
  size: number
  roomAt: (x: number, z: number, level: number) => WalkRoom | undefined
  surfaceAt: (x: number, z: number, level: number) => { elev: number; level: number }
  walkable: (x: number, z: number, level: number) => boolean
  dispose: () => void
}

export const rectDist = (x: number, z: number, r: Rect) => Math.hypot(Math.max(r.x1 - x, 0, x - r.x2), Math.max(r.y1 - z, 0, z - r.y2))

/** How naturally two room types connect through a doorway; 3 and above are always opened. */
const AFFINITY: Record<string, number> = {
  'circulation|circulation': 3, 'circulation|living': 3, 'circulation|kitchen': 3, 'circulation|study': 3, 'circulation|commercial': 3,
  'bedroom|circulation': 3, 'circulation|wet': 3, 'circulation|utility': 2, 'circulation|outdoor': 3, 'circulation|stair': 4,
  'living|living': 3, 'kitchen|living': 3, 'living|study': 2, 'bedroom|living': 1, 'living|wet': 0.6, 'living|utility': 1,
  'living|outdoor': 3, 'living|stair': 3, 'bedroom|wet': 2, 'bedroom|utility': 1.5, 'bedroom|outdoor': 3, 'bedroom|study': 1,
  'bedroom|bedroom': 0.4, 'bedroom|kitchen': 0.5, 'bedroom|stair': 1, 'kitchen|utility': 2, 'kitchen|outdoor': 1, 'kitchen|wet': 0.3,
  'kitchen|stair': 1, 'outdoor|study': 2, 'study|wet': 0.3, 'study|utility': 0.5, 'study|stair': 1, 'outdoor|utility': 0.3,
  'utility|wet': 0.5, 'utility|utility': 1, 'commercial|commercial': 3, 'commercial|outdoor': 3, 'commercial|living': 2,
  'commercial|kitchen': 1, 'commercial|utility': 1, 'commercial|wet': 1, 'commercial|stair': 3, 'stair|wet': 0.3, 'stair|utility': 0.5,
}
const affinity = (a: RoomType, b: RoomType) => AFFINITY[[a, b].sort().join('|')] ?? 0.2
const OPEN_PLAN: RoomType[] = ['living', 'kitchen', 'circulation', 'commercial', 'outdoor']

export function buildWalk(plan: HousePlan): WalkScene {
  const lib = new FinishLibrary()
  const geos: THREE.BufferGeometry[] = []
  const ownMaterials: THREE.Material[] = []
  const root = new THREE.Group()
  const t = plan.wallThickness
  const nFloors = plan.floors.length
  const colliders: Rect[][] = plan.floors.map(() => [])
  const walkRooms: WalkRoom[][] = plan.floors.map(() => [])
  const stairs: StairInfo[] = []
  const levelBase: number[] = []
  let yy = plan.plinth
  plan.floors.forEach((_, i) => { if (i > 0) yy += plan.floors[i - 1]!.height; levelBase.push(yy) })

  const track = (g: THREE.BufferGeometry) => { geos.push(g) }
  /** A box between two corners, textured at real scale. */
  const boxAt = (parent: THREE.Object3D, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, mat: THREE.Material | THREE.Material[], feet = 6, shadow = true) => {
    const geo = boxGeometry(x2 - x1, y2 - y1, z2 - z1, feet)
    track(geo)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  const plain = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => lib.plain(c, o)
  const GLASS = plain('#9fcbe6', { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false })
  const FRAME = plain('#6b4a2f', { roughness: 0.6 })
  const TRIM = plain('#efe9dc', { roughness: 0.6 })
  const CONCRETE = plain('#a9a59c', { roughness: 0.95 })
  const EXTERIOR = lib.get('exterior', '#e8dcc2')

  /* ── Site ── */
  const plotX1 = -plan.setback.x
  const plotZ1 = -plan.setback.y
  const plotRect: Rect = { x1: plotX1, y1: plotZ1, x2: plotX1 + plan.plot.w, y2: plotZ1 + plan.plot.d }
  const outer = boxAt(root, plotX1 - 150, -0.6, plotZ1 - 150, plotRect.x2 + 150, -0.05, plotRect.y2 + 150, plain('#9bb67c', { roughness: 1 }), 20, false)
  outer.castShadow = false
  boxAt(root, plotRect.x1, -0.5, plotRect.y1, plotRect.x2, 0, plotRect.y2, plain('#7fa35b', { roughness: 1 }), 20, false)
  const BW = 0.7
  const bwMat = plain('#d9d3c6', { roughness: 0.9 })
  boxAt(root, plotRect.x1, 0, plotRect.y1, plotRect.x2, 5, plotRect.y1 + BW, bwMat)
  boxAt(root, plotRect.x1, 0, plotRect.y2 - BW, plotRect.x2, 5, plotRect.y2, bwMat)
  boxAt(root, plotRect.x1, 0, plotRect.y1 + BW, plotRect.x1 + BW, 5, plotRect.y2 - BW, bwMat)
  boxAt(root, plotRect.x2 - BW, 0, plotRect.y1 + BW, plotRect.x2, 5, plotRect.y2 - BW, bwMat)

  const everyRoom = plan.floors.flatMap((f) => f.rooms)
  const houseRect = everyRoom.length
    ? { x1: Math.min(...everyRoom.map((r) => r.x)), y1: Math.min(...everyRoom.map((r) => r.y)), x2: Math.max(...everyRoom.map((r) => r.x + r.w)), y2: Math.max(...everyRoom.map((r) => r.y + r.d)) }
    : { x1: 0, y1: 0, x2: 10, y2: 10 }
  // Trees in the open margins of the plot.
  const treeSpots: [number, number][] = []
  for (const fx of [0.12, 0.5, 0.88]) for (const fz of [0.12, 0.5, 0.88]) {
    const x = plotRect.x1 + plan.plot.w * fx
    const z = plotRect.y1 + plan.plot.d * fz
    if (x > houseRect.x1 - 5 && x < houseRect.x2 + 5 && z > houseRect.y1 - 5 && z < houseRect.y2 + 5) continue
    treeSpots.push([x, z])
  }
  const trunkMat = plain('#6a4a30', { roughness: 0.9 })
  const leafMat = plain('#4f8040', { roughness: 0.95 })
  for (const [x, z] of treeSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 8), trunkMat)
    trunk.position.set(x, 3.5, z)
    trunk.castShadow = true
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6, 1), leafMat)
    crown.position.set(x, 9, z)
    crown.castShadow = true
    track(trunk.geometry); track(crown.geometry)
    root.add(trunk, crown)
  }

  /* ── Floors ── */
  const overlapsCentre = (r: PlanRoom, others: PlanRoom[]) => others.some((o) => o.type !== 'stair' && r.x + r.w / 2 > o.x && r.x + r.w / 2 < o.x + o.w && r.y + r.d / 2 > o.y && r.y + r.d / 2 < o.y + o.d)
  const touchesOutdoor = (r: PlanRoom, side: Side, rooms: PlanRoom[]) => {
    const mid = side === 'N' ? [r.x + r.w / 2, r.y - 0.5] : side === 'S' ? [r.x + r.w / 2, r.y + r.d + 0.5] : side === 'W' ? [r.x - 0.5, r.y + r.d / 2] : [r.x + r.w + 0.5, r.y + r.d / 2]
    return rooms.some((o) => o !== r && o.type === 'outdoor' && mid[0]! > o.x && mid[0]! < o.x + o.w && mid[1]! > o.y && mid[1]! < o.y + o.d)
  }

  plan.floors.forEach((floor, level) => {
    const base = levelBase[level]!
    const g = new THREE.Group()
    root.add(g)
    const rooms = floor.rooms
    const wallH = floor.height - SLAB_T
    const ceilY = base + wallH
    const above = plan.floors[level + 1]?.rooms ?? []
    const hasUpper = level < nFloors - 1

    interface RI { r: PlanRoom; enclosed: boolean; thick: Record<Side, number>; ext: Record<Side, boolean>; ops: Record<Side, Op[]>; clear: Rect[]; doors: number }
    const sides: Side[] = ['N', 'S', 'E', 'W']
    const info: RI[] = rooms.map((r) => {
      const ext = {} as Record<Side, boolean>
      const thick = {} as Record<Side, number>
      for (const s of sides) { ext[s] = isExteriorEdge(r, s, rooms); thick[s] = ext[s] ? t : t / 2 }
      return { r, enclosed: isEnclosed(r), thick, ext, ops: { N: [], S: [], E: [], W: [] }, clear: [], doors: 0 }
    })
    const stairEntry = (r: PlanRoom): Side => (r.d >= r.w ? 'S' : 'E')

    /* Doorways: open every natural connection, then add whatever else keeps the floor connected. */
    interface Edge { i: number; j: number; si: Side; sj: Side; lo: number; hi: number; w: number }
    const edges: Edge[] = []
    for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
      const A = rooms[i]!, B = rooms[j]!
      if (A.type === 'outdoor' && B.type === 'outdoor') continue
      if ((A.type === 'stair' && B.type === 'outdoor') || (B.type === 'stair' && A.type === 'outdoor')) continue
      const E = 0.05
      const found: { si: Side; sj: Side; lo: number; hi: number }[] = []
      const xo = [Math.max(A.x, B.x), Math.min(A.x + A.w, B.x + B.w)] as const
      const yo = [Math.max(A.y, B.y), Math.min(A.y + A.d, B.y + B.d)] as const
      if (Math.abs(A.y - (B.y + B.d)) < E && xo[1] - xo[0] > 0) found.push({ si: 'N', sj: 'S', lo: xo[0], hi: xo[1] })
      if (Math.abs(A.y + A.d - B.y) < E && xo[1] - xo[0] > 0) found.push({ si: 'S', sj: 'N', lo: xo[0], hi: xo[1] })
      if (Math.abs(A.x - (B.x + B.w)) < E && yo[1] - yo[0] > 0) found.push({ si: 'W', sj: 'E', lo: yo[0], hi: yo[1] })
      if (Math.abs(A.x + A.w - B.x) < E && yo[1] - yo[0] > 0) found.push({ si: 'E', sj: 'W', lo: yo[0], hi: yo[1] })
      for (const f of found) {
        if (A.type === 'stair' && f.si !== stairEntry(A)) continue
        if (B.type === 'stair' && f.sj !== stairEntry(B)) continue
        if (f.hi - f.lo < DOOR_W + 0.6) continue
        edges.push({ i, j, ...f, w: affinity(A.type, B.type) })
      }
    }
    const parent = rooms.map((_, i) => i)
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
    const addDoor = (e: Edge) => {
      const A = rooms[e.i]!, B = rooms[e.j]!
      const len = e.hi - e.lo
      const mid = (e.lo + e.hi) / 2
      let op: Op
      if (A.type === 'stair' || B.type === 'stair') op = { a: e.lo + 0.6, b: e.hi - 0.6, sill: 0, head: Math.min(DOOR_H + 0.2, wallH - 0.3), kind: 'arch' }
      else if (OPEN_PLAN.includes(A.type) && OPEN_PLAN.includes(B.type) && len >= 6) {
        const w = Math.min(len - 2, 6)
        op = { a: mid - w / 2, b: mid + w / 2, sill: 0, head: Math.min(DOOR_H + 0.5, wallH - 0.3), kind: 'arch' }
      } else op = { a: mid - DOOR_W / 2, b: mid + DOOR_W / 2, sill: 0, head: DOOR_H, kind: 'door' }
      for (const [idx, side] of [[e.i, e.si], [e.j, e.sj]] as [number, Side][]) {
        if (rooms[idx]!.type !== 'outdoor') info[idx]!.ops[side].push(op)
        info[idx]!.doors++
      }
      // Keep furniture out of the doorway, on both sides of the wall.
      const horizontal = e.si === 'N' || e.si === 'S'
      const line = e.si === 'N' ? A.y : e.si === 'S' ? A.y + A.d : e.si === 'W' ? A.x : A.x + A.w
      const zone: Rect = horizontal
        ? { x1: op.a - 0.5, y1: line - CLEAR_DEPTH, x2: op.b + 0.5, y2: line + CLEAR_DEPTH }
        : { x1: line - CLEAR_DEPTH, y1: op.a - 0.5, x2: line + CLEAR_DEPTH, y2: op.b + 0.5 }
      info[e.i]!.clear.push(zone)
      info[e.j]!.clear.push(zone)
      parent[find(e.i)] = find(e.j)
      e.w = -1
    }
    const wetBlocked = (e: Edge) => (rooms[e.i]!.type === 'wet' && info[e.i]!.doors > 0) || (rooms[e.j]!.type === 'wet' && info[e.j]!.doors > 0)
    for (const e of edges) if (e.w >= 3 && !wetBlocked(e)) addDoor(e)
    const spine = rooms.map((_, i) => i).filter((i) => info[i]!.enclosed)
    for (let guard = 0; guard < 60; guard++) {
      if (new Set(spine.map(find)).size <= 1) break
      let best: Edge | null = null
      let bestScore = 0
      for (const e of edges) {
        if (e.w < 0 || find(e.i) === find(e.j)) continue
        const score = e.w * (wetBlocked(e) ? 0.1 : 1) * 100 + (e.hi - e.lo)
        if (e.w > 0 && score > bestScore) { best = e; bestScore = score }
      }
      if (!best) break
      addDoor(best)
    }

    /* Windows on external walls, in the largest stretch the doors leave free. */
    for (const ri of info) {
      if (!ri.enclosed || ri.r.type === 'stair') continue
      for (const s of sides) {
        if (!ri.ext[s]) continue
        const horizontal = s === 'N' || s === 'S'
        const r = ri.r
        const r0 = horizontal ? r.x + 0.5 : r.y + 0.5
        const r1 = horizontal ? r.x + r.w - 0.5 : r.y + r.d - 0.5
        let lo = r0, bestGap: [number, number] = [r0, r0]
        for (const o of [...ri.ops[s]].sort((p, q) => p.a - q.a)) { if (o.a - lo > bestGap[1] - bestGap[0]) bestGap = [lo, o.a]; lo = Math.max(lo, o.b) }
        if (r1 - lo > bestGap[1] - bestGap[0]) bestGap = [lo, r1]
        const gap = bestGap[1] - bestGap[0]
        const wet = r.type === 'wet'
        const w = wet ? 2 : Math.min(gap - 1.5, Math.max(3, gap * 0.4), 6)
        if (w < 1.5) continue
        const mid = (bestGap[0] + bestGap[1]) / 2
        ri.ops[s].push({ a: mid - w / 2, b: mid + w / 2, sill: wet ? 5 : 3, head: DOOR_H, kind: 'window' })
      }
    }

    /* Rooms. */
    for (const ri of info) {
      const r = ri.r
      const outdoor = r.type === 'outdoor'
      const fy = outdoor && level === 0 ? base - 0.5 : base
      const fKind = floorKind(r.floorFinish)
      const floorMat = lib.get(fKind)
      const isVoid = r.type === 'stair' && hasUpper

      // Floor finish, slab and plinth.
      if (!(r.type === 'stair' && level > 0)) {
        if (outdoor && level === 0) boxAt(g, r.x, 0, r.y, r.x + r.w, fy, r.y + r.d, floorMat, textureFeet(fKind), false).castShadow = false
        else boxAt(g, r.x, fy - FLOOR_T, r.y, r.x + r.w, fy, r.y + r.d, floorMat, textureFeet(fKind), false)
        if (!outdoor && level === 0) boxAt(g, r.x, 0, r.y, r.x + r.w, base - FLOOR_T, r.y + r.d, CONCRETE, 6, false)
      }
      if (level > 0 && r.type !== 'stair') boxAt(g, r.x, base - SLAB_T, r.y, r.x + r.w, base - FLOOR_T, r.y + r.d, CONCRETE, 6)

      // Ceiling: always indoors (except over the stair void), outdoors only where something sits above.
      const cKind = ceilingKind(r.ceiling)
      const covered = outdoor ? overlapsCentre(r, above) : true
      if (!isVoid && covered && cKind !== 'open') {
        const cm = lib.get(cKind)
        const sideMat = CONCRETE
        boxAt(g, r.x, ceilY - 0.08, r.y, r.x + r.w, ceilY, r.y + r.d, [sideMat, sideMat, sideMat, cm, sideMat, sideMat], textureFeet(cKind), false)
      }

      // Columns that carry the floor above a porch or verandah.
      if (outdoor && level === 0 && hasUpper) {
        const c = 0.9
        for (const [px, py] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]] as [number, number][]) {
          const inside = rooms.some((o) => o !== r && isEnclosed(o) && px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.d)
          const up = above.some((o) => px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.d)
          if (inside || !up) continue
          const x1 = Math.min(Math.max(px - c / 2, r.x), r.x + r.w - c)
          const z1 = Math.min(Math.max(py - c / 2, r.y), r.y + r.d - c)
          boxAt(g, x1, fy, z1, x1 + c, ceilY, z1 + c, TRIM)
          colliders[level]!.push({ x1, y1: z1, x2: x1 + c, y2: z1 + c })
        }
      }

      // Parapet round the open edges of upper-floor balconies and terraces.
      if (outdoor && level > 0) {
        for (const s of sides) {
          if (!ri.ext[s] || touchesOutdoor(r, s, rooms)) continue
          const pt = 0.5
          const rect: Rect = s === 'N' ? { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y + pt } : s === 'S' ? { x1: r.x, y1: r.y + r.d - pt, x2: r.x + r.w, y2: r.y + r.d } : s === 'W' ? { x1: r.x, y1: r.y, x2: r.x + pt, y2: r.y + r.d } : { x1: r.x + r.w - pt, y1: r.y, x2: r.x + r.w, y2: r.y + r.d }
          boxAt(g, rect.x1, base, rect.y1, rect.x2, base + 3.2, rect.y2, EXTERIOR)
          colliders[level]!.push(rect)
        }
      }

      if (!outdoor) {
        buildWalls(g, ri, level, base, wallH)
        // A ceiling light fixture, one per roughly 110 sq ft.
        if (r.type !== 'stair' && covered) {
          const n = r.w * r.d > 220 ? 2 : 1
          const bulb = plain('#fff4d6', { emissive: new THREE.Color('#fff0c4'), emissiveIntensity: 1.4, roughness: 0.4 })
          for (let k = 0; k < n; k++) {
            const lx = n === 1 ? r.x + r.w / 2 : r.x + r.w * (k === 0 ? 0.3 : 0.7)
            const geo = new THREE.CylinderGeometry(0.7, 0.7, 0.1, 20)
            track(geo)
            const m = new THREE.Mesh(geo, bulb)
            m.position.set(lx, ceilY - 0.14, r.y + r.d / 2)
            g.add(m)
          }
        }
      }
      walkRooms[level]!.push({ level, room: r, x: r.x + r.w / 2, z: r.y + r.d / 2 })

      // Furniture.
      if (r.type !== 'stair') {
        const b: Rect = outdoor
          ? { x1: r.x + 0.8, y1: r.y + 0.8, x2: r.x + r.w - 0.8, y2: r.y + r.d - 0.8 }
          : { x1: r.x + ri.thick.W + 0.3, y1: r.y + ri.thick.N + 0.3, x2: r.x + r.w - ri.thick.E - 0.3, y2: r.y + r.d - ri.thick.S - 0.3 }
        const f = furnishRoom({ room: r, base: fy, bounds: b, clear: ri.clear, ground: level === 0, lib, track })
        g.add(f.group)
        colliders[level]!.push(...f.rects)
      }
    }

    /* Stairs up to the next floor. */
    if (hasUpper) for (const ri of info) if (ri.r.type === 'stair' && above.some((o) => o.type === 'stair' && Math.abs(o.x - ri.r.x) < 1 && Math.abs(o.y - ri.r.y) < 1)) buildStair(g, ri.r, ri.thick, level, base, floor.height)
  })

  /** Draws one room's walls, cutting the doorways and windows planned for them. */
  function buildWalls(g: THREE.Group, ri: { r: PlanRoom; thick: Record<Side, number>; ext: Record<Side, boolean>; ops: Record<Side, Op[]> }, level: number, base: number, wallH: number) {
    const r = ri.r
    const innerKind = wallKind(r.wallFinish)
    const accent = ''
    const innerMat = lib.get(innerKind === 'dado' ? 'emulsion' : innerKind, accent)
    const tileMat = lib.get('tile')
    const feetOf = (k: string) => textureFeet(k)
    for (const side of ['N', 'S', 'W', 'E'] as Side[]) {
      const horizontal = side === 'N' || side === 'S'
      const th = ri.thick[side]
      const r0 = horizontal ? r.x : r.y + ri.thick.N
      const r1 = horizontal ? r.x + r.w : r.y + r.d - ri.thick.S
      const outIdx = side === 'N' ? 5 : side === 'S' ? 4 : side === 'W' ? 1 : 0
      /** x/z rectangle of a layer of the wall: `off` in from the outer face, `dep` deep. */
      const layer = (off: number, dep: number, p0: number, p1: number): Rect => {
        if (side === 'N') return { x1: p0, y1: r.y + off, x2: p1, y2: r.y + off + dep }
        if (side === 'S') return { x1: p0, y1: r.y + r.d - off - dep, x2: p1, y2: r.y + r.d - off }
        if (side === 'W') return { x1: r.x + off, y1: p0, x2: r.x + off + dep, y2: p1 }
        return { x1: r.x + r.w - off - dep, y1: p0, x2: r.x + r.w - off, y2: p1 }
      }
      const mats = (inner: THREE.Material) => {
        const m = [inner, inner, inner, inner, inner, inner]
        m[outIdx] = ri.ext[side] ? EXTERIOR : inner
        return m
      }
      const piece = (p0: number, p1: number, y0: number, y1: number, solid: boolean) => {
        if (p1 - p0 < 0.02 || y1 - y0 < 0.02) return
        const rc = layer(0, th, p0, p1)
        const parts: [number, number, THREE.Material, number][] = innerKind === 'dado'
          ? [[y0, Math.min(y1, 4), tileMat, feetOf('tile')], [Math.max(y0, 4), y1, innerMat, feetOf('emulsion')]]
          : [[y0, y1, innerKind === 'tile' ? tileMat : innerMat, feetOf(innerKind)]]
        for (const [a, b, m, ft] of parts) if (b - a > 0.02) boxAt(g, rc.x1, base + a, rc.y1, rc.x2, base + b, rc.y2, mats(m), ft)
        if (solid && y0 < 4.5) colliders[level]!.push(rc)
      }
      const ops = ri.ops[side].filter((o) => o.b > r0 && o.a < r1).sort((p, q) => p.a - q.a)
      let cur = r0
      for (const op of ops) {
        const a = Math.max(op.a, cur)
        const b = Math.min(op.b, r1)
        if (b - a < 0.3) continue
        piece(cur, a, 0, wallH, true)
        if (op.sill > 0) piece(a, b, 0, op.sill, true)
        if (op.head < wallH) piece(a, b, op.head, wallH, false)
        const head = Math.min(op.head, wallH)
        if (op.kind === 'window') {
          const gl = layer(th / 2 - 0.05, 0.1, a, b)
          boxAt(g, gl.x1, base + op.sill, gl.y1, gl.x2, base + head, gl.y2, GLASS, 4, false)
          const fr = (p0: number, p1: number, y0: number, y1: number) => { const f = layer(-0.04, th + 0.08, p0, p1); boxAt(g, f.x1, base + y0, f.y1, f.x2, base + y1, f.y2, FRAME, 4) }
          fr(a, b, op.sill, op.sill + 0.22); fr(a, b, head - 0.22, head)
          fr(a, a + 0.2, op.sill, head); fr(b - 0.2, b, op.sill, head)
          fr((a + b) / 2 - 0.08, (a + b) / 2 + 0.08, op.sill, head)
          colliders[level]!.push(layer(0, th, a, b))
        } else {
          const tr = (p0: number, p1: number, y0: number, y1: number) => { const f = layer(-0.05, th + 0.1, p0, p1); boxAt(g, f.x1, base + y0, f.y1, f.x2, base + y1, f.y2, TRIM, 4) }
          tr(a, a + 0.2, 0, head); tr(b - 0.2, b, 0, head); tr(a, b, head - 0.25, head)
        }
        cur = Math.max(cur, b)
      }
      piece(cur, r1, 0, wallH, true)
    }
  }

  /** Dog-leg stair with a mid landing, matching the orbit model. Records how to read heights off it. */
  function buildStair(g: THREE.Group, r: PlanRoom, th: Record<Side, number>, level: number, base: number, rise: number) {
    const alongZ = r.d >= r.w
    const L = alongZ ? r.d - th.N - th.S : r.w - th.W - th.E
    const W = alongZ ? r.w - th.W - th.E : r.d - th.N - th.S
    const run = L - 3.2
    if (run < 4 || W < 3) return
    const steps = 8
    const going = run / steps
    const stepRise = rise / 2 / steps
    const u0 = alongZ ? r.y + r.d - th.S : r.x + r.w - th.E
    const v0 = alongZ ? r.x + th.W : r.y + th.N
    const map = (ua: number, ub: number, va: number, vb: number): Rect => alongZ
      ? { x1: v0 + va, y1: u0 - ub, x2: v0 + vb, y2: u0 - ua }
      : { x1: u0 - ub, y1: v0 + va, x2: u0 - ua, y2: v0 + vb }
    const tread = lib.get('granite')
    const spine = 0.15
    const half = W / 2
    const box = (rc: Rect, y1: number, mat: THREE.Material) => boxAt(g, rc.x1, base, rc.y1, rc.x2, base + y1, rc.y2, mat, 4)
    for (let s = 0; s < steps; s++) {
      box(map(s * going, (s + 1) * going, 0, half - spine / 2), (s + 1) * stepRise, tread)
      box(map(run - (s + 1) * going, run - s * going, half + spine / 2, W), rise / 2 + (s + 1) * stepRise, tread)
    }
    box(map(run, L, 0, W), rise / 2, plain('#cfc8ba', { roughness: 0.8 }))
    // Glass balustrade between the two flights.
    const sp = map(0, run, half - spine / 2, half + spine / 2)
    boxAt(g, sp.x1, base, sp.y1, sp.x2, base + rise / 2 + 3.2, sp.y2, GLASS, 4, false)
    boxAt(g, sp.x1 - 0.05, base + rise / 2 + 3.1, sp.y1 - 0.05, sp.x2 + 0.05, base + rise / 2 + 3.3, sp.y2 + 0.05, FRAME, 4)
    colliders[level]!.push(sp)
    colliders[level + 1]?.push(sp)
    stairs.push({ level, room: r, alongZ, base, rise, L, W, run, going, steps, stepRise, u0, v0 })
  }

  /* ── Roof ── */
  const top = plan.floors[nFloors - 1]
  if (top) {
    const fp = footprint(top.rooms)
    const topY = levelBase[nFloors - 1]! + top.height - SLAB_T
    const ry = topY + 0.35
    boxAt(root, fp.x, topY, fp.y, fp.x + fp.w, ry, fp.y + fp.d, plain('#d8d2c6', { roughness: 0.9 }))
    const o = plan.roof.overhang
    if (plan.roof.type === 'flat') {
      const deck = plain('#bdb7ab', { roughness: 0.9 })
      boxAt(root, fp.x - o, ry, fp.y - o, fp.x + fp.w + o, ry + 0.6, fp.y + fp.d + o, deck)
      const p = 0.5, par = plain('#e8e2d4', { roughness: 0.9 })
      boxAt(root, fp.x - o, ry + 0.6, fp.y - o, fp.x + fp.w + o, ry + 3.6, fp.y - o + p, par)
      boxAt(root, fp.x - o, ry + 0.6, fp.y + fp.d + o - p, fp.x + fp.w + o, ry + 3.6, fp.y + fp.d + o, par)
      boxAt(root, fp.x - o, ry + 0.6, fp.y - o + p, fp.x - o + p, ry + 3.6, fp.y + fp.d + o - p, par)
      boxAt(root, fp.x + fp.w + o - p, ry + 0.6, fp.y - o + p, fp.x + fp.w + o, ry + 3.6, fp.y + fp.d + o - p, par)
    } else {
      const roofMat = new THREE.MeshStandardMaterial({ color: '#b4573a', roughness: 0.75, side: THREE.DoubleSide, flatShading: true })
      const geo = pitchedRoof(fp.w + 2 * o, fp.d + 2 * o, plan.roof.pitch, plan.roof.type)
      track(geo)
      const mesh = new THREE.Mesh(geo, roofMat)
      mesh.position.set(fp.x + fp.w / 2, ry, fp.y + fp.d / 2)
      mesh.castShadow = true
      mesh.receiveShadow = true
      root.add(mesh)
      if (plan.roof.type === 'gable') {
        const gg = pitchedRoof(fp.w, fp.d, plan.roof.pitch, 'gable', true)
        track(gg)
        const gm = new THREE.Mesh(gg, plain('#f3efe6', { roughness: 0.9, side: THREE.DoubleSide }))
        gm.position.copy(mesh.position)
        gm.castShadow = true
        root.add(gm)
      }
      ownMaterials.push(roofMat)
    }
  }

  /* ── Queries ── */
  const roomsByLevel = walkRooms
  const roomAt = (x: number, z: number, level: number) => {
    let best: WalkRoom | undefined
    for (const w of roomsByLevel[level] ?? []) {
      const r = w.room
      if (x < r.x - 0.01 || x > r.x + r.w + 0.01 || z < r.y - 0.01 || z > r.y + r.d + 0.01) continue
      if (!best || r.w * r.d < best.room.w * best.room.d) best = w
    }
    return best
  }
  const stairAt = (x: number, z: number, level: number) => {
    for (const s of stairs) {
      if (s.level !== level && s.level !== level - 1) continue
      const u = s.alongZ ? s.u0 - z : s.u0 - x
      const v = s.alongZ ? x - s.v0 : z - s.v0
      if (u >= -0.01 && u <= s.L && v >= 0 && v <= s.W) return { s, u, v }
    }
    return null
  }
  const surfaceAt = (x: number, z: number, level: number) => {
    const hit = stairAt(x, z, level)
    if (hit) {
      const { s, u, v } = hit
      let h: number
      if (u > s.run) h = s.rise / 2
      else if (v < s.W / 2) h = (Math.min(s.steps - 1, Math.max(0, Math.floor(u / s.going))) + 1) * s.stepRise
      else h = s.rise / 2 + (Math.min(s.steps - 1, Math.max(0, Math.floor((s.run - u) / s.going))) + 1) * s.stepRise
      return { elev: s.base + h, level: h > s.rise / 2 + 0.01 ? s.level + 1 : s.level }
    }
    const room = roomAt(x, z, level)
    if (!room) return { elev: level === 0 ? 0 : levelBase[level]!, level }
    return { elev: room.room.type === 'outdoor' && level === 0 ? levelBase[0]! - 0.5 : levelBase[level]!, level }
  }
  const walkable = (x: number, z: number, level: number) => {
    if (level === 0) return x > plotRect.x1 + 1.2 && x < plotRect.x2 - 1.2 && z > plotRect.y1 + 1.2 && z < plotRect.y2 - 1.2
    return !!roomAt(x, z, level) || !!stairAt(x, z, level)
  }

  /* ── Start: the front verandah (or first room), looking into the house ── */
  const startRoom = walkRooms[0]?.find((w) => w.room.type === 'outdoor') ?? walkRooms[0]?.find((w) => w.room.type !== 'stair') ?? walkRooms[0]?.[0]
  const cx = (houseRect.x1 + houseRect.x2) / 2
  const cz = (houseRect.y1 + houseRect.y2) / 2
  const sx = startRoom?.x ?? cx
  const sz = startRoom?.z ?? cz
  const start = { x: sx, z: sz, yaw: Math.atan2(-(cx - sx), -(cz - sz)), level: 0 }
  if (!walkable(start.x, start.z, 0)) { start.x = plotRect.x1 + plan.plot.w / 2; start.z = plotRect.y1 + 3 }

  const size = Math.max(plan.plot.w, plan.plot.d, 20)
  return {
    root, colliders, rooms: walkRooms, levelBase, levelNames: plan.floors.map((f) => f.name), stairs, plotRect, start,
    centre: new THREE.Vector3((plotRect.x1 + plotRect.x2) / 2, 6, (plotRect.y1 + plotRect.y2) / 2),
    size, roomAt, surfaceAt, walkable,
    dispose: () => { geos.forEach((x) => x.dispose()); ownMaterials.forEach((m) => m.dispose()); lib.dispose() },
  }
}
