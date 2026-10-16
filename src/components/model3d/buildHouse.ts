import * as THREE from 'three'
import {
  footprint, isEnclosed, isExteriorEdge, planExtent, ROOM_TYPE_META, STATUS_META,
  type HousePlan, type PlanFloor, type PlanRoom, type Side, type WorkStatus,
} from '../../data/housePlan'

/*
 * Builds a Three.js model from a HousePlan. One plan foot is one world unit; plan x maps to
 * world x and plan y (south) maps to world z, with the house centred on the origin.
 *
 * Every clickable part sits under an object whose `userData.sectionId` matches a
 * SectionDetails id from `data/housePlan.ts` (`foundation`, `slab-N`, `stair`, `roof`, `<floor>:<room>`).
 */

export const SLAB_T = 0.6
const FLOOR_T = 0.15
const SILL = 3
const HEAD = 7

export type ColorMode = 'type' | 'status'

export interface HouseScene {
  root: THREE.Group
  base: THREE.Group
  levels: THREE.Group[]
  roof: THREE.Group
  ground: THREE.Mesh
  /** World y of each level's finished floor, before any exploded-view offset. */
  levelBase: number[]
  size: number
  setColorMode: (mode: ColorMode) => void
  /** Materials of walls on each level, for the cutaway clipping plane. */
  wallMaterials: THREE.Material[][]
  dispose: () => void
}

type Tag = 'floor' | 'wall' | 'glass' | 'struct' | 'roof' | 'stair' | 'ground'

interface PartData { tag: Tag; typeColor?: string; status?: WorkStatus }

const WALL = '#f3efe6'
const GLASS = '#8fc6e6'
const CONCRETE = '#a9a59c'
const FOOTING = '#7d756a'
const ROOF = '#b4573a'

export function buildHouse(plan: HousePlan): HouseScene {
  const root = new THREE.Group()
  const base = new THREE.Group()
  const roofGroup = new THREE.Group()
  const disposables: { dispose: () => void }[] = []
  const parts: { mesh: THREE.Mesh; data: PartData }[] = []
  const wallMaterials: THREE.Material[][] = plan.floors.map(() => [])

  const ext = planExtent(plan)
  const ox = -ext.w / 2
  const oz = -ext.d / 2
  const t = plan.wallThickness

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, data: PartData, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const geo = new THREE.BoxGeometry(Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01))
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts })
    disposables.push(geo, mat)
    const mesh = new THREE.Mesh(geo, mat)
    // Plan coordinates → world: (x, y) is the box's min corner, y is its bottom.
    mesh.position.set(ox + x + w / 2, y + h / 2, oz + z + d / 2)
    mesh.castShadow = data.tag !== 'glass'
    mesh.receiveShadow = true
    mesh.userData.part = data
    parts.push({ mesh, data })
    return mesh
  }

  const section = (id: string, parent: THREE.Object3D) => {
    const g = new THREE.Group()
    g.userData.sectionId = id
    parent.add(g)
    return g
  }

  /* ── Site ── */
  const plotW = plan.plot.w
  const plotD = plan.plot.d
  const groundGeo = new THREE.BoxGeometry(plotW, 0.4, plotD)
  const groundMat = new THREE.MeshStandardMaterial({ color: '#8fae6b', roughness: 1, transparent: true, opacity: 1 })
  disposables.push(groundGeo, groundMat)
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.position.set(ox - plan.setback.x + plotW / 2, -0.2, oz - plan.setback.y + plotD / 2)
  ground.receiveShadow = true
  ground.userData.part = { tag: 'ground' }
  root.add(ground)

  /* ── Foundation and ground slab ── */
  const ground0 = plan.floors[0]
  if (ground0) {
    const fp = footprint(ground0.rooms)
    const found = section('foundation', base)
    const fw = 2
    const fd = 3
    found.add(
      box(fp.w + fw, fd, fw, fp.x - fw / 2, -fd, fp.y - fw / 2, FOOTING, { tag: 'struct' }),
      box(fp.w + fw, fd, fw, fp.x - fw / 2, -fd, fp.y + fp.d - fw / 2, FOOTING, { tag: 'struct' }),
      box(fw, fd, fp.d, fp.x - fw / 2, -fd, fp.y, FOOTING, { tag: 'struct' }),
      box(fw, fd, fp.d, fp.x + fp.w - fw / 2, -fd, fp.y, FOOTING, { tag: 'struct' }),
    )
    // Plinth beam and slab on grade under each enclosed ground-floor room.
    const slab0 = section('slab-0', base)
    for (const r of ground0.rooms.filter(isEnclosed)) slab0.add(box(r.w, plan.plinth, r.d, r.x, 0, r.y, CONCRETE, { tag: 'struct' }))
  }

  /* ── Levels ── */
  const levels: THREE.Group[] = []
  const levelBase: number[] = []
  let y = plan.plinth
  plan.floors.forEach((floor, i) => {
    if (i > 0) y += plan.floors[i - 1]!.height
    levelBase.push(y)
    const g = new THREE.Group()
    g.userData.level = i
    root.add(g)
    levels.push(g)

    if (i > 0) {
      const slab = section(`slab-${i}`, g)
      for (const r of floor.rooms) if (r.type !== 'stair') slab.add(box(r.w, SLAB_T, r.d, r.x, y - SLAB_T, r.y, CONCRETE, { tag: 'struct' }))
    }
    for (const r of floor.rooms) buildRoom(section(`${floor.id}:${r.id}`, g), floor, r, i, y)
    if (i === 0 && plan.floors.length > 1) {
      const stair = floor.rooms.find((r) => r.type === 'stair')
      if (stair) buildStair(section('stair', g), stair, y, floor.height)
    }
  })

  function buildRoom(g: THREE.Group, floor: PlanFloor, r: PlanRoom, level: number, y: number) {
    const typeColor = ROOM_TYPE_META[r.type].color
    const outdoorGround = r.type === 'outdoor' && level === 0
    const fy = outdoorGround ? plan.plinth - 0.5 : y
    if (!(r.type === 'stair' && level > 0)) {
      g.add(box(r.w, FLOOR_T, r.d, r.x, fy, r.y, typeColor, { tag: 'floor', typeColor, status: r.status }))
    }
    if (outdoorGround) {
      // Columns at the open corners of a porch or verandah that carries the floor above.
      const above = plan.floors[1]?.rooms ?? []
      const covered = (px: number, py: number) => above.some((o) => px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.d)
      const c = 0.9
      for (const [px, py] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]] as [number, number][]) {
        const inside = floor.rooms.some((o) => o !== r && isEnclosed(o) && px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.d)
        if (inside || !covered(px, py)) continue
        const col = box(c, floor.height - SLAB_T - (fy - y), c, Math.min(Math.max(px - c / 2, r.x), r.x + r.w - c), fy, Math.min(Math.max(py - c / 2, r.y), r.y + r.d - c), '#ece6da', { tag: 'wall', status: r.status })
        wallMaterials[level]!.push(col.material as THREE.Material)
        g.add(col)
      }
      return
    }

    const half = t / 2
    const wallH = floor.height - SLAB_T
    for (const side of ['N', 'S', 'E', 'W'] as Side[]) {
      const exterior = isExteriorEdge(r, side, floor.rooms)
      if (r.type === 'outdoor') {
        // Upper-floor balconies and terraces get a parapet on their open edges only.
        if (exterior && !touchesOutdoor(r, side, floor.rooms)) wallRun(g, r, side, half, 3.2, fy, level, null, r.status, true)
        continue
      }
      let opening: Opening | null = null
      if (exterior && r.type !== 'stair') {
        const len = side === 'N' || side === 'S' ? r.w : r.d
        if (touchesOutdoor(r, side, floor.rooms)) {
          const w = Math.min(len - 2, r.type === 'wet' ? 2.5 : 6)
          opening = { a: (len - w) / 2, b: (len + w) / 2, sill: 0, head: HEAD, glass: true }
        } else {
          const w = r.type === 'wet' ? 2 : Math.min(len - 2, Math.max(3, len * 0.35))
          opening = r.type === 'wet'
            ? { a: (len - w) / 2, b: (len + w) / 2, sill: 5, head: HEAD, glass: true }
            : { a: (len - w) / 2, b: (len + w) / 2, sill: SILL, head: HEAD, glass: true }
        }
      }
      wallRun(g, r, side, half, wallH, y, level, opening, r.status, false)
    }
  }

  interface Opening { a: number; b: number; sill: number; head: number; glass: boolean }

  /** Draws one room edge as wall pieces, leaving a hole where the opening is. */
  function wallRun(g: THREE.Group, r: PlanRoom, side: Side, th: number, h: number, y: number, level: number, op: Opening | null, status: WorkStatus, parapet: boolean) {
    const horizontal = side === 'N' || side === 'S'
    const len = horizontal ? r.w : r.d
    // Pieces in run coordinates: [from, to, bottom, top]
    const pieces: [number, number, number, number][] = []
    if (!op) pieces.push([0, len, 0, h])
    else {
      pieces.push([0, op.a, 0, h], [op.b, len, 0, h])
      if (op.sill > 0) pieces.push([op.a, op.b, 0, op.sill])
      if (op.head < h) pieces.push([op.a, op.b, op.head, h])
    }
    const place = (a: number, b: number, bottom: number, top: number, color: string, data: PartData, thick = th, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const run = b - a
      const hh = top - bottom
      if (run <= 0.01 || hh <= 0.01) return
      const off = (th - thick) / 2
      let mesh: THREE.Mesh
      if (side === 'N') mesh = box(run, hh, thick, r.x + a, y + bottom, r.y + off, color, data, opts)
      else if (side === 'S') mesh = box(run, hh, thick, r.x + a, y + bottom, r.y + r.d - th + off, color, data, opts)
      else if (side === 'W') mesh = box(thick, hh, run, r.x + off, y + bottom, r.y + a, color, data, opts)
      else mesh = box(thick, hh, run, r.x + r.w - th + off, y + bottom, r.y + a, color, data, opts)
      g.add(mesh)
      if (data.tag === 'wall' || data.tag === 'glass') wallMaterials[level]!.push(mesh.material as THREE.Material)
      return mesh
    }
    // Trim the ends so perpendicular walls of the same room do not overlap.
    const trim = (a: number, b: number): [number, number] => (horizontal ? [a, b] : [Math.max(a, th), Math.min(b, len - th)])
    for (const [a, b, bottom, top] of pieces) {
      const [ta, tb] = trim(a, b)
      place(ta, tb, bottom, top, parapet ? '#e8e2d4' : WALL, { tag: 'wall', status }, th, { side: THREE.DoubleSide })
    }
    if (op?.glass) {
      place(op.a, op.b, op.sill, Math.min(op.head, h), GLASS, { tag: 'glass' }, 0.12, { transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2, depthWrite: false })
      // Timber frame line under the head.
      place(op.a, op.b, Math.min(op.head, h) - 0.25, Math.min(op.head, h), '#7a5232', { tag: 'wall', status }, th * 0.9)
    }
  }

  function touchesOutdoor(r: PlanRoom, side: Side, rooms: PlanRoom[]) {
    const mid = side === 'N' ? [r.x + r.w / 2, r.y - 0.5] : side === 'S' ? [r.x + r.w / 2, r.y + r.d + 0.5] : side === 'W' ? [r.x - 0.5, r.y + r.d / 2] : [r.x + r.w + 0.5, r.y + r.d / 2]
    return rooms.some((o) => o !== r && o.type === 'outdoor' && mid[0]! > o.x && mid[0]! < o.x + o.w && mid[1]! > o.y && mid[1]! < o.y + o.d)
  }

  /** Dog-leg stair: two flights side by side with a landing at the far end. */
  function buildStair(g: THREE.Group, r: PlanRoom, y: number, rise: number) {
    const alongZ = r.d >= r.w
    const run = (alongZ ? r.d : r.w) - 3.2
    const width = (alongZ ? r.w : r.d) / 2 - t / 2
    const steps = 8
    const stepRise = rise / 2 / steps
    const going = run / steps
    for (let s = 0; s < steps; s++) {
      const h1 = (s + 1) * stepRise
      const h2 = rise / 2 + (s + 1) * stepRise
      if (alongZ) {
        g.add(box(width, h1, going, r.x + t / 2, y, r.y + r.d - t / 2 - (s + 1) * going, '#d9d3c7', { tag: 'stair' }))
        g.add(box(width, Math.min(h2, rise - SLAB_T + 0.6), going, r.x + r.w / 2, y, r.y + 3.2 + s * going, '#d9d3c7', { tag: 'stair' }))
      } else {
        g.add(box(going, h1, width, r.x + r.w - t / 2 - (s + 1) * going, y, r.y + t / 2, '#d9d3c7', { tag: 'stair' }))
        g.add(box(going, Math.min(h2, rise - SLAB_T + 0.6), width, r.x + 3.2 + s * going, y, r.y + r.d / 2, '#d9d3c7', { tag: 'stair' }))
      }
    }
    // Mid landing.
    if (alongZ) g.add(box(r.w - t, rise / 2, 3.2 - t / 2, r.x + t / 2, y, r.y + t / 2, '#cfc8ba', { tag: 'stair' }))
    else g.add(box(3.2 - t / 2, rise / 2, r.d - t, r.x + t / 2, y, r.y + t / 2, '#cfc8ba', { tag: 'stair' }))
  }

  /* ── Roof ── */
  const top = plan.floors[plan.floors.length - 1]
  if (top) {
    const rg = section('roof', roofGroup)
    const fp = footprint(top.rooms)
    const topY = levelBase[levelBase.length - 1]! + top.height - SLAB_T
    // Ceiling slab / wall plate.
    rg.add(box(fp.w, 0.35, fp.d, fp.x, topY, fp.y, '#d8d2c6', { tag: 'roof' }))
    const o = plan.roof.overhang
    const W = fp.w + 2 * o
    const D = fp.d + 2 * o
    const cx = ox + fp.x + fp.w / 2
    const cz = oz + fp.y + fp.d / 2
    const ry = topY + 0.35
    if (plan.roof.type === 'flat') {
      rg.add(box(W, 0.6, D, fp.x - o, ry, fp.y - o, '#bdb7ab', { tag: 'roof' }))
      const p = 0.5
      rg.add(
        box(W, 3, p, fp.x - o, ry + 0.6, fp.y - o, '#e8e2d4', { tag: 'roof' }),
        box(W, 3, p, fp.x - o, ry + 0.6, fp.y - o + D - p, '#e8e2d4', { tag: 'roof' }),
        box(p, 3, D - 2 * p, fp.x - o, ry + 0.6, fp.y - o + p, '#e8e2d4', { tag: 'roof' }),
        box(p, 3, D - 2 * p, fp.x - o + W - p, ry + 0.6, fp.y - o + p, '#e8e2d4', { tag: 'roof' }),
      )
    } else {
      const geo = pitchedRoof(W, D, plan.roof.pitch, plan.roof.type)
      const mat = new THREE.MeshStandardMaterial({ color: ROOF, roughness: 0.75, side: THREE.DoubleSide, flatShading: true })
      disposables.push(geo, mat)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(cx, ry, cz)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData.part = { tag: 'roof' }
      parts.push({ mesh, data: { tag: 'roof' } })
      rg.add(mesh)
      if (plan.roof.type === 'gable') {
        // Gable end walls under the roof.
        const gw = pitchedRoof(fp.w, fp.d, plan.roof.pitch, 'gable', true)
        const gm = new THREE.MeshStandardMaterial({ color: WALL, roughness: 0.9, side: THREE.DoubleSide })
        disposables.push(gw, gm)
        const gable = new THREE.Mesh(gw, gm)
        gable.position.set(cx, ry, cz)
        gable.castShadow = true
        rg.add(gable)
      }
    }
  }
  root.add(base, roofGroup)

  const setColorMode = (mode: ColorMode) => {
    for (const { mesh, data } of parts) {
      const mat = mesh.material as THREE.MeshStandardMaterial
      if (data.tag === 'floor') mat.color.set(mode === 'status' && data.status ? STATUS_META[data.status].color : data.typeColor!)
      if (data.tag === 'wall' && data.status) mat.color.set(mode === 'status' ? new THREE.Color(WALL).lerp(new THREE.Color(STATUS_META[data.status].color), 0.45) : WALL)
      if (data.tag === 'roof' && mesh.geometry.type !== 'BoxGeometry') mat.color.set(mode === 'status' ? new THREE.Color(ROOF).lerp(new THREE.Color(STATUS_META['Not started'].color), 0.6) : ROOF)
    }
  }

  return {
    root, base, levels, roof: roofGroup, ground, levelBase, wallMaterials, setColorMode,
    size: Math.max(ext.w, ext.d, 20),
    dispose: () => disposables.forEach((d) => d.dispose()),
  }
}

/**
 * Hipped or gable roof over a W × D rectangle centred on the origin, eaves at y = 0.
 * With `gableEnds`, returns only the two vertical triangles closing a gable roof.
 */
function pitchedRoof(W: number, D: number, pitch: number, type: 'hip' | 'gable', gableEnds = false) {
  const swap = D > W
  const L = swap ? D : W // ridge runs along the longer side
  const S = swap ? W : D
  const H = (S / 2) * Math.tan((pitch * Math.PI) / 180)
  const inset = type === 'hip' ? S / 2 : 0
  const c0 = [-L / 2, 0, -S / 2], c1 = [L / 2, 0, -S / 2], c2 = [L / 2, 0, S / 2], c3 = [-L / 2, 0, S / 2]
  const r0 = [-L / 2 + inset, H, 0], r1 = [L / 2 - inset, H, 0]
  const tris: number[][] = gableEnds
    ? [[c3, c0, r0], [c1, c2, r1]].flat()
    : [
        c0, c1, r1, c0, r1, r0, // long side, -z
        c2, c3, r0, c2, r0, r1, // long side, +z
        ...(type === 'hip' ? [c3, c0, r0, c1, c2, r1] : []), // hip ends
      ]
  const pos = new Float32Array(tris.flat())
  if (swap) for (let i = 0; i < pos.length; i += 3) { const x = pos[i]!; pos[i] = pos[i + 2]!; pos[i + 2] = x }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  return geo
}
