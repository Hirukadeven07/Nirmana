import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/*
 * Procedural furniture library for the 3D tour, in feet.
 * Every model is built in a local frame with its back against a wall at z = 0,
 * spanning x 0..w and z 0..d (z grows into the room), sitting on y = 0.
 */

function canvasTex(draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = 1, size = 256, color = true) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d')!, size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  if (color) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeKit() {
  const rand = rng(11)
  const weave = canvasTex((g, s) => {
    g.fillStyle = '#ededed'; g.fillRect(0, 0, s, s)
    for (let y = 0; y < s; y += 2) { g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.05})`; g.fillRect(0, y, s, 1) }
    for (let x = 0; x < s; x += 2) { g.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.06})`; g.fillRect(x, 0, 1, s) }
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(0,0,0,${rand() * 0.06})`; g.fillRect(rand() * s, rand() * s, 2, 1) }
  }, 3)
  const grain = canvasTex((g, s) => {
    g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, s, s)
    for (let i = 0; i < 70; i++) {
      const x = rand() * s, w = 1 + rand() * 3
      g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.1})`
      g.beginPath(); g.moveTo(x, 0)
      for (let y = 0; y <= s; y += 16) g.lineTo(x + Math.sin(y / 30 + i) * 3, y)
      g.lineTo(x + w, s); g.lineTo(x + w, 0); g.fill()
    }
  })
  const speckle = canvasTex((g, s) => {
    g.fillStyle = '#3a3d42'; g.fillRect(0, 0, s, s)
    for (let i = 0; i < 5000; i++) { const v = rand(); g.fillStyle = v > 0.7 ? 'rgba(230,230,230,0.5)' : v > 0.4 ? 'rgba(120,110,100,0.5)' : 'rgba(10,10,10,0.5)'; g.fillRect(rand() * s, rand() * s, 1.5, 1.5) }
  })
  const rugTex = canvasTex((g, s) => {
    g.fillStyle = '#d8ccb6'; g.fillRect(0, 0, s, s)
    g.strokeStyle = '#8c6a4a'; g.lineWidth = 10; g.strokeRect(14, 14, s - 28, s - 28)
    g.strokeStyle = '#b08d64'; g.lineWidth = 3; g.strokeRect(32, 32, s - 64, s - 64)
    g.fillStyle = 'rgba(140,106,74,0.35)'
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { g.save(); g.translate(56 + i * 29, 56 + j * 29); g.rotate(Math.PI / 4); g.fillRect(-6, -6, 12, 12); g.restore() }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${rand() * 0.05})`; g.fillRect(rand() * s, rand() * s, 1, 2) }
  }, 1, 256)
  const textures = [weave, grain, speckle, rugTex]

  const cache = new Map<string, THREE.Material>()
  const memo = <T extends THREE.Material>(k: string, make: () => T) => (cache.get(k) ?? (cache.set(k, make()), cache.get(k)!)) as T
  const m = {
    fabric: (c: string) => memo(`fab${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, map: weave, roughness: 0.95, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') })),
    wood: (c: string) => memo(`wood${c}`, () => new THREE.MeshStandardMaterial({ color: c, map: grain, roughness: 0.55 })),
    paint: (c: string, rough = 0.6) => memo(`p${c}${rough}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: rough })),
    metal: (c: string, rough = 0.3) => memo(`m${c}${rough}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 1 })),
    granite: memo('granite', () => new THREE.MeshPhysicalMaterial({ map: speckle, roughness: 0.25, clearcoat: 0.6 })),
    ceramic: memo('ceramic', () => new THREE.MeshPhysicalMaterial({ color: '#f7f7f4', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 })),
    blackGlass: memo('bglass', () => new THREE.MeshPhysicalMaterial({ color: '#07090c', roughness: 0.06, metalness: 0.3, clearcoat: 1 })),
    screen: memo('screen', () => new THREE.MeshStandardMaterial({ color: '#0b1220', emissive: '#16263f', emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.2 })),
    mirror: memo('mirror', () => new THREE.MeshStandardMaterial({ color: '#dfe6ec', roughness: 0.02, metalness: 1 })),
    glass: memo('glass', () => new THREE.MeshPhysicalMaterial({ color: '#d7ecf5', roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false })),
    carGlass: memo('cglass', () => new THREE.MeshPhysicalMaterial({ color: '#111827', roughness: 0.05, metalness: 0.4, clearcoat: 1 })),
    carPaint: (c: string) => memo(`car${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.05 })),
    rubber: memo('rubber', () => new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.9 })),
    shade: memo('shade', () => new THREE.MeshStandardMaterial({ color: '#fff7ea', emissive: '#ffd59a', emissiveIntensity: 0.55, roughness: 0.9, side: THREE.DoubleSide })),
    bulb: memo('bulb', () => new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff1d0', emissiveIntensity: 1.6 })),
    redLight: memo('redl', () => new THREE.MeshStandardMaterial({ color: '#7f1d1d', emissive: '#dc2626', emissiveIntensity: 0.6 })),
    leaf: (c: string) => memo(`leaf${c}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, flatShading: true })),
    rug: memo('rug', () => new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 })),
  }

  const geos = new Map<string, THREE.BufferGeometry>()
  const geo = (k: string, make: () => THREE.BufferGeometry) => geos.get(k) ?? (geos.set(k, make()), geos.get(k)!)
  const unit = geo('box', () => new THREE.BoxGeometry(1, 1, 1))
  const q = (n: number) => Math.round(n * 20) / 20

  const add = (p: THREE.Object3D, g: THREE.BufferGeometry, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(g, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    p.add(mesh)
    return mesh
  }
  /** Rounded box with its min corner at (x, y, z). */
  const rbox = (p: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, r = 0.06) => {
    const rr = Math.min(r, Math.min(w, h, d) / 2 - 0.005)
    const g = rr <= 0.01 ? unit : geo(`rb${q(w)}|${q(h)}|${q(d)}|${q(rr)}`, () => new RoundedBoxGeometry(q(w) || 0.05, q(h) || 0.05, q(d) || 0.05, 3, rr))
    const mesh = add(p, g, mat)
    if (g === unit) mesh.scale.set(w, h, d)
    mesh.position.set(x + w / 2, y + h / 2, z + d / 2)
    return mesh
  }
  const box = (p: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const mesh = add(p, unit, mat)
    mesh.scale.set(Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01))
    mesh.position.set(x + w / 2, y + h / 2, z + d / 2)
    return mesh
  }
  /** Cylinder standing on (x, y, z). */
  const cyl = (p: THREE.Object3D, x: number, y: number, z: number, rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 18, open = false) => {
    const mesh = add(p, geo(`cy${q(rTop)}|${q(rBot)}|${q(h)}|${seg}|${open}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open)), mat)
    mesh.position.set(x, y + h / 2, z)
    return mesh
  }
  const ball = (p: THREE.Object3D, x: number, y: number, z: number, r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1, detail = 1) => {
    const mesh = add(p, geo(`ico${detail}`, () => new THREE.IcosahedronGeometry(1, detail)), mat)
    mesh.position.set(x, y, z)
    mesh.scale.set(r * sx, r * sy, r * sz)
    return mesh
  }
  const sphere = (p: THREE.Object3D, x: number, y: number, z: number, r: number, mat: THREE.Material) => {
    const mesh = add(p, geo('sph', () => new THREE.SphereGeometry(1, 20, 14)), mat)
    mesh.position.set(x, y, z)
    mesh.scale.setScalar(r)
    return mesh
  }
  const lathe = (p: THREE.Object3D, key: string, pts: [number, number][], x: number, y: number, z: number, mat: THREE.Material, s = 1) => {
    const mesh = add(p, geo(`la${key}`, () => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 28)), mat)
    mesh.position.set(x, y, z)
    mesh.scale.setScalar(s)
    return mesh
  }
  const torus = (p: THREE.Object3D, x: number, y: number, z: number, r: number, tube: number, mat: THREE.Material, arc = Math.PI * 2) => {
    const mesh = add(p, geo(`to${q(r)}|${tube}|${q(arc)}`, () => new THREE.TorusGeometry(r, tube, 8, 32, arc)), mat)
    mesh.position.set(x, y, z)
    return mesh
  }

  const dispose = () => {
    geos.forEach((g) => g.dispose())
    cache.forEach((x) => x.dispose())
    textures.forEach((t) => t.dispose())
  }

  return { m, rbox, box, cyl, ball, sphere, lathe, torus, dispose, rand }
}

export type Kit = ReturnType<typeof makeKit>
type G = THREE.Group
const group = () => new THREE.Group()

// ---------------------------------------------------------------------------
// Pieces

export function bed(k: Kit, w: number, d: number, cover: string, head: string): G {
  const g = group(), { m } = k
  const frame = m.wood('#5a3d27')
  for (const [x, z] of [[0.3, 0.5], [w - 0.3, 0.5], [0.3, d - 0.3], [w - 0.3, d - 0.3]]) k.cyl(g, x, 0, z, 0.1, 0.08, 0.4, frame, 10)
  k.rbox(g, 0, 0.4, 0.3, w, 0.55, d - 0.3, frame, 0.05)
  k.rbox(g, 0.1, 0.95, 0.4, w - 0.2, 0.7, d - 0.55, m.fabric('#f4f1ea'), 0.2)
  // duvet with side drapes
  k.rbox(g, -0.04, 1.55, 2.2, w + 0.08, 0.22, d - 2.3, m.fabric(cover), 0.1)
  k.rbox(g, -0.1, 0.95, 2.2, 0.14, 0.82, d - 2.3, m.fabric(cover), 0.06)
  k.rbox(g, w - 0.04, 0.95, 2.2, 0.14, 0.82, d - 2.3, m.fabric(cover), 0.06)
  k.rbox(g, -0.04, 0.95, d - 0.18, w + 0.08, 0.82, 0.14, m.fabric(cover), 0.06)
  k.rbox(g, -0.09, 1.72, d - 2, w + 0.18, 0.12, 1.1, m.fabric('#c9a77c'), 0.05)
  // pillows
  const pw = w / 2 - 0.3
  for (const x of [0.2, w / 2 + 0.1]) k.rbox(g, x, 1.6, 0.5, pw, 0.45, 1.2, m.fabric('#ffffff'), 0.2).rotation.x = -0.35
  k.rbox(g, w / 2 - 0.7, 1.62, 1.35, 1.4, 0.9, 0.35, m.fabric(cover === '#e9e4da' ? '#7c8f7a' : '#e9e4da'), 0.15).rotation.x = -0.3
  // upholstered, tufted headboard
  k.rbox(g, -0.15, 0.4, 0, w + 0.3, 3.7, 0.3, m.fabric(head), 0.08)
  const n = 6, pwid = (w + 0.1) / n
  for (let i = 0; i < n; i++) k.rbox(g, -0.05 + i * pwid + 0.03, 1.5, 0.28, pwid - 0.06, 2.45, 0.16, m.fabric(head), 0.07)
  return g
}

export function nightstand(k: Kit, lamp = true): G {
  const g = group(), { m } = k
  const wood = m.wood('#6b4a2f')
  k.rbox(g, 0, 0.25, 0, 1.7, 1.6, 1.5, wood, 0.04)
  for (const x of [0.12, 1.46]) for (const z of [0.12, 1.26]) k.box(g, x, 0, z, 0.12, 0.25, 0.12, m.metal('#1f2937', 0.4))
  for (const y of [0.35, 1.08]) {
    k.rbox(g, 0.08, y, 1.48, 1.54, 0.66, 0.06, m.wood('#7a5636'), 0.02)
    k.box(g, 0.6, y + 0.5, 1.53, 0.5, 0.04, 0.05, m.metal('#c9a86a', 0.25))
  }
  if (lamp) {
    k.lathe(g, 'lampbase', [[0, 0], [0.32, 0], [0.36, 0.08], [0.3, 0.35], [0.38, 0.75], [0.14, 1.05], [0.06, 1.1], [0, 1.1]], 0.85, 1.85, 0.6, m.ceramic)
    k.cyl(g, 0.85, 2.9, 0.6, 0.02, 0.02, 0.4, m.metal('#d4b483'), 8)
    k.cyl(g, 0.85, 3.05, 0.6, 0.38, 0.52, 0.75, m.shade, 24, true)
    k.sphere(g, 0.85, 3.25, 0.6, 0.12, m.bulb)
  }
  return g
}

export function sofa(k: Kit, w: number, d: number, color: string, accents: [string, string]): G {
  const g = group(), { m } = k
  const f = m.fabric(color)
  for (const [x, z] of [[0.35, 0.3], [w - 0.35, 0.3], [0.35, d - 0.3], [w - 0.35, d - 0.3]]) k.cyl(g, x, 0, z, 0.07, 0.05, 0.4, m.wood('#3b2a1c'), 10)
  k.rbox(g, 0, 0.4, 0, w, 0.75, d, f, 0.12)
  k.rbox(g, 0.05, 0.9, 0, w - 0.1, 2.0, 0.75, f, 0.22)
  for (const x of [0, w - 0.7]) k.rbox(g, x, 0.4, 0, 0.7, 1.85, d, f, 0.25)
  const cw = (w - 1.4) / 3
  for (let i = 0; i < 3; i++) {
    k.rbox(g, 0.7 + i * cw + 0.02, 1.12, 0.75, cw - 0.04, 0.55, d - 0.78, f, 0.22)
    const back = k.rbox(g, 0.7 + i * cw + 0.04, 1.65, 0.62, cw - 0.08, 1.35, 0.6, f, 0.26)
    back.rotation.x = -0.14
  }
  const p1 = k.rbox(g, 0.85, 1.72, 1.05, 1.35, 1.35, 0.42, m.fabric(accents[0]), 0.2)
  p1.rotation.set(-0.25, 0.35, 0.1)
  const p2 = k.rbox(g, w - 2.2, 1.72, 1.05, 1.35, 1.35, 0.42, m.fabric(accents[1]), 0.2)
  p2.rotation.set(-0.25, -0.35, -0.1)
  return g
}

export function coffeeTable(k: Kit, w = 4.4, d = 2.4): G {
  const g = group(), { m } = k
  const walnut = m.wood('#5c3d26')
  k.rbox(g, 0, 1.25, 0, w, 0.14, d, walnut, 0.05)
  for (const [x, z] of [[0.3, 0.3], [w - 0.3, 0.3], [0.3, d - 0.3], [w - 0.3, d - 0.3]]) k.cyl(g, x, 0, z, 0.09, 0.05, 1.25, walnut, 12)
  k.rbox(g, 0.25, 0.35, 0.25, w - 0.5, 0.07, d - 0.5, m.wood('#a37b55'), 0.02)
  // decor: books, tray and vase
  const cols = ['#1e3a5f', '#b45309', '#e7e5e4']
  cols.forEach((c, i) => k.rbox(g, 0.5 + i * 0.04, 1.39 + i * 0.12, 0.6, 1.1 - i * 0.1, 0.11, 0.8, m.paint(c, 0.7), 0.02))
  k.rbox(g, w - 1.9, 1.39, d / 2 - 0.5, 1.4, 0.06, 1, m.metal('#c9a86a', 0.3), 0.03)
  k.lathe(g, 'vase', [[0, 0], [0.18, 0], [0.26, 0.2], [0.2, 0.55], [0.1, 0.75], [0.12, 0.85], [0, 0.85]], w - 1.2, 1.45, d / 2, m.ceramic)
  k.ball(g, w - 1.2, 2.45, d / 2, 0.32, m.leaf('#5f8f4e'), 1, 0.7, 1, 1)
  return g
}

export function rug(k: Kit, w: number, d: number): G {
  const g = group()
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), k.m.rug)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(w / 2, 0.06, d / 2)
  mesh.receiveShadow = true
  g.add(mesh)
  return g
}

export function tvUnit(k: Kit, w = 6.5): G {
  const g = group(), { m } = k
  const wood = m.wood('#6b4a2f')
  for (const x of [0.3, w - 0.3]) for (const z of [0.3, 1.1]) k.cyl(g, x, 0, z, 0.06, 0.04, 0.35, m.metal('#111827', 0.4), 8)
  k.rbox(g, 0, 0.35, 0, w, 1.45, 1.4, wood, 0.04)
  const n = 3, dw = w / n
  for (let i = 0; i < n; i++) {
    k.rbox(g, i * dw + 0.05, 0.42, 1.38, dw - 0.1, 1.3, 0.05, m.wood('#7a5636'), 0.02)
    k.box(g, i * dw + dw / 2 - 0.3, 1.55, 1.43, 0.6, 0.04, 0.04, m.metal('#c9a86a', 0.25))
  }
  // wall-mounted TV
  const tw = Math.min(5, w - 0.8)
  k.rbox(g, (w - tw) / 2, 2.6, 0.1, tw, tw * 0.5625, 0.12, m.blackGlass, 0.03)
  k.box(g, (w - tw) / 2 + 0.08, 2.68, 0.225, tw - 0.16, tw * 0.5625 - 0.16, 0.01, m.screen)
  k.rbox(g, w / 2 - 0.9, 1.8, 0.4, 1.8, 0.22, 0.6, m.blackGlass, 0.05)
  return g
}

export function diningChair(k: Kit, fabric: string): G {
  const g = group(), { m } = k
  const wood = m.wood('#4a3220')
  for (const [x, z] of [[0.15, 0.15], [1.35, 0.15], [0.15, 1.35], [1.35, 1.35]]) k.cyl(g, x, 0, z, 0.06, 0.05, 1.45, wood, 8)
  k.rbox(g, 0, 1.45, 0, 1.5, 0.22, 1.5, m.fabric(fabric), 0.08)
  for (const x of [0.1, 1.28]) k.rbox(g, x, 1.6, 0.04, 0.12, 1.75, 0.12, wood, 0.03).rotation.x = -0.08
  const back = k.rbox(g, 0.12, 2.1, 0.06, 1.26, 1.1, 0.16, m.fabric(fabric), 0.07)
  back.rotation.x = -0.08
  return g
}

export function diningTable(k: Kit, w: number, d: number, ceilingAbove: number): G {
  const g = group(), { m } = k
  const oak = m.wood('#9a6b43')
  k.rbox(g, 0, 2.35, 0, w, 0.16, d, oak, 0.05)
  for (const [x, z] of [[0.35, 0.35], [w - 0.55, 0.35], [0.35, d - 0.55], [w - 0.55, d - 0.55]]) k.rbox(g, x, 0, z, 0.2, 2.35, 0.2, oak, 0.03)
  k.box(g, 0.45, 2.1, d / 2 - 0.05, w - 0.9, 0.25, 0.1, oak)
  // runner, bowl and fruit
  k.box(g, 0.6, 2.515, d / 2 - 0.45, w - 1.2, 0.01, 0.9, m.fabric('#e4d9c3'))
  k.lathe(g, 'bowl', [[0, 0], [0.25, 0], [0.5, 0.1], [0.62, 0.32], [0.58, 0.33], [0.45, 0.14], [0, 0.06]], w / 2, 2.52, d / 2, m.ceramic)
  for (const [dx, dz, c] of [[-0.15, 0, '#d97706'], [0.18, 0.05, '#65a30d'], [0, -0.18, '#dc2626'], [0.05, 0.2, '#f59e0b']] as const) k.sphere(g, w / 2 + dx, 2.78, d / 2 + dz, 0.16, k.m.paint(c, 0.5))
  // pendant lights
  for (const fx of [0.3, 0.7]) {
    const x = w * fx
    k.cyl(g, x, 7.4, d / 2, 0.012, 0.012, ceilingAbove - 7.4, m.metal('#111827', 0.5), 6)
    k.lathe(g, 'pendant', [[0.02, 0.62], [0.12, 0.6], [0.45, 0.1], [0.5, 0], [0.48, 0], [0.43, 0.09], [0.1, 0.56], [0, 0.58]], x, 6.8, d / 2, m.metal('#1f2937', 0.35))
    k.sphere(g, x, 6.9, d / 2, 0.14, m.bulb)
  }
  return g
}

export function kitchen(k: Kit, L: number, withFridge: boolean): G {
  const g = group(), { m } = k
  const cab = m.paint('#f3f1ec', 0.45), front = m.paint('#e9e5dc', 0.4), handle = m.metal('#9ca3af', 0.25)
  const run = withFridge ? L - 3.2 : L
  k.box(g, 0, 0, 0, run, 0.35, 1.85, m.paint('#2b2f36', 0.8))
  k.box(g, 0, 0.35, 0, run, 2.6, 1.95, cab)
  const n = Math.max(1, Math.round(run / 1.8)), dw = run / n
  for (let i = 0; i < n; i++) {
    k.rbox(g, i * dw + 0.03, 0.4, 1.95, dw - 0.06, i % 2 ? 2.5 : 0.62, 0.06, front, 0.02)
    if (i % 2 === 0) k.rbox(g, i * dw + 0.03, 1.08, 1.95, dw - 0.06, 1.82, 0.06, front, 0.02)
    k.box(g, i * dw + dw / 2 - 0.35, i % 2 ? 2.7 : 0.88, 2.02, 0.7, 0.05, 0.06, handle)
  }
  k.rbox(g, -0.03, 2.95, -0.02, run + 0.06, 0.14, 2.2, m.granite, 0.03)
  // backsplash
  k.box(g, 0, 3.09, 0, run, 1.9, 0.04, m.paint('#dfe7ea', 0.2))
  // sink + faucet
  const sx = run * 0.3
  k.box(g, sx - 1.1, 3.095, 0.45, 2.2, 0.02, 1.4, m.metal('#8b949e', 0.35))
  k.box(g, sx - 1.0, 3.1, 0.55, 2.0, 0.01, 1.2, m.metal('#4b5563', 0.4))
  k.cyl(g, sx, 3.09, 0.3, 0.07, 0.09, 1.1, m.metal('#e5e7eb', 0.12), 12)
  const spout = k.torus(g, sx, 4.15, 0.6, 0.3, 0.05, m.metal('#e5e7eb', 0.12), Math.PI)
  spout.rotation.y = Math.PI / 2
  // cooktop + hood
  const cx = run * 0.72
  k.box(g, cx - 1, 3.095, 0.35, 2, 0.03, 1.5, m.blackGlass)
  for (const [dx, dz, r] of [[-0.5, 0.75, 0.28], [0.5, 0.75, 0.22], [-0.5, 1.45, 0.22], [0.5, 1.45, 0.28]]) k.torus(g, cx + dx, 3.13, 0.35 + dz - 0.35, r, 0.012, m.metal('#6b7280', 0.5)).rotation.x = Math.PI / 2
  k.box(g, cx - 1.25, 5.6, 0, 2.5, 0.5, 1.6, m.metal('#cbd5e1', 0.3))
  k.box(g, cx - 0.5, 6.1, 0, 1, 3, 0.8, m.metal('#cbd5e1', 0.3))
  // upper cabinets (skipping the hood)
  for (const [a, b] of [[0, cx - 1.3], [cx + 1.3, run]]) {
    if (b - a < 1) continue
    k.box(g, a, 5.0, 0, b - a, 2.4, 1.15, cab)
    const nn = Math.max(1, Math.round((b - a) / 1.6)), uw = (b - a) / nn
    for (let i = 0; i < nn; i++) {
      k.rbox(g, a + i * uw + 0.03, 5.05, 1.15, uw - 0.06, 2.3, 0.05, front, 0.02)
      k.box(g, a + i * uw + (i % 2 ? 0.2 : uw - 0.26), 5.2, 1.2, 0.05, 0.6, 0.05, handle)
    }
  }
  if (withFridge) {
    k.rbox(g, run + 0.1, 0, 0, 3, 6.3, 2.3, m.metal('#d1d5db', 0.28), 0.08)
    k.box(g, run + 0.1 + 1.49, 0.2, 2.29, 0.02, 6, 0.02, m.metal('#6b7280', 0.4))
    for (const x of [run + 1.35, run + 1.75]) k.box(g, x, 2.6, 2.32, 0.06, 2, 0.08, handle)
  }
  return g
}

export function island(k: Kit, w: number): G {
  const g = group(), { m } = k
  k.box(g, 0.2, 0, 0.2, w - 0.4, 0.3, 2.2, m.paint('#2b2f36', 0.8))
  k.rbox(g, 0, 0.3, 0, w, 2.65, 2.6, m.wood('#6b4a2f'), 0.03)
  k.rbox(g, -0.1, 2.95, -0.1, w + 0.2, 0.14, 3.6, m.granite, 0.03)
  for (let i = 0; i < Math.floor(w / 2); i++) {
    const x = 1 + i * 2
    k.cyl(g, x, 0, 3.4, 0.35, 0.4, 0.05, m.metal('#1f2937', 0.4))
    k.cyl(g, x, 0, 3.4, 0.05, 0.05, 2.4, m.metal('#d1d5db', 0.2), 8)
    k.torus(g, x, 0.9, 3.4, 0.28, 0.025, m.metal('#d1d5db', 0.2)).rotation.x = Math.PI / 2
    k.cyl(g, x, 2.4, 3.4, 0.55, 0.5, 0.2, m.fabric('#3f3f46'), 20)
  }
  return g
}

export function toilet(k: Kit): G {
  const g = group(), { m } = k
  k.rbox(g, 0.15, 1.5, 0, 1.5, 1.35, 0.6, m.ceramic, 0.12)
  k.cyl(g, 0.9, 2.85, 0.3, 0.12, 0.12, 0.04, m.metal('#e5e7eb', 0.15), 12)
  const bowl = k.lathe(g, 'bowl2', [[0, 0], [0.42, 0], [0.38, 0.5], [0.55, 1.0], [0.62, 1.32], [0.5, 1.36], [0, 1.36]], 0.9, 0, 1.25, m.ceramic)
  bowl.scale.set(1, 1, 1.25)
  const seat = k.cyl(g, 0.9, 1.36, 1.3, 0.62, 0.62, 0.08, m.ceramic, 24)
  seat.scale.set(1, 1, 1.28)
  return g
}

export function vanity(k: Kit, w = 3): G {
  const g = group(), { m } = k
  k.rbox(g, 0, 1.2, 0, w, 1.6, 1.7, m.wood('#5c3d26'), 0.04)
  k.box(g, 0.05, 1.5, 1.7, w - 0.1, 0.03, 0.03, m.metal('#c9a86a', 0.3))
  k.rbox(g, -0.05, 2.8, -0.02, w + 0.1, 0.12, 1.8, m.granite, 0.03)
  k.lathe(g, 'basin', [[0, 0], [0.35, 0], [0.62, 0.15], [0.7, 0.42], [0.66, 0.43], [0.58, 0.18], [0.3, 0.06], [0, 0.06]], w / 2, 2.92, 0.95, m.ceramic)
  k.cyl(g, w / 2, 2.92, 0.25, 0.05, 0.06, 0.95, m.metal('#e5e7eb', 0.12), 10)
  k.box(g, w / 2 - 0.04, 3.75, 0.25, 0.08, 0.08, 0.45, m.metal('#e5e7eb', 0.12))
  k.rbox(g, 0.1, 3.6, 0, w - 0.2, 2.8, 0.08, m.mirror, 0.03)
  k.rbox(g, 0.05, 3.55, -0.01, w - 0.1, 2.9, 0.07, m.metal('#1f2937', 0.4), 0.03)
  return g
}

export function shower(k: Kit, w: number, d: number): G {
  const g = group(), { m } = k
  k.box(g, 0, 0, 0, w, 0.12, d, m.paint('#e5e7eb', 0.3))
  k.box(g, 0, 0.12, d - 0.05, w * 0.7, 6.4, 0.05, m.glass)
  k.box(g, w * 0.7, 0.12, d - 0.06, 0.05, 6.4, 0.07, m.metal('#d1d5db', 0.2))
  k.cyl(g, w / 2, 0.5, 0.15, 0.04, 0.04, 6, m.metal('#e5e7eb', 0.12), 8)
  k.cyl(g, w / 2, 6.4, 0.6, 0.4, 0.4, 0.06, m.metal('#e5e7eb', 0.12), 20)
  return g
}

export function wardrobe(k: Kit, w: number): G {
  const g = group(), { m } = k
  k.rbox(g, 0, 0, 0, w, 7.2, 2, m.wood('#b08a62'), 0.03)
  const n = Math.max(2, Math.round(w / 1.7)), dw = w / n
  for (let i = 0; i < n; i++) {
    k.rbox(g, i * dw + 0.03, 0.15, 1.98, dw - 0.06, 6.9, 0.05, m.wood('#c29a70'), 0.02)
    k.box(g, i * dw + (i % 2 ? 0.15 : dw - 0.2), 3, 2.04, 0.05, 1.4, 0.06, m.metal('#1f2937', 0.35))
  }
  return g
}

export function shelving(k: Kit, w: number): G {
  const g = group(), { m } = k
  const steel = m.metal('#9ca3af', 0.4)
  for (const x of [0, w - 0.1]) for (const z of [0, 1.4]) k.box(g, x, 0, z, 0.1, 7, 0.1, steel)
  for (let lvl = 0; lvl < 5; lvl++) {
    const y = 0.4 + lvl * 1.6
    k.box(g, 0, y, 0, w, 0.06, 1.5, steel)
    for (let x = 0.2; x < w - 1; x += 1.1 + k.rand() * 0.4) {
      const bw = 0.8 + k.rand() * 0.4, bh = 0.6 + k.rand() * 0.7
      k.rbox(g, x, y + 0.06, 0.15, bw, bh, 1.1, m.paint(['#c8a26b', '#d6b98c', '#94a3b8', '#e7e5e4'][Math.floor(k.rand() * 4)], 0.9), 0.02)
    }
  }
  return g
}

export function officeChair(k: Kit, color = '#1f2937'): G {
  const g = group(), { m } = k
  const base = m.metal('#374151', 0.4)
  for (let i = 0; i < 5; i++) {
    const leg = k.box(g, -0.05, 0.15, 0, 0.1, 0.1, 1.05, base)
    leg.position.set(0.75 + Math.sin((i / 5) * Math.PI * 2) * 0.5, 0.2, 0.75 + Math.cos((i / 5) * Math.PI * 2) * 0.5)
    leg.rotation.y = (i / 5) * Math.PI * 2
    k.sphere(g, 0.75 + Math.sin((i / 5) * Math.PI * 2) * 1, 0.1, 0.75 + Math.cos((i / 5) * Math.PI * 2) * 1, 0.1, m.rubber)
  }
  k.cyl(g, 0.75, 0.2, 0.75, 0.08, 0.08, 1.3, m.metal('#d1d5db', 0.2), 10)
  k.rbox(g, 0, 1.5, 0, 1.6, 0.3, 1.6, m.fabric(color), 0.12)
  const back = k.rbox(g, 0.1, 1.9, -0.05, 1.4, 2.0, 0.22, m.fabric(color), 0.1)
  back.rotation.x = -0.12
  for (const x of [-0.05, 1.5]) k.rbox(g, x, 2.15, 0.3, 0.15, 0.1, 0.9, m.rubber, 0.04)
  return g
}

export function desk(k: Kit, w: number, d: number, monitors = 1): G {
  const g = group(), { m } = k
  k.rbox(g, 0, 2.38, 0, w, 0.1, d, m.wood('#c9a77c'), 0.03)
  for (const x of [0.1, w - 0.2]) k.box(g, x, 0, 0.15, 0.1, 2.38, d - 0.3, m.metal('#374151', 0.4))
  for (let i = 0; i < monitors; i++) {
    const x = monitors === 1 ? w / 2 : w * (0.3 + i * 0.4)
    k.cyl(g, x, 2.48, 0.5, 0.35, 0.4, 0.04, m.metal('#374151', 0.3))
    k.box(g, x - 0.05, 2.5, 0.42, 0.1, 0.9, 0.06, m.metal('#9ca3af', 0.3))
    k.rbox(g, x - 0.95, 2.95, 0.38, 1.9, 1.15, 0.08, m.blackGlass, 0.03)
    k.box(g, x - 0.9, 3.0, 0.465, 1.8, 1.05, 0.005, m.screen)
    k.rbox(g, x - 0.6, 2.48, 1.1, 1.2, 0.05, 0.4, m.paint('#e5e7eb', 0.5), 0.02)
  }
  return g
}

export function bookshelf(k: Kit, w: number): G {
  const g = group(), { m } = k
  const wood = m.wood('#7a5636')
  k.box(g, 0, 0, 0, w, 6.5, 0.05, wood)
  for (const x of [0, w - 0.1]) k.box(g, x, 0, 0, 0.1, 6.5, 1.1, wood)
  for (let s = 0; s < 5; s++) {
    const y = 0.2 + s * 1.3
    k.box(g, 0, y, 0, w, 0.08, 1.1, wood)
    let x = 0.15
    while (x < w - 0.4) {
      const bw = 0.12 + k.rand() * 0.14, bh = 0.7 + k.rand() * 0.35
      k.box(g, x, y + 0.08, 0.15 + k.rand() * 0.1, bw, bh, 0.75, m.paint(['#7f1d1d', '#1e3a8a', '#166534', '#a16207', '#e7e5e4', '#334155'][Math.floor(k.rand() * 6)], 0.8))
      x += bw + 0.02
      if (k.rand() > 0.9) x += 0.4
    }
  }
  return g
}

export function car(k: Kit): G {
  const g = group(), { m } = k
  const paint = m.carPaint('#9f1239')
  // lower body, with a sloping bonnet and boot
  k.rbox(g, 0, 0.7, 0.3, 6, 1.25, 13, paint, 0.45)
  const bonnet = k.rbox(g, 0.1, 1.55, 0.6, 5.8, 0.7, 3.6, paint, 0.3)
  bonnet.rotation.x = 0.07
  k.rbox(g, 0.1, 1.6, 9.6, 5.8, 0.65, 3.4, paint, 0.3)
  k.rbox(g, 0.05, 1.7, 3.9, 5.9, 0.55, 6, paint, 0.2)
  // glasshouse: tapered by stacking two rounded slabs, then the roof
  k.rbox(g, 0.45, 2.15, 4.1, 5.1, 0.75, 5.5, m.carGlass, 0.35)
  k.rbox(g, 0.6, 2.85, 4.6, 4.8, 0.6, 4.5, m.carGlass, 0.3)
  k.rbox(g, 0.62, 3.4, 4.75, 4.76, 0.14, 4.2, paint, 0.07)
  for (const z of [6.6]) for (const x of [0.5, 5.38]) k.box(g, x, 2.2, z, 0.12, 1.2, 0.3, paint)
  for (const [x, z] of [[-0.1, 2.4], [5.4, 2.4], [-0.1, 10.8], [5.4, 10.8]]) {
    const tyre = k.cyl(g, x + 0.35, 0, z, 1.05, 1.05, 0.7, m.rubber, 24)
    tyre.rotation.z = Math.PI / 2
    tyre.position.y = 1.05
    const rim = k.cyl(g, x < 1 ? x - 0.01 : x + 0.71, 0, z, 0.62, 0.62, 0.05, m.metal('#d1d5db', 0.15), 20)
    rim.rotation.z = Math.PI / 2
    rim.position.y = 1.05
  }
  for (const x of [0.5, 4.5]) {
    k.rbox(g, x, 1.85, 0.15, 1, 0.35, 0.2, m.bulb, 0.08)
    k.rbox(g, x, 1.85, 13.25, 1, 0.3, 0.2, m.redLight, 0.08)
  }
  k.rbox(g, 1.6, 1.0, 0.1, 2.8, 0.5, 0.15, m.blackGlass, 0.05)
  for (const x of [-0.35, 5.95]) k.rbox(g, x, 2.6, 4.2, 0.4, 0.3, 0.55, paint, 0.1)
  return g
}

export function loungeChair(k: Kit, cushion: string): G {
  const g = group(), { m } = k
  const teak = m.wood('#8b5a2b')
  for (const x of [0, 2.15]) k.rbox(g, x, 0, 0, 0.25, 2.1, 2.6, teak, 0.05)
  k.box(g, 0.25, 0.9, 0.2, 1.9, 0.12, 2.2, teak)
  k.rbox(g, 0.25, 1.02, 0.35, 1.9, 0.42, 2.1, m.fabric(cushion), 0.15)
  const back = k.rbox(g, 0.28, 1.4, 0.1, 1.84, 1.9, 0.45, m.fabric(cushion), 0.18)
  back.rotation.x = -0.25
  return g
}

export function sideTable(k: Kit): G {
  const g = group(), { m } = k
  k.cyl(g, 0.8, 1.7, 0.8, 0.8, 0.8, 0.1, m.wood('#8b5a2b'), 24)
  k.cyl(g, 0.8, 0, 0.8, 0.07, 0.07, 1.7, m.metal('#1f2937', 0.4), 10)
  k.cyl(g, 0.8, 0, 0.8, 0.45, 0.5, 0.06, m.metal('#1f2937', 0.4), 20)
  return g
}

export function plant(k: Kit, h = 3.5, kind: 'bush' | 'tall' = 'bush'): G {
  const g = group(), { m } = k
  k.lathe(g, 'pot', [[0, 0], [0.45, 0], [0.62, 1.1], [0.66, 1.15], [0.6, 1.2], [0, 1.2]], 0.7, 0, 0.7, m.paint('#b45f3c', 0.85))
  k.cyl(g, 0.7, 1.1, 0.7, 0.58, 0.58, 0.05, m.paint('#3b2a1f', 1), 16)
  const greens = ['#4d7c3a', '#5f8f4e', '#3f6b30', '#6b9c55']
  if (kind === 'tall') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, lean = 0.15 + k.rand() * 0.25
      const leaf = k.ball(g, 0.7 + Math.sin(a) * 0.15, 1.2 + (h - 1.2) / 2, 0.7 + Math.cos(a) * 0.15, 1, m.leaf(greens[i % 4]), 0.16, (h - 1.2) / 2, 0.05, 1)
      leaf.rotation.set(Math.cos(a) * lean, a, -Math.sin(a) * lean)
    }
  } else {
    const r = (h - 1.2) * 0.42
    for (let i = 0; i < 7; i++) {
      const a = k.rand() * Math.PI * 2, rr = k.rand() * r * 0.6
      k.ball(g, 0.7 + Math.cos(a) * rr, 1.2 + r * 0.9 + k.rand() * r * 0.8, 0.7 + Math.sin(a) * rr, r * (0.55 + k.rand() * 0.35), m.leaf(greens[i % 4]))
    }
  }
  return g
}

export function tree(k: Kit, h: number): G {
  const g = group(), { m } = k
  k.cyl(g, 0, 0, 0, 0.35, 0.6, h * 0.55, m.wood('#5b4030'), 10)
  const greens = ['#4d7c3a', '#3f6b30', '#5f8f4e', '#55833f']
  for (let i = 0; i < 9; i++) {
    const a = k.rand() * Math.PI * 2, rr = 1 + k.rand() * h * 0.18
    k.ball(g, Math.cos(a) * rr, h * (0.55 + k.rand() * 0.35), Math.sin(a) * rr, h * (0.16 + k.rand() * 0.1), m.leaf(greens[i % 4]))
  }
  return g
}

export function meetingTable(k: Kit, w: number, d: number): G {
  const g = group(), { m } = k
  k.rbox(g, 0, 2.38, 0, w, 0.12, d, m.wood('#d6c4a8'), 0.6)
  for (const x of [w * 0.25, w * 0.75]) k.rbox(g, x - 0.4, 0, d / 2 - 0.9, 0.8, 2.38, 1.8, m.metal('#374151', 0.35), 0.1)
  return g
}

// ---------------------------------------------------------------------------

/** Merges all meshes under `root` into one mesh per material, to keep draw calls low. */
export function mergeByMaterial(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true)
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    g.applyMatrix4(mesh.matrixWorld)
    g.clearGroups()
    const mat = mesh.material as THREE.Material
    if (!buckets.has(mat)) buckets.set(mat, [])
    buckets.get(mat)!.push(g)
  })
  const out = new THREE.Group()
  buckets.forEach((list, mat) => {
    const merged = mergeGeometries(list, false)
    list.forEach((x) => x.dispose())
    if (!merged) return
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = !(mat as THREE.MeshPhysicalMaterial).transparent
    mesh.receiveShadow = true
    out.add(mesh)
  })
  return out
}
