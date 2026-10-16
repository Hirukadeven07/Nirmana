import * as THREE from 'three'
import type { PlanObject, Room, RoomKind, TourLevel, TourModel } from '../../data/floorplans'

/*
 * Turns a structured floor plan into a walkable three.js scene.
 * Plan feet map straight to world units: plan x → world x, plan y → world z,
 * elevation → world y. Walls are traced on a 1 ft grid between differently
 * labelled cells, then openings (doors, windows, glazing) are cut per wall run.
 */

export interface Segment { x1: number; y1: number; x2: number; y2: number }

export interface RoomInfo {
  label: string
  x: number
  y: number
  w: number
  h: number
  kind?: RoomKind
  level: number
  /** Centre of the largest clear floor area, for teleporting. */
  spot: { x: number; y: number }
}

export interface Stair { x: number; y: number; w: number; h: number; level: number }

export interface BuiltLevel {
  name: string
  base: number
  height: number
  group: THREE.Group
  colliders: Segment[]
  rooms: RoomInfo[]
  /** Open-plan label used when the player is not inside any room. */
  fill?: string
}

export interface BuiltScene {
  root: THREE.Group
  levels: BuiltLevel[]
  stairs: Stair[]
  /** Ceilings and roof: shown when walking or viewing from outside, hidden in the cut-away. */
  covers: THREE.Group
  labels: THREE.Group
  floors: THREE.Mesh[]
  stats: { rooms: number; doors: number; windows: number; furniture: number }
  size: number
  centre: THREE.Vector3
  dispose: () => void
}

type Side = 'N' | 'S' | 'E' | 'W'

/** Floor slab thickness between levels, in feet. */
export const SLAB = 0.7
interface Opening { a: number; b: number; bottom: number; top: number; fill?: 'glass' | 'shutter'; walk: boolean }

const STYLE = {
  house: { wall: '#f4efe6', floor: 'wood', exterior: '#efe6d4', trim: '#cbb994' },
  office: { wall: '#eef1f5', floor: 'carpet', exterior: '#dfe7f0', trim: '#475569' },
  warehouse: { wall: '#dfe3e8', floor: 'concrete', exterior: '#c9d1da', trim: '#64748b' },
} as const

// ---------------------------------------------------------------------------
// Procedural textures (no external assets)

function canvasTexture(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  draw(g, size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function makeTextures() {
  const noise = (g: CanvasRenderingContext2D, s: number, n: number, a: number) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * a})`
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2)
    }
  }
  return {
    wood: canvasTexture((g, s) => {
      const tones = ['#b98a5a', '#a87a4c', '#c29466', '#9f7246', '#b4865a']
      for (let r = 0; r < 8; r++) {
        const y = (r * s) / 8, off = (r % 2) * s * 0.45
        for (let k = -1; k < 2; k++) {
          g.fillStyle = tones[(r * 3 + k + 5) % tones.length]
          g.fillRect(off + k * s * 0.9, y, s * 0.9, s / 8)
          g.fillStyle = 'rgba(60,35,15,0.45)'
          g.fillRect(off + k * s * 0.9, y, 1.5, s / 8)
        }
        g.fillStyle = 'rgba(60,35,15,0.35)'
        g.fillRect(0, y, s, 1.5)
        for (let k = 0; k < 6; k++) {
          g.strokeStyle = 'rgba(80,50,20,0.12)'
          g.beginPath(); g.moveTo(0, y + 3 + k * 4); g.lineTo(s, y + 4 + k * 4 + Math.random() * 2); g.stroke()
        }
      }
    }),
    tile: canvasTexture((g, s) => {
      g.fillStyle = '#e9eef2'; g.fillRect(0, 0, s, s)
      noise(g, s, 900, 0.05)
      g.strokeStyle = '#b8c3cc'; g.lineWidth = 3
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4, s); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke() }
    }),
    pavers: canvasTexture((g, s) => {
      g.fillStyle = '#c98f6b'; g.fillRect(0, 0, s, s)
      noise(g, s, 1500, 0.08)
      g.strokeStyle = '#a06a4c'; g.lineWidth = 3
      for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * s / 2, 0); g.lineTo(i * s / 2, s); g.moveTo(0, i * s / 2); g.lineTo(s, i * s / 2); g.stroke() }
    }),
    carpet: canvasTexture((g, s) => {
      g.fillStyle = '#6b7380'; g.fillRect(0, 0, s, s)
      noise(g, s, 6000, 0.18)
      g.strokeStyle = 'rgba(255,255,255,0.05)'
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4, s); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke() }
    }),
    concrete: canvasTexture((g, s) => {
      g.fillStyle = '#b9bec4'; g.fillRect(0, 0, s, s)
      noise(g, s, 5000, 0.08)
      g.strokeStyle = 'rgba(70,80,90,0.25)'; g.lineWidth = 2
      g.strokeRect(0, 0, s, s)
    }),
    grass: canvasTexture((g, s) => {
      g.fillStyle = '#6f9f4f'; g.fillRect(0, 0, s, s)
      for (let i = 0; i < 4000; i++) {
        g.fillStyle = Math.random() > 0.5 ? 'rgba(40,80,20,0.25)' : 'rgba(170,210,110,0.2)'
        g.fillRect(Math.random() * s, Math.random() * s, 1.5, 3)
      }
    }),
    asphalt: canvasTexture((g, s) => {
      g.fillStyle = '#5b6168'; g.fillRect(0, 0, s, s)
      noise(g, s, 6000, 0.2)
    }),
  }
}

/** Floor plane with UVs scaled so one texture tile covers `tile` feet. */
function floorPlane(w: number, d: number, tile: number, mat: THREE.Material) {
  const geo = new THREE.PlaneGeometry(w, d)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile)
  const m = new THREE.Mesh(geo, mat)
  m.rotation.x = -Math.PI / 2
  m.receiveShadow = true
  return m
}

function labelSprite(text: string, sub?: string) {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 160
  const g = c.getContext('2d')!
  g.font = '600 54px Inter, system-ui, sans-serif'
  const w = Math.max(g.measureText(text).width, sub ? 200 : 0) + 60
  g.fillStyle = 'rgba(15,23,42,0.82)'
  g.beginPath(); g.roundRect((512 - w) / 2, 10, w, sub ? 130 : 84, 22); g.fill()
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 256, sub ? 58 : 52)
  if (sub) { g.font = '500 38px "JetBrains Mono", monospace'; g.fillStyle = '#cbd5e1'; g.fillText(sub, 256, 110) }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }))
  s.scale.set(10, 10 * (160 / 512), 1)
  s.renderOrder = 10
  return s
}

// ---------------------------------------------------------------------------

export function buildScene(model: TourModel): BuiltScene {
  const style = STYLE[model.style]
  const tex = makeTextures()
  const root = new THREE.Group()
  const covers = new THREE.Group()
  const labels = new THREE.Group()
  const floors: THREE.Mesh[] = []
  const stats = { rooms: 0, doors: 0, windows: 0, furniture: 0 }

  const mat = {
    wall: new THREE.MeshStandardMaterial({ color: style.wall, roughness: 0.92 }),
    exterior: new THREE.MeshStandardMaterial({ color: style.exterior, roughness: 0.95 }),
    trim: new THREE.MeshStandardMaterial({ color: style.trim, roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#cfe8f7', roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.28, metalness: 0.1, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: '#2b3440', roughness: 0.4, metalness: 0.6 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 1 }),
    slab: new THREE.MeshStandardMaterial({ color: '#d9d4ca', roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.7 }),
    tile: new THREE.MeshStandardMaterial({ map: tex.tile, roughness: 0.35 }),
    pavers: new THREE.MeshStandardMaterial({ map: tex.pavers, roughness: 0.9 }),
    carpet: new THREE.MeshStandardMaterial({ map: tex.carpet, roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.8 }),
    grass: new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 1 }),
    asphalt: new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 1 }),
    shutter: new THREE.MeshStandardMaterial({ color: '#9aa5b1', roughness: 0.5, metalness: 0.5 }),
    roof: new THREE.MeshStandardMaterial({ color: '#b5532f', roughness: 0.85, side: THREE.DoubleSide }),
    door: new THREE.MeshStandardMaterial({ color: '#7a4a26', roughness: 0.6 }),
  }
  const colorMats = new Map<string, THREE.MeshStandardMaterial>()
  const paint = (c: string, rough = 0.8, metal = 0) => {
    const k = `${c}${rough}${metal}`
    if (!colorMats.has(k)) colorMats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }))
    return colorMats.get(k)!
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material, shadow = true) => {
    const mesh = new THREE.Mesh(unitBox, m)
    mesh.scale.set(Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01))
    mesh.position.set(x + w / 2, y + h / 2, z + d / 2)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  const W = model.width, D = model.depth
  const levels: BuiltLevel[] = []
  const stairs: Stair[] = []
  let base = model.baseElevation

  model.levels.forEach((lv, li) => {
    const group = new THREE.Group()
    group.name = lv.name
    const colliders: Segment[] = []
    const rooms: Room[] = lv.rooms
    const fillIndex = lv.fill ? rooms.length : -1
    const cells = new Int16Array(W * D).fill(fillIndex)
    rooms.forEach(([x, y, w, h], i) => {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < D) cells[yy * W + xx] = i
    })
    const cell = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= D ? -1 : cells[y * W + x])
    const kindOf = (i: number): RoomKind | 'solid' | 'out' => (i < 0 ? 'out' : i === fillIndex ? 'solid' : rooms[i][5] ?? 'solid')
    const sameStair = (lvl: TourLevel | undefined, r: Room) => !!lvl?.rooms.some((o) => o[5] === 'stair' && o[0] === r[0] && o[1] === r[1] && o[2] === r[2] && o[3] === r[3])
    const doorsBySide = new Map<number, { side: Side; a: number; b: number }[]>()
    const noteDoor = (ri: number, side: Side, a: number, b: number) => {
      if (ri < 0 || ri === fillIndex) return
      if (!doorsBySide.has(ri)) doorsBySide.set(ri, [])
      doorsBySide.get(ri)!.push({ side, a, b })
    }

    // -- Wall runs --------------------------------------------------------
    const runs: { vertical: boolean; line: number; s0: number; s1: number; a: number; b: number }[] = []
    for (let x = 0; x <= W; x++) {
      let start = 0
      for (let y = 1; y <= D; y++) {
        const prev = [cell(x - 1, y - 1), cell(x, y - 1)]
        const cur = y < D ? [cell(x - 1, y), cell(x, y)] : [NaN, NaN]
        if (cur[0] !== prev[0] || cur[1] !== prev[1]) {
          if (prev[0] !== prev[1]) runs.push({ vertical: true, line: x, s0: start, s1: y, a: prev[0], b: prev[1] })
          start = y
        }
      }
    }
    for (let y = 0; y <= D; y++) {
      let start = 0
      for (let x = 1; x <= W; x++) {
        const prev = [cell(x - 1, y - 1), cell(x - 1, y)]
        const cur = x < W ? [cell(x, y - 1), cell(x, y)] : [NaN, NaN]
        if (cur[0] !== prev[0] || cur[1] !== prev[1]) {
          if (prev[0] !== prev[1]) runs.push({ vertical: false, line: y, s0: start, s1: x, a: prev[0], b: prev[1] })
          start = x
        }
      }
    }

    const fullH = lv.height
    for (const run of runs) {
      const { vertical, line, s0, s1, a, b } = run
      const len = s1 - s0
      const ka = kindOf(a), kb = kindOf(b)
      const openA = ka === 'dashed' || ka === 'out', openB = kb === 'dashed' || kb === 'out'
      // Which side of each room this run lies on (a is west/north of the line, b east/south).
      const sideA: Side = vertical ? 'E' : 'S', sideB: Side = vertical ? 'W' : 'N'
      let height = fullH
      if (ka !== 'out' && kb !== 'out') {
        for (const i of [a, b]) if (i >= 0 && i !== fillIndex && lv.roomHeights?.[rooms[i][4]]) height = Math.min(height, lv.roomHeights[rooms[i][4]])
      }
      let openings: Opening[] = []
      let kind: 'wall' | 'rail' | 'none' = 'wall'
      let exterior = ka === 'out' || kb === 'out'
      const centred = (w: number, top: number, bottom = 0, fill?: Opening['fill']): Opening[] =>
        len >= w + 0.6 ? [{ a: (len - w) / 2, b: (len + w) / 2, bottom, top, fill, walk: bottom === 0 && !fill }] : []

      if (openA && openB) {
        kind = li > 0 && (ka === 'out' || kb === 'out') ? 'rail' : 'none'
      } else if (ka === 'stair' || kb === 'stair') {
        const si = ka === 'stair' ? a : b
        const other = ka === 'stair' ? kb : ka
        const s = rooms[si]
        const isLower = sameStair(model.levels[li + 1], s) || !sameStair(model.levels[li - 1], s)
        const onLow = !vertical && line === s[1] + s[3]
        const onHigh = !vertical && line === s[1]
        if (other === 'out') kind = 'wall'
        else if (isLower) kind = onLow ? 'none' : 'wall'
        else kind = onHigh ? 'none' : onLow ? 'rail' : 'wall'
        if (kind === 'none') noteDoor(ka === 'stair' ? b : a, ka === 'stair' ? sideB : sideA, s0, s1)
      } else if (ka === 'glass' || kb === 'glass') {
        if (exterior) openings = [{ a: 0, b: len, bottom: 0.4, top: height - 0.6, fill: 'glass', walk: false }]
        else {
          const door = centred(3.5, height - 1)
          openings = [{ a: 0, b: len, bottom: 0, top: height - 1, fill: 'glass', walk: false }]
          if (door.length) openings = [{ a: 0, b: door[0].a, bottom: 0, top: height - 1, fill: 'glass', walk: false }, door[0], { a: door[0].b, b: len, bottom: 0, top: height - 1, fill: 'glass', walk: false }]
        }
      } else if (ka === 'core' || kb === 'core') {
        openings = []
      } else if (exterior) {
        const inside = ka === 'out' ? kb : ka
        if (model.style === 'office') openings = [{ a: 0, b: len, bottom: 0.4, top: height - 0.6, fill: 'glass', walk: false }]
        else if (model.style === 'warehouse') {
          openings = len > 12 ? [{ a: len * 0.1, b: len * 0.9, bottom: height - 6, top: height - 2, fill: 'glass', walk: false }] : []
        } else if (inside === 'wet') openings = centred(2.5, 7, 5, 'glass')
        else if (inside === 'solid' && len >= 5) {
          const n = Math.max(1, Math.round(len / 12)), seg = len / n, w = Math.min(5, seg - 2)
          openings = Array.from({ length: n }, (_, k) => ({ a: k * seg + (seg - w) / 2, b: k * seg + (seg + w) / 2, bottom: 3, top: 7, fill: 'glass' as const, walk: false }))
        }
        // Explicit openings from the plan override the defaults on that stretch.
        const side: Side = vertical ? (line === 0 ? 'W' : 'E') : line === 0 ? 'N' : 'S'
        for (const o of lv.openings ?? []) {
          if (o.side !== side || o.from < s0 || o.to > s1) continue
          const oa = o.from - s0, ob = o.to - s0
          openings = openings.filter((x) => x.b < oa - 0.5 || x.a > ob + 0.5)
          openings.push(o.kind === 'dock' ? { a: oa, b: ob, bottom: 0, top: 14, fill: 'shutter', walk: false } : { a: oa, b: ob, bottom: 0, top: 7, walk: true })
        }
        openings.sort((x, y) => x.a - y.a)
      } else if (openA || openB) {
        openings = centred(Math.min(len - 1, 6), 8)
      } else {
        openings = centred(3, 7)
      }
      if (kind === 'none') continue

      // -- Geometry for this run
      const T = 0.5
      const piece = (from: number, to: number, y0: number, y1: number, m: THREE.Material, thick = T) => {
        if (to - from < 0.01 || y1 - y0 < 0.01) return
        const g = vertical
          ? box(group, line - thick / 2, base + y0, from, thick, y1 - y0, to - from, m)
          : box(group, from, base + y0, line - thick / 2, to - from, y1 - y0, thick, m)
        return g
      }
      const seg = (from: number, to: number) => colliders.push(vertical ? { x1: line, y1: from, x2: line, y2: to } : { x1: from, y1: line, x2: to, y2: line })
      const wallMat = exterior ? mat.exterior : mat.wall

      if (kind === 'rail') {
        piece(s0, s1, 0, 3.4, wallMat, 0.4)
        piece(s0, s1, 3.4, 3.6, mat.trim, 0.6)
        seg(s0, s1)
        continue
      }
      let cursor = 0
      for (const o of openings) {
        piece(s0 + cursor, s0 + o.a, 0, height, wallMat)
        if (o.bottom > 0) piece(s0 + o.a, s0 + o.b, 0, o.bottom, wallMat)
        if (o.top < height) piece(s0 + o.a, s0 + o.b, o.top, height, wallMat)
        if (o.fill === 'glass') {
          piece(s0 + o.a, s0 + o.b, o.bottom, o.top, mat.glass, 0.08)
          const span = o.b - o.a, step = model.style === 'office' ? 5 : span / Math.max(1, Math.round(span / 3))
          for (let m = 0; m <= span + 0.01; m += step) piece(s0 + o.a + m - 0.08, s0 + o.a + m + 0.08, o.bottom, o.top, mat.frame, 0.16)
          piece(s0 + o.a, s0 + o.b, o.bottom - 0.08, o.bottom + 0.08, mat.frame, 0.18)
          piece(s0 + o.a, s0 + o.b, o.top - 0.08, o.top + 0.08, mat.frame, 0.18)
          if (o.bottom > 0 && model.style === 'house') stats.windows++
        } else if (o.fill === 'shutter') {
          piece(s0 + o.a, s0 + o.b, 0, o.top, mat.shutter, 0.2)
          for (let y = 1; y < o.top; y += 1) piece(s0 + o.a, s0 + o.b, y - 0.05, y + 0.05, mat.frame, 0.26)
        } else if (o.walk) {
          stats.doors++
          noteDoor(a, sideA, s0 + o.a, s0 + o.b)
          noteDoor(b, sideB, s0 + o.a, s0 + o.b)
          // door frame
          piece(s0 + o.a - 0.15, s0 + o.a, 0, o.top, mat.trim, 0.6)
          piece(s0 + o.b, s0 + o.b + 0.15, 0, o.top, mat.trim, 0.6)
          piece(s0 + o.a - 0.15, s0 + o.b + 0.15, o.top, o.top + 0.15, mat.trim, 0.6)
        }
        if (!o.walk) seg(s0 + o.a, s0 + o.b)
        cursor = o.b
      }
      piece(s0 + cursor, s1, 0, height, wallMat)
      // Colliders for the solid stretches.
      let c = 0
      for (const o of openings) { seg(s0 + c, s0 + o.a); c = o.b }
      seg(s0 + c, s1)
    }

    // -- Floors, ceilings and stairs ---------------------------------------
    const nextLevel = model.levels[li + 1]
    const covered = (r: Room) => !!nextLevel && nextLevel.rooms.some((o) => r[0] >= o[0] && r[1] >= o[1] && r[0] + r[2] <= o[0] + o[2] && r[1] + r[3] <= o[1] + o[3] && o[5] !== 'stair')
    const roomInfos: RoomInfo[] = []
    const floorFor = (label: string, kind: RoomKind | undefined) => {
      if (kind === 'wet') return { m: mat.tile, tile: 4 }
      if (kind === 'dashed') return { m: mat.pavers, tile: 4 }
      if (kind === 'core') return { m: mat.concrete, tile: 10 }
      if (model.style === 'warehouse') return label === 'Site office' ? { m: mat.carpet, tile: 6 } : { m: mat.concrete, tile: 20 }
      if (model.style === 'office') return kind === 'glass' ? { m: mat.wood, tile: 8 } : { m: mat.carpet, tile: 6 }
      return { m: mat.wood, tile: 8 }
    }
    const allRooms: Room[] = lv.fill ? [...lv.rooms, [0, 0, W, D, lv.fill]] : lv.rooms
    allRooms.forEach((r, ri) => {
      const [x, y, w, h, label, kind] = r
      const isFill = ri === fillIndex
      if (kind === 'stair' && li > 0 && sameStair(model.levels[li - 1], r)) {
        roomInfos.push({ label, x, y, w, h, kind, level: li, spot: { x: x + w / 2, y: y + h / 2 } })
        return // stair void on the upper floor
      }
      const f = floorFor(label, kind)
      const plane = floorPlane(w, h, f.tile, f.m)
      plane.position.set(x + w / 2, base + (isFill ? 0.01 : 0.04), y + h / 2)
      plane.userData = { level: li, label, room: { x, y, w, h } }
      group.add(plane)
      floors.push(plane)
      if (li > 0) box(group, x, base - SLAB, y, w, SLAB, h, mat.slab, false)
      if (!isFill) stats.rooms++
      if (kind !== 'dashed' && kind !== 'stair' && !covered(r)) {
        const ch = lv.roomHeights?.[label] ?? lv.height
        box(covers, x, base + ch, y, w, 0.4, h, mat.ceiling, false)
        if (ch < lv.height) box(group, x, base + ch, y, w, 0.4, h, mat.slab, false)
      }
      if (kind === 'stair') {
        stairs.push({ x, y, w, h, level: li })
        const n = 16
        for (let s = 0; s < n; s++) {
          const z = y + h - ((s + 1) * h) / n
          box(group, x + 0.3, base, z, w - 0.6, ((s + 1) * (lv.height + SLAB)) / n, h / n, mat.wood)
        }
      }
      roomInfos.push({ label, x, y, w, h, kind, level: li, spot: { x: x + w / 2, y: y + h / 2 } })
      if (!isFill && kind !== 'stair') {
        const sp = labelSprite(label, `${w}'×${h}'`)
        const k = Math.max(1, Math.max(W, D) / 46)
        sp.scale.multiplyScalar(Math.min(1.6, k) * 1.5)
        sp.position.set(x + w / 2, base + (lv.roomHeights?.[label] ?? lv.height) + 3, y + h / 2)
        sp.userData.level = li
        labels.add(sp)
      }
    })

    // -- Furniture ---------------------------------------------------------
    const solidAabb = (x: number, y: number, w: number, d: number) => {
      colliders.push({ x1: x, y1: y, x2: x + w, y2: y }, { x1: x + w, y1: y, x2: x + w, y2: y + d }, { x1: x, y1: y + d, x2: x + w, y2: y + d }, { x1: x, y1: y, x2: x, y2: y + d })
    }
    lv.rooms.forEach((r, ri) => {
      const placed = furnish(r, doorsBySide.get(ri) ?? [])
      for (const p of placed) {
        box(group, p.x, base + (p.z ?? 0), p.y, p.w, p.h, p.d, paint(p.color, p.rough ?? 0.8, p.metal ?? 0))
        if (p.solid) solidAabb(p.x, p.y, p.w, p.d)
        if (p.main) stats.furniture++
      }
      // spot: centre of the room, nudged away from furniture-heavy back wall
      const info = roomInfos.find((i) => i.label === r[4])
      if (info && placed.length) {
        const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2
        const blocked = placed.some((p) => p.solid && cx > p.x - 1 && cx < p.x + p.w + 1 && cy > p.y - 1 && cy < p.y + p.d + 1)
        if (blocked) info.spot = { x: r[0] + Math.min(3, r[2] / 2), y: r[1] + r[3] - Math.min(3, r[3] / 2) }
      }
    })
    for (const o of lv.objects ?? []) {
      addObject(group, o, base, box, paint)
      if (o.kind !== 'plant') solidAabb(o.x, o.y, o.w, o.d)
      if (o.kind === 'desk' || o.kind === 'rack') stats.furniture++
    }

    root.add(group)
    levels.push({ name: lv.name, base, height: lv.height, group, colliders, rooms: roomInfos, fill: lv.fill })
    base += lv.height + SLAB
  })

  // -- Roof --------------------------------------------------------------
  const top = levels[levels.length - 1]
  const roofBase = top.base + top.height + 0.4
  if (model.style === 'house') {
    const x0 = -2, x1 = W + 2, z0 = 6, z1 = D + 2, rise = ((z1 - z0) / 2) * Math.tan((25 * Math.PI) / 180)
    const zm = (z0 + z1) / 2
    const shape = new THREE.BufferGeometry()
    const v = [
      x0, roofBase, z0, x1, roofBase, z0, x1, roofBase + rise, zm, x0, roofBase, z0, x1, roofBase + rise, zm, x0, roofBase + rise, zm,
      x0, roofBase + rise, zm, x1, roofBase + rise, zm, x1, roofBase, z1, x0, roofBase + rise, zm, x1, roofBase, z1, x0, roofBase, z1,
    ]
    shape.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    shape.computeVertexNormals()
    const roof = new THREE.Mesh(shape, mat.roof)
    roof.castShadow = true
    covers.add(roof)
    const gable = new THREE.BufferGeometry()
    const g = (x: number) => [x, roofBase, z0 + 2, x, roofBase, z1 - 2, x, roofBase + rise - 0.6, zm]
    gable.setAttribute('position', new THREE.Float32BufferAttribute([...g(0.1), ...g(W - 0.1)], 3))
    gable.computeVertexNormals()
    covers.add(new THREE.Mesh(gable, new THREE.MeshStandardMaterial({ color: style.exterior, side: THREE.DoubleSide })))
    box(covers, x0, roofBase - 0.4, z0, x1 - x0, 0.4, z1 - z0, mat.trim, false)
  } else if (model.style === 'warehouse') {
    box(covers, -1, roofBase - 0.4, -1, W + 2, 1, D + 2, paint('#94a3b8', 0.6, 0.4))
    for (let x = 20; x < W; x += 40) box(covers, x, roofBase + 0.6, 10, 6, 0.3, D - 20, paint('#e0f2fe', 0.2))
  } else {
    box(covers, -0.5, roofBase - 0.4, -0.5, W + 1, 1.2, D + 1, paint('#cbd5e1', 0.9))
  }

  // -- Site --------------------------------------------------------------
  const site = new THREE.Group()
  const lot = model.lot
  const ground = floorPlane(lot.maxX - lot.minX + 400, lot.maxY - lot.minY + 400, 8, model.style === 'warehouse' ? mat.asphalt : mat.grass)
  ground.position.set((lot.minX + lot.maxX) / 2, -0.02, (lot.minY + lot.maxY) / 2)
  site.add(ground)
  if (model.style === 'house') {
    const drive = floorPlane(16, 18, 4, mat.pavers)
    drive.position.set(8, 0.005, D + 9)
    site.add(drive)
    const path = floorPlane(16, 10, 4, mat.pavers)
    path.position.set(8, 0.005, -5)
    site.add(path)
    // compound wall, with a gate on the south
    const cw = paint('#e7dcc6', 0.95)
    box(site, lot.minX, 0, lot.minY, lot.maxX - lot.minX, 4, 0.6, cw)
    box(site, lot.minX, 0, lot.minY, 0.6, 4, lot.maxY - lot.minY, cw)
    box(site, lot.maxX - 0.6, 0, lot.minY, 0.6, 4, lot.maxY - lot.minY, cw)
    box(site, lot.minX, 0, lot.maxY - 0.6, 18 - lot.minX, 4, 0.6, cw)
    box(site, 34, 0, lot.maxY - 0.6, lot.maxX - 34, 4, 0.6, cw)
  }
  if (model.style === 'office') {
    box(site, -10, 0, -10, W + 20, model.baseElevation - 0.7, D + 20, paint('#94a3b8', 0.5, 0.2))
    for (let y = 4; y < model.baseElevation - 1; y += 12) box(site, -10.3, y, -10.3, W + 20.6, 6, D + 20.6, mat.glass, false)
    const rnd = mulberry(7)
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, r = 230 + rnd() * 160
      const w = 40 + rnd() * 60, h = 60 + rnd() * 260
      box(site, W / 2 + Math.cos(a) * r - w / 2, 0, D / 2 + Math.sin(a) * r - w / 2, w, h, w, paint(['#cbd5e1', '#a5b4c8', '#d6d3cd', '#8fa3b8'][i % 4], 0.6, 0.2))
    }
  }
  if (model.style === 'warehouse') {
    for (let i = 0; i < 12; i++) box(site, 14.5 + i * 18.2, 0, D, 12.4, 4, 6, paint('#475569'))
  }
  for (const o of model.outdoor ?? []) addObject(site, o, 0, box, paint)
  root.add(site)
  root.add(covers)
  root.add(labels)
  labels.visible = false

  const size = Math.max(W, D)
  const centre = new THREE.Vector3(W / 2, model.baseElevation + (top.base + top.height - model.baseElevation) / 2, D / 2)
  return {
    root, levels, stairs, covers, labels, floors, stats, size, centre,
    dispose: () => {
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry && m.geometry !== unitBox) m.geometry.dispose()
        const mm = (m as unknown as { material?: THREE.Material | THREE.Material[] }).material
        if (mm) for (const x of Array.isArray(mm) ? mm : [mm]) { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose() }
      })
      unitBox.dispose()
      Object.values(tex).forEach((t) => t.dispose())
    },
  }
}

// ---------------------------------------------------------------------------
// Furnishing: simple pieces laid against the wall with the fewest doors.

interface Piece { x: number; y: number; w: number; d: number; h: number; z?: number; color: string; rough?: number; metal?: number; solid?: boolean; main?: boolean }

function furnish(r: Room, doors: { side: Side; a: number; b: number }[]): Piece[] {
  const [rx, ry, rw, rh, label, kind] = r
  const name = label.toLowerCase()
  if (kind === 'stair' || kind === 'core') return []
  const sides: Side[] = ['N', 'S', 'W', 'E']
  const sideLen = (s: Side) => (s === 'N' || s === 'S' ? rw : rh)
  const doorLen = (s: Side) => doors.filter((d) => d.side === s).reduce((t, d) => t + (d.b - d.a), 0)
  const back = [...sides].sort((p, q) => doorLen(p) - doorLen(q) || sideLen(q) - sideLen(p))[0]
  const front = ({ N: 'S', S: 'N', W: 'E', E: 'W' } as const)[back]
  const L = sideLen(back), Dp = back === 'N' || back === 'S' ? rh : rw
  // Local frame: u along the back wall (0..L), v inward from it (0..Dp).
  const toPlan = (u: number, v: number, w: number, d: number): { x: number; y: number; w: number; d: number } => {
    switch (back) {
      case 'N': return { x: rx + u, y: ry + v, w, d }
      case 'S': return { x: rx + u, y: ry + rh - v - d, w, d }
      case 'W': return { x: rx + v, y: ry + u, w: d, d: w }
      case 'E': return { x: rx + rw - v - d, y: ry + u, w: d, d: w }
    }
  }
  // Shift a centred item along the wall so it does not sit in front of a door on the back wall.
  const backDoors = doors.filter((d) => d.side === back).map((d) => (back === 'N' || back === 'S' ? [d.a - rx, d.b - rx] : [d.a - ry, d.b - ry]))
  const slot = (w: number) => {
    let u = (L - w) / 2
    for (const [a, b] of backDoors) if (u < b + 0.5 && u + w > a - 0.5) u = a - 0.5 - w >= 0.4 ? a - 0.5 - w : b + 0.5
    return Math.min(Math.max(u, 0.4), Math.max(0.4, L - w - 0.4))
  }
  const out: Piece[] = []
  const put = (u: number, v: number, w: number, d: number, h: number, color: string, extra: Partial<Piece> = {}) => out.push({ ...toPlan(u, v, w, d), h, color, ...extra })

  if (name.includes('bed')) {
    const u = slot(5.2)
    put(u, 0.3, 5.2, 6.8, 1.4, '#e8e2d6', { solid: true, main: true })
    put(u, 0.3, 5.2, 0.4, 3.6, '#6b4a2f')
    put(u + 0.4, 0.8, 2, 1.3, 0.5, '#ffffff', { z: 1.4 })
    put(u + 2.8, 0.8, 2, 1.3, 0.5, '#ffffff', { z: 1.4 })
    put(u, 3.2, 5.2, 3.9, 0.15, '#5b7fa6', { z: 1.4 })
    if (u > 2) put(u - 1.9, 0.3, 1.6, 1.6, 1.8, '#8a6440')
    if (u + 5.2 + 2 < L) put(u + 5.5, 0.3, 1.6, 1.6, 1.8, '#8a6440')
  } else if (name.includes('living') || name.includes('lounge')) {
    const u = slot(7.5)
    put(u, 0.4, 7.5, 3, 1.4, '#55606e', { solid: true, main: true })
    put(u, 0.4, 7.5, 1, 2.8, '#4a5562')
    put(u + 1.5, 5, 4.5, 2.4, 1.3, '#7a5534', { solid: true })
    put(u - 1, 3.8, 9.5, 6, 0.04, '#c9b79c', { rough: 1 })
    if (Dp > 13 && doorLen(front) === 0) {
      put(u + 0.5, Dp - 1.6, 6.5, 1.2, 1.8, '#2f3338', { solid: true })
      put(u + 1.2, Dp - 1.2, 5, 0.2, 2.8, '#0f1115', { z: 2.2, metal: 0.3 })
    }
  } else if (name.includes('dining')) {
    const tw = Math.min(6, rw - 5), td = 3.4
    const cx = rw / 2 - tw / 2, cy = rh / 2 - td / 2
    out.push({ x: rx + cx, y: ry + cy, w: tw, d: td, h: 2.5, color: '#7a5534', solid: true, main: true })
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const px = rx + cx + 0.4 + i * ((tw - 2) / 2), py = s < 0 ? ry + cy - 1.6 : ry + cy + td + 0.2
      out.push({ x: px, y: py, w: 1.4, d: 1.4, h: 1.5, color: '#5b3d24' })
      out.push({ x: px, y: s < 0 ? py : py + 1.2, w: 1.4, d: 0.2, h: 3, color: '#5b3d24' })
    }
  } else if (name.includes('pantry') || name.includes('kitchen')) {
    put(0.3, 0.3, L - 0.6, 2.2, 3, '#f1f5f9', { solid: true, main: true })
    put(0.3, 0.3, L - 0.6, 2.3, 0.15, '#334155', { z: 3 })
    put(0.3, 0.3, L - 0.6, 1.2, 2.2, '#cbd5e1', { z: 5.2 })
    if (Dp > 9) put(L / 2 - 3, Dp / 2, 6, 2.6, 3, '#e2e8f0', { solid: true })
  } else if (name.includes('bath')) {
    const u = slot(5)
    put(u, 0.3, 1.6, 2.2, 1.4, '#ffffff', { solid: true, main: true })
    put(u, 0.3, 1.6, 0.6, 2.6, '#ffffff')
    put(u + 2.6, 0.3, 2, 1.6, 2.8, '#f8fafc', { solid: true })
    put(u + 2.7, 0.3, 1.8, 0.1, 2, '#bfdbfe', { z: 3.4, metal: 0.8, rough: 0.1 })
  } else if (name.includes('walk-in') || name.includes('store')) {
    put(0.3, 0.3, L - 0.6, 1.8, 7, '#a07850', { solid: true, main: true })
  } else if (name.includes('study')) {
    const u = slot(4)
    put(u, 0.3, 4, 2, 2.5, '#8a6440', { solid: true, main: true })
    put(u + 1.4, 2.6, 1.4, 1.4, 1.6, '#334155')
  } else if (name.includes('car porch')) {
    const cx = rx + 1.5, cy = ry + rh / 2 - 6.5
    out.push({ x: cx, y: cy, w: 5.8, d: 13, h: 2.6, z: 0.6, color: '#b91c1c', rough: 0.3, metal: 0.4, solid: true, main: true })
    out.push({ x: cx + 0.4, y: cy + 3.5, w: 5, d: 6, h: 1.6, z: 3.2, color: '#1f2937', rough: 0.15, metal: 0.6 })
    for (const [dx, dy] of [[-0.2, 2], [5.4, 2], [-0.2, 10], [5.4, 10]]) out.push({ x: cx + dx, y: cy + dy, w: 0.6, d: 2.2, h: 2.2, color: '#111827' })
  } else if (kind === 'dashed') {
    put(1, 1, 2, 2, 2.6, '#7c5a3a')
    put(4, 1, 2, 2, 2.6, '#7c5a3a')
    put(L - 2.5, 0.6, 1.8, 1.8, 3.4, '#3f7d3a')
  } else if (name.includes('meeting')) {
    const tw = rw - 6, td = 4
    out.push({ x: rx + 3, y: ry + rh / 2 - td / 2, w: tw, d: td, h: 2.5, color: '#e5e7eb', solid: true, main: true })
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) out.push({ x: rx + 3.5 + i * ((tw - 2) / 2), y: s < 0 ? ry + rh / 2 - td / 2 - 1.8 : ry + rh / 2 + td / 2 + 0.4, w: 1.5, d: 1.5, h: 2.6, color: '#1f2937' })
    out.push({ x: rx + rw / 2 - 2.5, y: ry + 0.3, w: 5, d: 0.2, h: 3, z: 3, color: '#0f172a', metal: 0.3 })
  } else if (name.includes('office')) {
    for (let i = 0; i < 3; i++) put(1 + i * 7, 0.4, 5, 2.5, 2.5, '#d6d3d1', { solid: true, main: true })
    put(L - 4, Dp - 3, 3, 2, 4.5, '#64748b', { solid: true })
  } else if (name.includes('lobby') || name.includes('landing')) {
    put(0.5, 0.5, 1.6, 1.6, 3.5, '#3f7d3a')
  }
  return out
}

function addObject(
  parent: THREE.Object3D, o: PlanObject, base: number,
  box: (p: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material, s?: boolean) => THREE.Mesh,
  paint: (c: string, r?: number, m?: number) => THREE.Material,
) {
  const { x, y, w, d, h } = o
  switch (o.kind) {
    case 'column':
      box(parent, x, base, y, w, h, d, paint('#d1d5db', 0.9))
      break
    case 'desk':
      box(parent, x, base + h - 0.15, y, w, 0.15, d, paint('#f5f5f4', 0.6))
      box(parent, x + 0.2, base, y + 0.2, 0.2, h - 0.15, d - 0.4, paint('#475569', 0.5, 0.5))
      box(parent, x + w - 0.4, base, y + 0.2, 0.2, h - 0.15, d - 0.4, paint('#475569', 0.5, 0.5))
      box(parent, x, base + h, y + d / 2 - 0.05, w, 1.4, 0.1, paint('#94a3b8', 0.9))
      for (const off of [0.8, w / 2 + 0.6]) {
        box(parent, x + off, base + h, y + 0.6, 1.8, 1.1, 0.12, paint('#0f172a', 0.3, 0.3))
        box(parent, x + off + 0.2, base, y - 1.6, 1.4, 1.6, 1.4, paint('#1f2937', 0.8))
        box(parent, x + off + 0.2, base + 1.6, y - 1.7, 1.4, 1.6, 0.2, paint('#1f2937', 0.8))
        box(parent, x + off + 0.2, base + h, y + d - 1.4, 1.4, 1.1, 0.12, paint('#0f172a', 0.3, 0.3))
        box(parent, x + off + 0.2, base, y + d + 0.2, 1.4, 1.6, 1.4, paint('#1f2937', 0.8))
      }
      break
    case 'rack': {
      const orange = paint('#ea580c', 0.5, 0.4), blue = paint('#1d4ed8', 0.5, 0.4)
      for (let k = 0; k <= d; k += 8.5) box(parent, x, base, y + Math.min(k, d - 0.3), w, h, 0.3, blue)
      for (let lvl = 0; lvl < 4; lvl++) {
        const z = base + 1 + lvl * 6
        box(parent, x, z, y, 0.3, 0.4, d, orange)
        box(parent, x + w - 0.3, z, y, 0.3, 0.4, d, orange)
        const rnd = mulberry(Math.round(x * 31 + lvl))
        for (let k = 0; k < d - 4; k += 4.25) if (rnd() > 0.18) {
          box(parent, x + 0.4, z + 0.4, y + k + 0.4, w - 0.8, 0.4, 3.4, paint('#c8a26b', 0.9))
          box(parent, x + 0.5, z + 0.8, y + k + 0.5, w - 1, 2.6 + rnd() * 1.6, 3.2, paint(['#d6b98c', '#c2a275', '#e7d3b0', '#94a3b8'][Math.floor(rnd() * 4)], 0.95))
        }
      }
      break
    }
    case 'lift':
      box(parent, x, base, y, w, h, d, paint('#cbd5e1', 0.25, 0.9))
      box(parent, x + w / 2 - 0.03, base, y - 0.02, 0.06, h, d + 0.04, paint('#475569', 0.4, 0.6))
      box(parent, x - 0.3, base + h, y - 0.05, w + 0.6, 0.6, d + 0.1, paint('#334155', 0.4, 0.4))
      break
    case 'plant':
      box(parent, x, base, y, w, 1.4, d, paint('#78716c', 0.9))
      box(parent, x - 0.3, base + 1.4, y - 0.3, w + 0.6, h - 1.4, d + 0.6, paint('#3f7d3a', 1))
      break
    case 'tree': {
      box(parent, x + w / 2 - 0.5, base, y + d / 2 - 0.5, 1, h * 0.45, 1, paint('#6b4a2f', 1))
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(w * 1.6, 0), paint('#4d7c3a', 1))
      leaf.position.set(x + w / 2, base + h * 0.7, y + d / 2)
      leaf.castShadow = true
      parent.add(leaf)
      break
    }
  }
}

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
