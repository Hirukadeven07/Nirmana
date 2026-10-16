import * as THREE from 'three'

/*
 * Turns the finish names in a HousePlan ("Teak timber flooring", "Full-height ceramic wall tiles") into
 * Three.js materials with procedural textures, so the walkthrough shows the materials the room is specced with.
 * Texture sizes are in feet so tiles and planks come out at their real size on any surface.
 */

export type FloorKind = 'wood' | 'granite' | 'terrazzo' | 'paving' | 'cement' | 'tile-large' | 'tile-small' | 'plain'
export type WallKind = 'emulsion' | 'tile' | 'dado' | 'exterior' | 'wash'
export type CeilingKind = 'gypsum' | 'pvc' | 'timber' | 'slab' | 'open'

export const floorKind = (f: string): FloorKind =>
  /teak|timber|wood|parquet/i.test(f) ? 'wood'
  : /granite|marble/i.test(f) ? 'granite'
  : /terrazzo/i.test(f) ? 'terrazzo'
  : /paving|cobble|brick/i.test(f) ? 'paving'
  : /polished cement|titanium|grano|screed|concrete|cement/i.test(f) ? 'cement'
  : /anti-slip|300\s*[×x]\s*300/i.test(f) ? 'tile-small'
  : /tile|ceramic|porcelain|homogeneous/i.test(f) ? 'tile-large'
  : 'plain'

export const wallKind = (w: string): WallKind =>
  /full-height/i.test(w) || /ceramic wall tiles/i.test(w) ? 'tile'
  : /dado/i.test(w) ? 'dado'
  : /weather|exterior/i.test(w) ? 'exterior'
  : /cement wash|wash/i.test(w) ? 'wash'
  : 'emulsion'

export const ceilingKind = (c: string): CeilingKind =>
  /open/i.test(c) ? 'open'
  : /pvc/i.test(c) ? 'pvc'
  : /timber|rafter|soffit/i.test(c) ? 'timber'
  : /exposed|slab/i.test(c) ? 'slab'
  : 'gypsum'

/** Feet of surface covered by one repeat of the texture. */
const TEX_FT: Record<string, number> = {
  wood: 6, granite: 5, terrazzo: 6, paving: 4, cement: 8, 'tile-large': 3.94, 'tile-small': 3.94, plain: 6,
  emulsion: 6, tile: 3.94, dado: 6, exterior: 6, wash: 6, gypsum: 8, pvc: 4, timber: 6, slab: 8,
}
export const textureFeet = (kind: string) => TEX_FT[kind] ?? 6

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
}

function canvas(n = 512) {
  const c = document.createElement('canvas')
  c.width = c.height = n
  return { c, g: c.getContext('2d')! }
}

function speckle(g: CanvasRenderingContext2D, n: number, count: number, alpha: number, rand: () => number, light = true) {
  for (let i = 0; i < count; i++) {
    const v = light ? 255 : 0
    g.fillStyle = `rgba(${v},${v},${v},${rand() * alpha})`
    const s = 1 + rand() * 2.2
    g.fillRect(rand() * n, rand() * n, s, s)
  }
}

function tint(hex: string, amount: number) {
  const c = new THREE.Color(hex)
  c.offsetHSL(0, 0, amount)
  return `#${c.getHexString()}`
}

function grid(g: CanvasRenderingContext2D, n: number, cells: number, base: string, groutCol: string, groutPx: number, rand: () => number, vary = 0.03) {
  const s = n / cells
  g.fillStyle = groutCol
  g.fillRect(0, 0, n, n)
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
    g.fillStyle = tint(base, (rand() - 0.5) * vary)
    g.fillRect(i * s + groutPx / 2, j * s + groutPx / 2, s - groutPx, s - groutPx)
  }
}

function paint(kind: string, accent: string): { map: HTMLCanvasElement; rough: number; metal: number } {
  const n = 512
  const { c, g } = canvas(n)
  const rand = rng(kind.length * 977 + accent.length * 31 + kind.charCodeAt(0))
  let rough = 0.8
  let metal = 0
  switch (kind) {
    case 'wood': {
      // Planks running along the texture's x axis, 5 per repeat.
      const rows = 5
      const h = n / rows
      for (let r = 0; r < rows; r++) {
        const joint = rand() * n
        for (let part = 0; part < 2; part++) {
          const x0 = part === 0 ? 0 : joint, x1 = part === 0 ? joint : n
          const base = tint('#a9733f', (rand() - 0.5) * 0.09)
          g.fillStyle = base
          g.fillRect(x0, r * h, x1 - x0, h)
          for (let k = 0; k < 26; k++) {
            g.strokeStyle = `rgba(70,35,10,${0.04 + rand() * 0.1})`
            g.lineWidth = 0.6 + rand() * 1.2
            const y = r * h + rand() * h
            g.beginPath()
            g.moveTo(x0, y)
            g.bezierCurveTo(x0 + (x1 - x0) * 0.3, y + (rand() - 0.5) * 6, x0 + (x1 - x0) * 0.7, y + (rand() - 0.5) * 6, x1, y + (rand() - 0.5) * 4)
            g.stroke()
          }
          g.fillStyle = 'rgba(30,15,5,0.55)'
          g.fillRect(x0, r * h, x1 - x0, 1.5)
          g.fillRect(x0, r * h, 1.5, h)
        }
      }
      rough = 0.5
      break
    }
    case 'granite': {
      g.fillStyle = '#6f6b68'
      g.fillRect(0, 0, n, n)
      speckle(g, n, 5200, 0.8, rand, true)
      speckle(g, n, 4200, 0.7, rand, false)
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(200,150,130,${rand() * 0.5})`; g.fillRect(rand() * n, rand() * n, 1.5, 1.5) }
      rough = 0.28
      break
    }
    case 'terrazzo': {
      g.fillStyle = '#e4ded3'
      g.fillRect(0, 0, n, n)
      const chips = ['#9a8f84', '#c9b79c', '#7e8c8a', '#b5766a', '#f3efe6', '#5d5a57']
      for (let i = 0; i < 420; i++) {
        g.fillStyle = chips[Math.floor(rand() * chips.length)]!
        g.beginPath()
        const x = rand() * n, y = rand() * n, r = 2 + rand() * 7
        g.moveTo(x + r, y)
        for (let a = 1; a < 6; a++) g.lineTo(x + Math.cos((a * Math.PI) / 3) * r * (0.6 + rand() * 0.6), y + Math.sin((a * Math.PI) / 3) * r * (0.6 + rand() * 0.6))
        g.fill()
      }
      rough = 0.35
      break
    }
    case 'paving': {
      // Interlocking rectangular blocks laid in a running bond.
      g.fillStyle = '#5b5852'
      g.fillRect(0, 0, n, n)
      const bw = n / 4, bh = n / 8
      for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) {
        g.fillStyle = tint(['#9c9488', '#a8a094', '#8c857a'][Math.floor(rand() * 3)]!, (rand() - 0.5) * 0.04)
        g.fillRect(k * bw + (r % 2 ? bw / 2 : 0) + 1.5, r * bh + 1.5, bw - 3, bh - 3)
      }
      speckle(g, n, 2500, 0.18, rand, false)
      rough = 0.95
      break
    }
    case 'cement': {
      g.fillStyle = '#9d9a94'
      g.fillRect(0, 0, n, n)
      for (let i = 0; i < 40; i++) {
        const gr = g.createRadialGradient(rand() * n, rand() * n, 0, rand() * n, rand() * n, 60 + rand() * 90)
        gr.addColorStop(0, `rgba(${rand() > 0.5 ? '255,255,255' : '40,40,40'},0.05)`)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = gr
        g.fillRect(0, 0, n, n)
      }
      speckle(g, n, 3000, 0.12, rand, false)
      g.strokeStyle = 'rgba(40,40,40,0.35)'
      g.lineWidth = 1.5
      g.strokeRect(0, 0, n, n)
      rough = 0.42
      break
    }
    case 'tile-large': {
      grid(g, n, 2, '#ddd8cf', '#a9a398', 3, rand, 0.04)
      speckle(g, n, 1400, 0.12, rand, false)
      rough = 0.18
      metal = 0.05
      break
    }
    case 'tile-small': {
      grid(g, n, 4, '#bfb7aa', '#8d877c', 3, rand, 0.05)
      speckle(g, n, 5000, 0.25, rand, false)
      rough = 0.5
      break
    }
    case 'tile': {
      grid(g, n, 2, '#f1f0ea', '#b9b5aa', 3, rand, 0.02)
      rough = 0.14
      break
    }
    case 'wash': {
      g.fillStyle = '#b8b3a8'
      g.fillRect(0, 0, n, n)
      speckle(g, n, 6000, 0.22, rand, false)
      speckle(g, n, 6000, 0.22, rand, true)
      rough = 1
      break
    }
    case 'exterior': {
      g.fillStyle = accent || '#e6d7b8'
      g.fillRect(0, 0, n, n)
      speckle(g, n, 5000, 0.15, rand, false)
      rough = 0.9
      break
    }
    case 'emulsion': {
      g.fillStyle = accent || '#f1ece1'
      g.fillRect(0, 0, n, n)
      speckle(g, n, 2600, 0.06, rand, false)
      speckle(g, n, 2600, 0.08, rand, true)
      rough = 0.92
      break
    }
    case 'pvc': {
      g.fillStyle = '#f4f4f1'
      g.fillRect(0, 0, n, n)
      const strips = 8
      for (let i = 0; i < strips; i++) {
        g.fillStyle = 'rgba(120,120,120,0.45)'
        g.fillRect(0, (i * n) / strips, n, 2)
        g.fillStyle = 'rgba(255,255,255,0.7)'
        g.fillRect(0, (i * n) / strips + 2, n, 1.5)
      }
      rough = 0.35
      break
    }
    case 'timber': {
      g.fillStyle = '#7c5232'
      g.fillRect(0, 0, n, n)
      for (let i = 0; i < 6; i++) {
        g.fillStyle = tint('#7c5232', (rand() - 0.5) * 0.08)
        g.fillRect(i * (n / 6) + 2, 0, n / 6 - 4, n)
        for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(40,20,5,${0.1 + rand() * 0.15})`; g.beginPath(); const x = i * (n / 6) + rand() * (n / 6); g.moveTo(x, 0); g.lineTo(x + (rand() - 0.5) * 6, n); g.stroke() }
      }
      rough = 0.6
      break
    }
    case 'slab': {
      g.fillStyle = '#d4d1ca'
      g.fillRect(0, 0, n, n)
      speckle(g, n, 3500, 0.12, rand, false)
      rough = 0.95
      break
    }
    case 'gypsum': {
      g.fillStyle = '#f6f4ee'
      g.fillRect(0, 0, n, n)
      speckle(g, n, 1800, 0.05, rand, false)
      g.fillStyle = 'rgba(0,0,0,0.12)'
      g.fillRect(0, n / 2 - 1, n, 2)
      g.fillRect(n / 2 - 1, 0, 2, n)
      rough = 0.95
      break
    }
    default: {
      g.fillStyle = '#d9d4ca'
      g.fillRect(0, 0, n, n)
      speckle(g, n, 2000, 0.1, rand, false)
    }
  }
  return { map: c, rough, metal }
}

/** Colour named in a finish string ("Emulsion paint, cream"), or a default for plain emulsion. */
const COLOURS: Record<string, string> = {
  cream: '#efe4c8', white: '#f4f1ea', grey: '#b9b9b6', gray: '#b9b9b6', beige: '#e3d4b6', sand: '#e6d7b8', blue: '#bcd0de', green: '#c5d3b4', yellow: '#f0e2a8', pink: '#ecc9c4', terracotta: '#d19a7c',
}
export const accentFrom = (finish: string, fallback = '') => {
  const hit = Object.keys(COLOURS).find((k) => new RegExp(`\\b${k}\\b`, 'i').test(finish))
  return hit ? COLOURS[hit]! : fallback
}

/** Builds and caches materials so rooms sharing a finish also share textures. */
export class FinishLibrary {
  private cache = new Map<string, THREE.MeshStandardMaterial>()
  private owned: { dispose: () => void }[] = []

  get(kind: string, accent = ''): THREE.MeshStandardMaterial {
    const key = `${kind}|${accent}`
    const hit = this.cache.get(key)
    if (hit) return hit
    const { map, rough, metal } = paint(kind, accent)
    const tex = new THREE.CanvasTexture(map)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: metal })
    this.owned.push(tex, mat)
    this.cache.set(key, mat)
    return mat
  }

  plain(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const key = `plain|${color}|${JSON.stringify(opts)}`
    const hit = this.cache.get(key)
    if (hit) return hit
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts })
    this.owned.push(mat)
    this.cache.set(key, mat)
    return mat
  }

  dispose() {
    this.owned.forEach((o) => o.dispose())
    this.cache.clear()
  }
}

/**
 * A box whose UVs are scaled to feet, so a texture of `feet` size repeats at real scale on every face.
 * `faces` picks which surface each face uses ('x' = ±x faces, etc.) only for the mapping; materials are per call.
 */
export function boxGeometry(w: number, h: number, d: number, feet: number) {
  const geo = new THREE.BoxGeometry(Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01))
  const uv = geo.attributes.uv as THREE.BufferAttribute
  // BoxGeometry order: +x, -x, +y, -y, +z, -z; four vertices each.
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, (uv.getX(i) * dims[f]![0]) / feet, (uv.getY(i) * dims[f]![1]) / feet)
    }
  }
  uv.needsUpdate = true
  return geo
}
