import { layoutFor, type Layout, type Room } from './floorplans'
import type { HousePlan, PlanRoom, RoofType, RoomType, WorkStatus } from './housePlan'
import type { Project } from './types'
import { hashString } from '../lib/random'

/*
 * Builds the editable 3D house model plan for a project from the same layout its walkable
 * tour uses, so every project gets a model of its own building. Room finishes follow the
 * room type, and progress is estimated from the project's overall progress, with lower
 * floors further along than upper ones.
 */

const clamp = (v: number) => Math.max(0, Math.min(100, v))
const round5 = (v: number) => Math.round(v / 5) * 5

function roomType(label: string, kind: Room[5], style: Layout['style']): RoomType {
  const n = label.toLowerCase()
  if (kind === 'dashed') return 'outdoor'
  if (kind === 'stair') return 'stair'
  if (kind === 'wet') return 'wet'
  if (kind === 'core') return 'utility'
  if (kind === 'open' || /hall|lobby|landing|foyer|passage|mall|concourse|atrium/.test(n)) return 'circulation'
  if (n.includes('bed')) return 'bedroom'
  if (/kitchen|pantry/.test(n)) return 'kitchen'
  if (/study|reading/.test(n)) return 'study'
  if (/store|garage|laundry|walk-in/.test(n)) return 'utility'
  if (/living|lounge|saloon|sitting|media|dining|prayer|gym/.test(n)) return 'living'
  return style === 'house' ? 'living' : 'commercial'
}

const FINISH: Record<RoomType, Pick<PlanRoom, 'floorFinish' | 'wallFinish' | 'ceiling' | 'electrical'>> = {
  living: { floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', ceiling: 'Gypsum board, emulsion paint', electrical: '4 light points, 6 sockets' },
  bedroom: { floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', ceiling: 'Gypsum board, emulsion paint', electrical: '2 light points, 4 sockets, AC point' },
  kitchen: { floorFinish: 'Anti-slip ceramic 300×300', wallFinish: 'Ceramic dado to 4 ft, emulsion above', ceiling: 'Gypsum board, emulsion paint', electrical: '3 light points, 8 sockets, cooker point, exhaust fan' },
  wet: { floorFinish: 'Anti-slip ceramic 300×300', wallFinish: 'Full-height ceramic wall tiles', ceiling: 'PVC ceiling panels', electrical: '1 light, 1 shaver socket, exhaust fan' },
  circulation: { floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', ceiling: 'Gypsum board, emulsion paint', electrical: '1 light point' },
  stair: { floorFinish: 'Granite slab', wallFinish: 'Emulsion paint, 2 coats', ceiling: 'Soffit, painted', electrical: '2-way light switch' },
  utility: { floorFinish: 'Polished cement (titanium)', wallFinish: 'Cement wash', ceiling: 'Exposed slab, painted', electrical: '1 light point, 1 socket' },
  study: { floorFinish: 'Teak timber flooring', wallFinish: 'Emulsion paint, 2 coats', ceiling: 'Gypsum board, emulsion paint', electrical: '1 light point, 4 sockets, data point' },
  commercial: { floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', ceiling: 'Mineral fibre suspended ceiling', electrical: 'LED panels, floor boxes, data points' },
  outdoor: { floorFinish: 'Cement paving blocks', wallFinish: 'Weather-shield paint', ceiling: 'Open', electrical: '1 weatherproof light' },
}

/** Splits each room into rectangles over the cells it owns, so cut-outs (atria, stairs) don't overlap it. */
function ownedRooms(rooms: Room[], fill: string | undefined, W: number, D: number): Room[] {
  const fillIndex = fill ? rooms.length : -1
  const all: Room[] = fill ? [...rooms, [0, 0, W, D, fill]] : rooms
  const cells = new Int16Array(W * D).fill(fillIndex)
  rooms.forEach(([x, y, w, h], i) => {
    for (let yy = Math.max(0, y); yy < Math.min(D, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) cells[yy * W + xx] = i
  })
  const out: Room[] = []
  all.forEach((r, idx) => {
    const [rx, ry, rw, rh, label, kind] = r
    const rects: { x: number; y: number; w: number; h: number }[] = []
    let prev: { a: number; b: number; rect: (typeof rects)[number] }[] = []
    for (let y = Math.max(0, ry); y < Math.min(D, ry + rh); y++) {
      const next: typeof prev = []
      for (let x = Math.max(0, rx); x < Math.min(W, rx + rw);) {
        if (cells[y * W + x] !== idx) { x++; continue }
        const a = x
        while (x < rx + rw && x < W && cells[y * W + x] === idx) x++
        const p = prev.find((q) => q.a === a && q.b === x)
        if (p) { p.rect.h++; next.push(p) } else {
          const rect = { x: a, y, w: x - a, h: 1 }
          rects.push(rect)
          next.push({ a, b: x, rect })
        }
      }
      prev = next
    }
    // Skip slivers left between cut-outs; they are too small to be useful sections.
    const kept = rects.filter((q) => q.w >= 2 && q.h >= 2)
    kept.forEach((q, k) => out.push([q.x, q.y, q.w, q.h, kept.length > 1 ? `${label} (${k + 1})` : label, kind]))
  })
  return out
}

/** Progress of a project's structure and of each floor's finishes, from its overall progress. */
function progressFor(project: Project, floors: number) {
  const p = project.progress
  return {
    structure: {
      foundation: clamp((p / 16) * 100),
      groundSlab: clamp(((p - 10) / 10) * 100),
      slabs: Array.from({ length: Math.max(0, floors - 1) }, (_, i) => clamp(((p - 20 - (i + 1) * 12) / 10) * 100)),
      stair: clamp(((p - 30) / 15) * 100),
      roof: clamp(((p - 50) / 15) * 100),
    },
    floor: (i: number) => clamp(((p - 40 - i * 8) / 50) * 100),
  }
}

const statusOf = (progress: number): WorkStatus => (progress >= 100 ? 'Complete' : progress > 0 ? 'In progress' : 'Not started')

export function housePlanFor(project: Project): HousePlan {
  const layout = layoutFor(project)
  const { structure, floor } = progressFor(project, layout.levels.length)
  const commercial = layout.style !== 'house'
  let n = 0
  const floors = layout.levels.map((lv, i) => {
    const base = floor(i)
    const rooms: PlanRoom[] = ownedRooms(lv.rooms.filter((r) => r[5] !== 'void'), lv.fill, layout.width, layout.depth).map(([x, y, w, d, name, kind]) => {
      const type = roomType(name, kind, layout.style)
      // Rooms on the same floor move at slightly different paces.
      const jitter = base > 0 && base < 100 ? (hashString(`${project.id}${i}${name}`) % 21) - 10 : 0
      const progress = round5(clamp(base + jitter))
      return { id: `r${++n}`, name: name.trim(), type, x, y, w, d, ...FINISH[type], notes: '', status: statusOf(progress), progress }
    })
    return { id: `l${i}`, name: lv.name, height: lv.height + 0.7, rooms }
  })
  const roof: { type: RoofType; pitch: number; material: string } =
    layout.style === 'warehouse' ? { type: 'gable', pitch: 8, material: 'Zinc-aluminium roofing sheets on steel purlins' }
      : layout.roof?.kind === 'gable' || layout.roof?.kind === 'hip' ? { type: layout.roof.kind, pitch: layout.roof.pitch, material: 'Calicut clay tiles on treated timber' }
        : { type: 'flat', pitch: 5, material: 'Waterproofing membrane with screed to falls' }
  const lot = layout.lot
  return {
    name: project.name,
    location: project.location,
    client: project.client.name,
    architect: project.architect.org,
    plot: { w: Math.max(lot.maxX - lot.minX, layout.width + 8), d: Math.max(lot.maxY - lot.minY, layout.depth + 8) },
    setback: { x: Math.max(4, -lot.minX), y: Math.max(4, -lot.minY) },
    wallThickness: commercial ? 1 : 0.75,
    plinth: commercial ? 1 : 1.5,
    roof: { ...roof, overhang: layout.style === 'house' ? 2 : 1 },
    structure: commercial
      ? {
          foundation: layout.style === 'warehouse' ? 'Isolated pad footings for portal-frame columns' : 'Bored cast-in-situ piles with pile caps and ground beams',
          frame: layout.style === 'warehouse' ? 'Steel portal frames at 7.5 m centres' : 'RCC frame, grade 35 columns and beams',
          walls: layout.style === 'warehouse' ? 'Cement block dado to 10 ft with metal cladding above' : 'Curtain-wall glazing with 6" block infill',
          slab: '7" post-tensioned RCC slab',
        }
      : {
          foundation: 'Random rubble strip footing, 3 ft deep, with RCC plinth beam',
          frame: 'RCC columns 9"×9" with grade 25 concrete',
          walls: '9" brick walls (external), 4½" (internal), 1:5 cement mortar',
          slab: '5" RCC suspended slab, T10 @ 6" c/c both ways',
        },
    floors,
    progress: structure,
  }
}
