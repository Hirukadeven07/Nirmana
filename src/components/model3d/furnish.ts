import * as THREE from 'three'
import type { PlanRoom } from '../../data/housePlan'
import { boxGeometry, type FinishLibrary } from './finishes'

/** Axis-aligned rectangle in plan feet: x runs east, y runs south. */
export interface Rect { x1: number; y1: number; x2: number; y2: number }

export interface FurnishArgs {
  room: PlanRoom
  /** World y of the finished floor the furniture stands on. */
  base: number
  /** Usable floor inside the walls. */
  bounds: Rect
  /** Door and archway zones that must stay free. */
  clear: Rect[]
  /** True for ground-floor outdoor rooms, which get a car or seating instead of indoor furniture. */
  ground: boolean
  lib: FinishLibrary
  track: (g: THREE.BufferGeometry) => void
}

type Wall = 'N' | 'S' | 'W' | 'E'
interface Item { g: THREE.Group; w: number; d: number }
interface Cand { cx: number; cz: number; rot: number }

const overlap = (a: Rect, b: Rect) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1
const OPPOSITE: Record<Wall, Wall> = { N: 'S', S: 'N', W: 'E', E: 'W' }

/** Fills a room with simple furniture suited to its type, keeping doorways clear. Returns the group and its collision boxes. */
export function furnishRoom(a: FurnishArgs): { group: THREE.Group; rects: Rect[] } {
  const { room, lib, bounds: B } = a
  const group = new THREE.Group()
  const rects: Rect[] = []
  const BW = B.x2 - B.x1
  const BH = B.y2 - B.y1
  const name = room.name.toLowerCase()
  if (BW < 4 || BH < 4 || room.type === 'stair') return { group, rects }

  const mat = (c: string, rough = 0.7, metal = 0) => lib.plain(c, { roughness: rough, metalness: metal })
  const wood = () => lib.get('wood')
  const granite = () => lib.get('granite')
  const glass = () => lib.plain('#a9d4ea', { transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false })

  /** One box inside an item: size, bottom-centre position, material. */
  const part = (g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, cast = true) => {
    const geo = boxGeometry(w, h, d, 4)
    a.track(geo)
    const mesh = new THREE.Mesh(geo, m)
    mesh.position.set(x, y + h / 2, z)
    mesh.castShadow = cast
    mesh.receiveShadow = true
    g.add(mesh)
    return mesh
  }
  const item = (w: number, d: number, build: (g: THREE.Group) => void): Item => {
    const g = new THREE.Group()
    build(g)
    return { g, w, d }
  }

  /* ── Furniture ── */
  const sofa = (w = 6.6) => item(w, 2.9, (g) => {
    const f = mat('#6f7f8c', 0.95)
    part(g, w, 1.3, 2.9, 0, 0, 0, f)
    part(g, w, 1.7, 0.8, 0, 1.3, -1.05, f)
    for (const s of [-1, 1]) part(g, 0.7, 2.1, 2.9, s * (w / 2 - 0.35), 0, 0, f)
    for (const s of [-1, 1]) part(g, w / 2 - 0.55, 0.45, 2.0, s * (w / 4 - 0.1), 1.3, 0.3, mat('#8697a4', 0.95))
  })
  const armchair = () => item(2.8, 2.8, (g) => {
    const f = mat('#a08060', 0.95)
    part(g, 2.8, 1.3, 2.8, 0, 0, 0, f)
    part(g, 2.8, 1.6, 0.7, 0, 1.3, -1.05, f)
    for (const s of [-1, 1]) part(g, 0.5, 2.0, 2.8, s * 1.15, 0, 0, f)
  })
  const coffeeTable = () => item(3.6, 2, (g) => {
    part(g, 3.6, 0.15, 2, 0, 1.3, 0, wood())
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, 0.15, 1.3, 0.15, sx * 1.6, 0, sz * 0.8, mat('#2b2b2b'))
  })
  const tvUnit = () => item(5.2, 1.5, (g) => {
    part(g, 5.2, 1.8, 1.5, 0, 0, 0, wood())
    part(g, 4.2, 2.4, 0.2, 0, 2.6, 0.1, mat('#101114', 0.2, 0.3))
    part(g, 0.8, 0.5, 0.5, 0, 1.8, 0, mat('#222'))
  })
  const chair = (g: THREE.Group, x: number, z: number, rot: number) => {
    const c = new THREE.Group()
    part(c, 1.5, 0.2, 1.5, 0, 1.5, 0, wood())
    part(c, 1.5, 1.7, 0.2, 0, 1.7, -0.65, wood())
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(c, 0.15, 1.5, 0.15, sx * 0.6, 0, sz * 0.6, wood())
    c.position.set(x, 0, z)
    c.rotation.y = rot
    g.add(c)
  }
  const diningSet = () => item(7.4, 5.4, (g) => {
    part(g, 5.6, 0.2, 3, 0, 2.4, 0, wood())
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, 0.3, 2.4, 0.3, sx * 2.5, 0, sz * 1.2, wood())
    for (const x of [-1.8, 0, 1.8]) { chair(g, x, -2.1, 0); chair(g, x, 2.1, Math.PI) }
    part(g, 0.9, 0.5, 0.9, 0, 2.6, 0, mat('#e9e3d4', 0.4))
  })
  const sideboard = () => item(5, 1.6, (g) => {
    part(g, 5, 2.8, 1.6, 0, 0, 0, wood())
    part(g, 5.1, 0.12, 1.7, 0, 2.8, 0, granite())
  })
  const plant = (s = 1.6) => item(s, s, (g) => {
    part(g, 0.9, 1, 0.9, 0, 0, 0, mat('#8a5a3c', 0.8))
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), mat('#4d7a3b', 0.9))
    a.track(leaf.geometry)
    leaf.position.set(0, 2.1, 0)
    leaf.castShadow = true
    g.add(leaf)
  })
  const bed = (stands: boolean) => {
    const w = 5.2
    const total = stands ? w + 3.8 : w
    return item(total, 6.8, (g) => {
      part(g, w + 0.2, 1, 6.8, 0, 0, 0, wood())
      part(g, w, 0.9, 6.3, 0, 1, 0.1, mat('#f1ede4', 0.95))
      part(g, w + 0.5, 3.2, 0.35, 0, 0, -3.25, wood())
      for (const s of [-1, 1]) part(g, 1.9, 0.5, 1.2, s * 1.2, 1.9, -2.3, mat('#ffffff', 0.95))
      part(g, w + 0.05, 0.2, 3.6, 0, 1.9, 1.2, mat('#7c8f97', 0.95))
      if (stands) for (const s of [-1, 1]) {
        part(g, 1.5, 1.8, 1.4, s * (w / 2 + 1), 0, -2.9, wood())
        part(g, 0.6, 0.9, 0.6, s * (w / 2 + 1), 1.8, -2.9, mat('#f3e7c4', 0.5))
      }
    })
  }
  const wardrobe = (w = 5) => item(w, 2, (g) => {
    part(g, w, 7, 2, 0, 0, 0, wood())
    for (let i = 1; i < 3; i++) part(g, 0.06, 6.6, 0.05, -w / 2 + (w * i) / 3, 0.2, 1.02, mat('#2a1c10'))
    for (const s of [-1, 1]) part(g, 0.1, 0.8, 0.1, s * 0.3, 3.2, 1.08, mat('#c9c9c9', 0.3, 0.8))
  })
  const desk = () => item(4.6, 4.2, (g) => {
    part(g, 4.6, 0.15, 2.2, 0, 2.5, -0.9, wood())
    for (const s of [-1, 1]) part(g, 0.15, 2.5, 2.1, s * 2.2, 0, -0.9, wood())
    part(g, 1.8, 1.1, 0.12, 0, 2.65, -1.4, mat('#0f1013', 0.2, 0.3))
    chair(g, 0, 1.0, Math.PI)
  })
  const bookshelf = (w = 4) => item(w, 1.1, (g) => {
    part(g, w, 6.5, 1.1, 0, 0, 0, wood())
    const colours = ['#a4443a', '#3c5c7a', '#d9b44a', '#4b7a55', '#7d5a8a']
    for (let r = 0; r < 4; r++) for (let i = 0; i < Math.floor(w / 0.55); i++) {
      part(g, 0.4, 1.1, 0.7, -w / 2 + 0.5 + i * 0.55, 0.5 + r * 1.55, 0.3, mat(colours[(i + r) % colours.length]!, 0.8))
    }
  })
  const counter = (len: number) => item(len, 2.1, (g) => {
    part(g, len, 2.9, 2.1, 0, 0, 0, mat('#e8e2d4', 0.6))
    part(g, len + 0.05, 0.12, 2.2, 0, 2.9, 0, granite())
    for (let i = 1; i < Math.floor(len / 1.6); i++) part(g, 0.04, 2.5, 0.05, -len / 2 + i * 1.6, 0.2, 1.07, mat('#8a8a8a'))
    part(g, 1.8, 0.1, 1.2, -len / 2 + Math.min(3, len / 3), 3.0, 0.2, mat('#aeb4b8', 0.3, 0.8))
    part(g, 2, 0.08, 1.6, len / 2 - Math.min(3, len / 3), 3.0, 0.1, mat('#17181a', 0.25, 0.3))
  })
  const fridge = () => item(2.7, 2.7, (g) => {
    part(g, 2.7, 6.2, 2.7, 0, 0, 0, mat('#c9ced2', 0.3, 0.8))
    part(g, 2.6, 0.04, 0.05, 0, 3.7, 1.37, mat('#555'))
  })
  const island = () => item(6, 2.8, (g) => {
    part(g, 6, 2.9, 2.8, 0, 0, 0, mat('#d8d0bd', 0.6))
    part(g, 6.2, 0.14, 3, 0, 2.9, 0, granite())
  })
  const wc = () => item(1.5, 2.4, (g) => {
    const p = mat('#f7f7f4', 0.15)
    part(g, 1.3, 1.4, 1.7, 0, 0, 0.3, p)
    part(g, 1.4, 1.3, 0.6, 0, 1.2, -0.85, p)
    part(g, 1.4, 0.12, 1.6, 0, 1.4, 0.3, p)
  })
  const basin = () => item(2, 1.5, (g) => {
    part(g, 2, 2.7, 1.5, 0, 0, 0, wood())
    part(g, 2.05, 0.1, 1.55, 0, 2.7, 0, mat('#f7f7f4', 0.15))
    part(g, 0.12, 0.5, 0.12, 0, 2.8, -0.45, mat('#c9c9c9', 0.2, 0.9))
    part(g, 1.6, 2.2, 0.06, 0, 3.8, -0.72, mat('#cfe3ec', 0.05, 0.9))
  })
  const shower = () => item(3.2, 3.2, (g) => {
    part(g, 3.2, 0.3, 3.2, 0, 0, 0, mat('#e8eaec', 0.2))
    part(g, 0.06, 6.2, 3.2, 1.58, 0, 0, glass(), false)
    part(g, 3.2, 6.2, 0.06, 0, 0, 1.58, glass(), false)
    part(g, 0.12, 0.12, 0.7, -1.4, 5.8, -1.3, mat('#c9c9c9', 0.2, 0.9))
  })
  const shelves = (w = 4) => item(w, 1.3, (g) => {
    for (const s of [-1, 1]) part(g, 0.1, 6.5, 1.3, s * (w / 2 - 0.05), 0, 0, mat('#6d6f73', 0.5, 0.6))
    for (let i = 0; i < 4; i++) {
      part(g, w, 0.08, 1.3, 0, 0.3 + i * 1.7, 0, mat('#85888c', 0.5, 0.6))
      part(g, w * 0.5, 0.9, 0.9, -w * 0.15 + (i % 2) * 0.4, 0.4 + i * 1.7, 0, mat(['#b88d5a', '#8e6f4a', '#c9a77a', '#7d6a56'][i]!, 0.9))
    }
  })
  const rack = (w = 5) => item(w, 1.8, (g) => {
    part(g, w, 0.1, 0.1, 0, 5.8, 0, mat('#c9c9c9', 0.3, 0.9))
    part(g, w, 0.08, 1.8, 0, 3.4, 0, wood())
    part(g, w, 0.08, 1.8, 0, 1.2, 0, wood())
    const cs = ['#486b8a', '#b7453d', '#e0d7c3', '#3d4a3a', '#8a7aa6', '#d0a24a']
    for (let i = 0; i < Math.floor(w / 0.45); i++) part(g, 0.12, 3.6 - (i % 3) * 0.3, 0.9, -w / 2 + 0.35 + i * 0.45, 2.1, 0, mat(cs[i % cs.length]!, 0.95))
  })
  const console_ = () => item(3.6, 1.2, (g) => {
    part(g, 3.6, 0.14, 1.2, 0, 2.5, 0, wood())
    for (const s of [-1, 1]) part(g, 0.14, 2.5, 1.1, s * 1.7, 0, 0, wood())
    part(g, 0.6, 1, 0.6, 1, 2.64, 0, mat('#6a8fa8', 0.3))
  })
  const shopCounter = () => item(8, 2.6, (g) => {
    part(g, 8, 3.5, 2.6, 0, 0, 0, wood())
    part(g, 8.2, 0.14, 2.8, 0, 3.5, 0, granite())
  })
  const car = () => item(5.8, 13.5, (g) => {
    const body = mat('#8d98a3', 0.25, 0.7)
    part(g, 5.8, 1.8, 13.5, 0, 0.8, 0, body)
    part(g, 5.2, 1.5, 6.5, 0, 2.6, -0.6, body)
    part(g, 5.3, 1.1, 6.3, 0, 2.7, -0.6, glass(), false)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, 0.7, 1.9, 1.9, sx * 2.9, 0, sz * 4.2, mat('#151515', 0.9))
  })
  const patio = () => item(5, 4.6, (g) => {
    const rd = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 20), wood())
    a.track(rd.geometry)
    rd.position.set(0, 2, 0)
    g.add(rd)
    part(g, 0.2, 2, 0.2, 0, 0, 0, mat('#2b2b2b'))
    chair(g, -1.7, 0.2, Math.PI / 2)
    chair(g, 1.7, 0.2, -Math.PI / 2)
  })
  const rug = (w: number, d: number, color: string, x: number, z: number, rot: number) => {
    const m = part(group, w, 0.04, d, 0, 0, 0, mat(color, 1), false)
    m.position.set(x, a.base + 0.03, z)
    m.rotation.y = rot
  }

  /* ── Placement ── */
  const placed: Rect[] = []
  const inBounds = (r: Rect) => r.x1 >= B.x1 - 0.01 && r.x2 <= B.x2 + 0.01 && r.y1 >= B.y1 - 0.01 && r.y2 <= B.y2 + 0.01
  const fits = (r: Rect, gap: number) => {
    if (!inBounds(r)) return false
    const grown = { x1: r.x1 - gap, y1: r.y1 - gap, x2: r.x2 + gap, y2: r.y2 + gap }
    return !a.clear.some((c) => overlap(r, c)) && !placed.some((p) => overlap(grown, p))
  }
  const walls: Wall[] = ['N', 'S', 'W', 'E']
  const FR = [0.5, 0, 1, 0.25, 0.75]
  /** Positions along one wall, backs to the wall and fronts facing into the room. */
  const along = (wall: Wall, w: number, d: number, fr = FR): Cand[] => fr.map((f) => {
    if (wall === 'N') return { cx: B.x1 + w / 2 + f * (BW - w), cz: B.y1 + d / 2, rot: 0 }
    if (wall === 'S') return { cx: B.x1 + w / 2 + f * (BW - w), cz: B.y2 - d / 2, rot: Math.PI }
    if (wall === 'W') return { cx: B.x1 + d / 2, cz: B.y1 + w / 2 + f * (BH - w), rot: Math.PI / 2 }
    return { cx: B.x2 - d / 2, cz: B.y1 + w / 2 + f * (BH - w), rot: -Math.PI / 2 }
  })
  const centre = (): Cand[] => [0, Math.PI / 2].map((rot) => ({ cx: (B.x1 + B.x2) / 2, cz: (B.y1 + B.y2) / 2, rot }))
  const footprint = (it: Item, c: Cand): Rect => {
    const quarter = Math.abs(Math.sin(c.rot)) > 0.5
    const hx = (quarter ? it.d : it.w) / 2
    const hz = (quarter ? it.w : it.d) / 2
    return { x1: c.cx - hx, y1: c.cz - hz, x2: c.cx + hx, y2: c.cz + hz }
  }
  const put = (it: Item, cands: Cand[], gap = 0.4): (Cand & { rect: Rect }) | null => {
    for (const c of cands) {
      const rect = footprint(it, c)
      if (!fits(rect, gap)) continue
      it.g.position.set(c.cx, a.base, c.cz)
      it.g.rotation.y = c.rot
      group.add(it.g)
      placed.push(rect)
      rects.push(rect)
      return { ...c, rect }
    }
    return null
  }
  const onWall = (make: () => Item, order: Wall[] = walls, fr: number[] = FR, gap = 0.4) => {
    for (const w of order) {
      const it = make()
      const hit = put(it, along(w, it.w, it.d, fr), gap)
      if (hit) return { ...hit, wall: w }
    }
    return null
  }
  /** Position straight in front of something already placed. */
  const infront = (p: Cand, fromD: number, it: Item, gap: number): Cand => {
    const dx = Math.sin(p.rot), dz = Math.cos(p.rot)
    const dist = fromD / 2 + gap + it.d / 2
    return { cx: p.cx + dx * dist, cz: p.cz + dz * dist, rot: p.rot }
  }

  /* ── Layouts ── */
  const area = BW * BH
  const corners = (it: () => Item) => { for (const w of walls) { const i = it(); if (put(i, along(w, i.w, i.d, [0, 1]), 0.1)) return } }
  switch (room.type) {
    case 'living': {
      if (/dining/.test(name)) {
        const set = diningSet()
        if (!put(set, centre(), 0.2)) onWall(() => diningSet(), walls, [0.5])
        onWall(sideboard, ['E', 'W', 'N', 'S'], [0.5, 0.2, 0.8])
        corners(plant)
      } else {
        const s = onWall(() => sofa(area > 150 ? 7 : 6), ['S', 'N', 'W', 'E'], [0.5, 0.2, 0.8])
        if (s) {
          const t = coffeeTable()
          const pos = infront(s, 2.9, t, 1.1)
          if (put(t, [pos], 0.1)) rug(7, 4.6, '#b9a58a', pos.cx, pos.cz, pos.rot)
          onWall(tvUnit, [OPPOSITE[s.wall]], [0.5])
        }
        if (area > 140) onWall(armchair, ['E', 'W', 'N', 'S'], [0.1, 0.9])
        corners(plant)
      }
      break
    }
    case 'kitchen': {
      let runs = 0
      for (const w of ['N', 'E', 'W', 'S'] as Wall[]) {
        if (runs >= 2) break
        const len = Math.min(((w === 'N' || w === 'S') ? BW : BH) - 5, 9)
        if (len < 3) continue
        const c = counter(len)
        if (put(c, along(w, c.w, c.d, [0, 1]), 0.1)) runs++
      }
      for (const w of walls) { const f = fridge(); if (put(f, along(w, f.w, f.d, [0, 1]), 0.1)) break }
      if (area > 110) put(island(), centre(), 0.4)
      break
    }
    case 'bedroom': {
      const placedBed = onWall(() => bed(true), ['N', 'S', 'W', 'E'], [0.5, 0.3, 0.7], 0.3) ?? onWall(() => bed(false), ['N', 'S', 'W', 'E'], [0.5], 0.3)
      if (placedBed) rug(7, 5, '#c7bba6', placedBed.cx + Math.sin(placedBed.rot) * 1.8, placedBed.cz + Math.cos(placedBed.rot) * 1.8, placedBed.rot)
      onWall(() => wardrobe(5), ['E', 'W', 'S', 'N'], [0.5, 0, 1], 0.3)
      if (area > 150) onWall(() => desk(), ['S', 'N', 'E', 'W'], [0.2, 0.8], 0.3)
      break
    }
    case 'study': {
      onWall(() => desk(), ['N', 'W', 'E', 'S'], [0.5, 0.2, 0.8], 0.3)
      onWall(() => bookshelf(4), ['E', 'W', 'S', 'N'], [0.5, 0, 1], 0.3)
      corners(plant)
      break
    }
    case 'wet': {
      for (const w of ['N', 'W', 'E', 'S'] as Wall[]) { const s = shower(); if (put(s, along(w, s.w, s.d, [0, 1]), 0.1)) break }
      onWall(wc, ['S', 'N', 'W', 'E'], [0.2, 0.8, 0.5], 0.2)
      onWall(basin, ['E', 'W', 'N', 'S'], [0.5, 0.2, 0.8], 0.2)
      break
    }
    case 'utility': {
      if (/wardrobe|closet|dress/.test(name)) for (const w of walls) { const r = rack(Math.min(((w === 'N' || w === 'S') ? BW : BH) - 1, 6)); put(r, along(w, r.w, r.d, [0.5]), 0.3) }
      else { onWall(() => shelves(4), ['E', 'W', 'N', 'S'], [0.5, 0, 1], 0.3); onWall(() => shelves(4), ['W', 'N', 'S', 'E'], [0.5, 0, 1], 0.3) }
      break
    }
    case 'circulation': {
      if (area >= 20) { onWall(console_, ['E', 'W', 'N', 'S'], [0.5], 0.3); corners(() => plant(1.5)) }
      break
    }
    case 'commercial': {
      onWall(shopCounter, ['N', 'S', 'E', 'W'], [0.5], 0.4)
      onWall(() => shelves(5), ['W', 'E', 'S', 'N'], [0.5, 0.2, 0.8], 0.4)
      break
    }
    case 'outdoor': {
      if (a.ground && /car|porch|garage|park/.test(name)) put(car(), centre(), 0.2)
      else if (a.ground) { if (!put(patio(), centre(), 0.2)) onWall(patio, walls, [0.5]); corners(() => plant(1.6)) }
      else { onWall(patio, ['S', 'N', 'E', 'W'], [0.5, 0.2, 0.8], 0.3); corners(() => plant(1.6)) }
      break
    }
    default:
      break
  }
  return { group, rects }
}
