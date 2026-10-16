import clsx from 'clsx'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, DoorOpen, LogOut, Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { HousePlan } from '../../data/housePlan'
import { buildWalk, EYE, rectDist, type WalkRoom, type WalkScene } from './buildWalk'

const RADIUS = 0.5
const WALK = 5.5
const RUN = 11
const LIGHTS = 5

interface Api {
  press: (key: string, down: boolean) => void
  goTo: (r: WalkRoom) => void
}

/** First-person walkthrough of a house plan, with real finishes and a live "where am I" label. */
export function HouseWalk({ plan, onExit, full, onToggleFull }: { plan: HousePlan; onExit: () => void; full: boolean; onToggleFull: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasHost = useRef<HTMLDivElement>(null)
  const miniRef = useRef<HTMLCanvasElement>(null)
  const apiRef = useRef<Api | null>(null)
  const exitRef = useRef(onExit)
  const [hud, setHud] = useState({ room: '', level: '', floor: '', walls: '' })
  const [levels, setLevels] = useState<{ name: string; rooms: WalkRoom[] }[]>([])
  const [menu, setMenu] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => { exitRef.current = onExit })

  useEffect(() => {
    const host = canvasHost.current!
    const hostEl = hostRef.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#cfe3f3')
    const built: WalkScene = buildWalk(plan)
    scene.add(built.root)
    const size = built.size
    scene.fog = new THREE.Fog('#cfe3f3', size * 1.6, size * 5)
    setLevels(built.rooms.map((list, i) => ({
      name: built.levelNames[i]!,
      rooms: list.filter((w, k, all) => w.room.type !== 'stair' && all.findIndex((o) => o.room.name === w.room.name) === k),
    })))

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envMap
    scene.environmentIntensity = 0.5
    scene.add(new THREE.HemisphereLight('#eef5ff', '#8a7a60', 0.9))
    scene.add(new THREE.AmbientLight('#ffffff', 0.25))
    const sun = new THREE.DirectionalLight('#fff3df', 2.6)
    const c = built.centre
    sun.position.set(c.x + size * 0.6, 120, c.z + size * 0.5)
    sun.target.position.copy(c)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const sb = size * 0.8
    Object.assign(sun.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, near: 10, far: 400 })
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.05
    scene.add(sun, sun.target)

    const camera = new THREE.PerspectiveCamera(75, 1, 0.2, size * 10)
    camera.rotation.order = 'YXZ'
    const lamp = new THREE.PointLight('#fff1dc', 14, 24, 2)
    camera.add(lamp)
    scene.add(camera)
    // A few lights follow the nearest rooms, so every room reads as lit without a light per room.
    const pool = Array.from({ length: LIGHTS }, () => {
      const l = new THREE.PointLight('#ffe9c4', 0, 30, 2)
      scene.add(l)
      return l
    })

    const w = { x: built.start.x, z: built.start.z, yaw: built.start.yaw, pitch: -0.02, level: built.start.level, elev: 0, eye: 0 }
    w.elev = built.surfaceAt(w.x, w.z, w.level).elev
    w.eye = w.elev + EYE
    const keys = new Set<string>()
    const vel = new THREE.Vector2()

    const blocked = (x: number, z: number, level: number) => {
      if (!built.walkable(x, z, level)) return true
      return built.colliders[level]!.some((r) => rectDist(x, z, r) < RADIUS)
    }
    const clearance = (x: number, z: number, level: number) => built.colliders[level]!.reduce((m, r) => Math.min(m, rectDist(x, z, r)), 4)
    const quat = new THREE.Quaternion()
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')

    const goTo = (room: WalkRoom) => {
      // Stand back from the middle on clear floor and look across the room, as a visitor stepping in would.
      const r = room.room
      const ideal = Math.hypot(r.w, r.d) * 0.36
      let bx = room.x, bz = room.z, best = -Infinity
      const step = Math.max(0.75, Math.max(r.w, r.d) / 24)
      for (let x = r.x + 1.5; x <= r.x + r.w - 1.5; x += step) for (let z = r.y + 1.5; z <= r.y + r.d - 1.5; z += step) {
        if (blocked(x, z, room.level)) continue
        const score = Math.min(clearance(x, z, room.level), 2.5) - Math.abs(Math.hypot(x - room.x, z - room.z) - ideal) * 0.8
        if (score > best) { best = score; bx = x; bz = z }
      }
      const s = built.surfaceAt(bx, bz, room.level)
      w.x = bx; w.z = bz; w.level = s.level; w.elev = s.elev
      if (Math.hypot(room.x - bx, room.z - bz) > 0.5) w.yaw = Math.atan2(-(room.x - bx), -(room.z - bz))
      w.pitch = -0.1
      vel.set(0, 0)
    }
    apiRef.current = { press: (k, down) => { if (down) keys.add(k); else keys.delete(k) }, goTo }

    /* Input */
    const el = renderer.domElement
    let drag: null | { x: number; y: number; id: number } = null
    const onDown = (e: PointerEvent) => {
      hostEl.focus({ preventScroll: true })
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId }
      el.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return
      w.yaw += (e.clientX - drag.x) * 0.0042
      w.pitch = Math.max(-1.2, Math.min(1.2, w.pitch + (e.clientY - drag.y) * 0.0042))
      drag.x = e.clientX; drag.y = e.clientY
    }
    const onUp = () => { drag = null }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    const KEYMAP: Record<string, string> = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run' }
    const onKey = (e: KeyboardEvent) => {
      if (e.type === 'keydown' && e.code === 'Escape') { exitRef.current(); return }
      const k = KEYMAP[e.code]
      if (!k) return
      e.preventDefault()
      if (e.type === 'keydown') keys.add(k); else keys.delete(k)
    }
    const onBlur = () => keys.clear()
    hostEl.addEventListener('keydown', onKey)
    hostEl.addEventListener('keyup', onKey)
    hostEl.addEventListener('blur', onBlur)
    hostEl.focus({ preventScroll: true })

    /* Minimap: the current floor, click to jump. */
    const mini = miniRef.current!
    const hx2 = Math.max(...plan.floors.flatMap((f) => f.rooms.map((r) => r.x + r.w)))
    const hy2 = Math.max(...plan.floors.flatMap((f) => f.rooms.map((r) => r.y + r.d)))
    const view = { x1: -3, y1: -3, x2: hx2 + 3, y2: hy2 + 3 }
    const mm = { s: 1, ox: 0, oy: 0 }
    const onMini = (e: MouseEvent) => {
      const rc = mini.getBoundingClientRect()
      const x = (e.clientX - rc.left - mm.ox) / mm.s + view.x1
      const z = (e.clientY - rc.top - mm.oy) / mm.s + view.y1
      const room = built.roomAt(x, z, w.level)
      if (!room) return
      if (!blocked(x, z, w.level)) { w.x = x; w.z = z; const s = built.surfaceAt(x, z, w.level); w.level = s.level; w.elev = s.elev } else goTo(room)
    }
    mini.addEventListener('click', onMini)
    const css = getComputedStyle(document.documentElement)
    const accent = css.getPropertyValue('--accent').trim() || '#2dd4bf'
    const drawMini = () => {
      const g = mini.getContext('2d')
      if (!g) return
      const dpr = Math.min(window.devicePixelRatio, 2)
      const cw = mini.clientWidth, ch = mini.clientHeight
      if (mini.width !== Math.round(cw * dpr)) { mini.width = Math.round(cw * dpr); mini.height = Math.round(ch * dpr) }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, cw, ch)
      const pad = 8
      mm.s = Math.min((cw - pad * 2) / (view.x2 - view.x1), (ch - pad * 2) / (view.y2 - view.y1))
      mm.ox = (cw - (view.x2 - view.x1) * mm.s) / 2
      mm.oy = (ch - (view.y2 - view.y1) * mm.s) / 2
      const X = (x: number) => mm.ox + (x - view.x1) * mm.s
      const Y = (z: number) => mm.oy + (z - view.y1) * mm.s
      for (const wr of built.rooms[w.level]!) {
        const r = wr.room
        g.fillStyle = r.type === 'outdoor' ? 'rgba(134,180,110,0.35)' : r.type === 'stair' ? 'rgba(245,165,36,0.3)' : 'rgba(255,255,255,0.16)'
        g.strokeStyle = 'rgba(255,255,255,0.75)'
        g.lineWidth = 1
        g.fillRect(X(r.x), Y(r.y), r.w * mm.s, r.d * mm.s)
        g.strokeRect(X(r.x), Y(r.y), r.w * mm.s, r.d * mm.s)
      }
      g.save()
      g.translate(X(w.x), Y(w.z))
      g.rotate(-w.yaw)
      g.fillStyle = 'rgba(45,212,191,0.3)'
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 22, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.closePath(); g.fill()
      g.fillStyle = accent; g.strokeStyle = '#fff'; g.lineWidth = 2
      g.beginPath(); g.arc(0, 0, 4.5, 0, Math.PI * 2); g.fill(); g.stroke()
      g.restore()
    }

    /* Loop */
    const resize = () => {
      const cw = host.clientWidth, ch = host.clientHeight
      renderer.setSize(cw, ch, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = cw / Math.max(ch, 1)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    let last = performance.now(), raf = 0, lastHud = '', lightClock = 0
    const updateLights = () => {
      const here = built.rooms[w.level]!.filter((r) => r.room.type !== 'outdoor' && r.room.type !== 'stair')
      const ceilY = built.levelBase[w.level]! + plan.floors[w.level]!.height - 0.6 - 1.2
      const sorted = [...here].sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z))
      pool.forEach((l, i) => {
        const r = sorted[i]
        if (!r) { l.intensity = 0; return }
        l.position.set(r.x, ceilY, r.z)
        l.intensity = 38
      })
    }
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const f = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0)
      const s = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0)
      const speed = keys.has('run') ? RUN : WALK
      const len = Math.hypot(f, s) || 1
      const fx = -Math.sin(w.yaw), fz = -Math.cos(w.yaw)
      const tx = ((fx * f + Math.cos(w.yaw) * s) / len) * speed
      const tz = ((fz * f - Math.sin(w.yaw) * s) / len) * speed
      vel.x += (tx - vel.x) * Math.min(1, dt * 10)
      vel.y += (tz - vel.y) * Math.min(1, dt * 10)
      const nx = w.x + vel.x * dt, nz = w.z + vel.y * dt
      if (!blocked(nx, w.z, w.level)) w.x = nx; else vel.x = 0
      if (!blocked(w.x, nz, w.level)) w.z = nz; else vel.y = 0
      const surf = built.surfaceAt(w.x, w.z, w.level)
      w.level = surf.level
      w.elev = surf.elev
      const bob = Math.hypot(vel.x, vel.y) > 1 ? Math.sin(now / 130) * 0.05 : 0
      w.eye += (w.elev + EYE - w.eye) * Math.min(1, dt * 9)
      camera.position.set(w.x, w.eye + bob, w.z)
      euler.set(w.pitch, w.yaw, 0, 'YXZ')
      camera.quaternion.copy(quat.setFromEuler(euler))

      lightClock -= dt
      if (lightClock <= 0) { lightClock = 0.3; updateLights() }
      drawMini()
      const here = built.roomAt(w.x, w.z, w.level)
      const room = here?.room
      const label = `${room?.name ?? (w.level === 0 ? 'Garden' : 'Outside')}|${built.levelNames[w.level]}|${room ? room.floorFinish : ''}|${room && room.type !== 'outdoor' ? room.wallFinish : ''}`
      if (label !== lastHud) { lastHud = label; const [rn, ln, ff, wf] = label.split('|'); setHud({ room: rn!, level: ln!, floor: ff!, walls: wf! }) }
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)
    setReady(true)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      hostEl.removeEventListener('keydown', onKey)
      hostEl.removeEventListener('keyup', onKey)
      hostEl.removeEventListener('blur', onBlur)
      mini.removeEventListener('click', onMini)
      pool.forEach((l) => l.dispose())
      built.dispose()
      envMap.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      apiRef.current = null
    }
  }, [plan])

  const hold = (k: string) => ({
    onPointerDown: (e: ReactPointerEvent) => { e.preventDefault(); apiRef.current?.press(k, true) },
    onPointerUp: () => apiRef.current?.press(k, false),
    onPointerLeave: () => apiRef.current?.press(k, false),
    onPointerCancel: () => apiRef.current?.press(k, false),
  })
  const pad = 'grid size-10 place-items-center rounded-xl bg-slate-900/70 text-white backdrop-blur active:bg-slate-700 cursor-pointer select-none'

  return (
    <div ref={hostRef} tabIndex={0} className="absolute inset-0 z-30 bg-slate-900 outline-none">
      <div ref={canvasHost} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Where am I */}
      {ready && hud.level && (
        <div className="pointer-events-none absolute left-1/2 top-[3.4rem] max-w-[80%] -translate-x-1/2 rounded-xl bg-slate-900/75 px-4 py-2 text-center backdrop-blur">
          <p className="font-display text-base font-bold leading-tight text-white">{hud.room}</p>
          <p className="text-[11px] font-semibold text-teal-300">{hud.level}</p>
          {(hud.floor || hud.walls) && (
            <p className="mt-0.5 hidden text-[10px] leading-snug text-slate-300 sm:block">
              {hud.floor && <>Floor: {hud.floor}</>}{hud.floor && hud.walls && ' · '}{hud.walls && <>Walls: {hud.walls}</>}
            </p>
          )}
        </div>
      )}

      <div className="absolute left-3 top-3 flex items-start gap-2">
        <button onClick={onExit} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-slate-900 shadow cursor-pointer hover:bg-slate-100">
          <LogOut size={14} />Exit walkthrough
        </button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900/75 px-3 text-xs font-semibold text-white backdrop-blur cursor-pointer hover:bg-slate-900" aria-expanded={menu}>
            <DoorOpen size={14} />Go to room<ChevronDown size={12} className={clsx('transition', menu && 'rotate-180')} />
          </button>
          {menu && (
            <div className="absolute left-0 top-11 z-10 max-h-[60vh] w-56 overflow-auto rounded-xl bg-slate-900/90 p-2 text-xs text-slate-200 shadow-xl backdrop-blur">
              {[...levels].map((l, i) => ({ l, i })).reverse().map(({ l, i }) => (
                <div key={i} className="mb-1.5 last:mb-0">
                  <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{l.name}</p>
                  {l.rooms.map((r) => (
                    <button key={r.room.id} onClick={() => { apiRef.current?.goTo(r); setMenu(false); hostRef.current?.focus() }} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/10 cursor-pointer">
                      {r.room.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <button onClick={onToggleFull} className="absolute right-3 top-3 grid size-9 place-items-center rounded-xl bg-slate-900/75 text-slate-200 backdrop-blur hover:text-white cursor-pointer" aria-label={full ? 'Exit full screen' : 'Full screen'}>
        {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      <canvas ref={miniRef} className="absolute bottom-3 right-3 h-[130px] w-[160px] cursor-crosshair rounded-xl bg-slate-900/75 backdrop-blur sm:h-[170px] sm:w-[210px]" title="Click to jump" />

      <div className="absolute bottom-3 left-3 grid select-none grid-cols-3 gap-1">
        <span />
        <button {...hold('f')} className={pad} aria-label="Forward"><ArrowUp size={16} /></button>
        <span />
        <button {...hold('l')} className={pad} aria-label="Step left"><ArrowLeft size={16} /></button>
        <button {...hold('b')} className={pad} aria-label="Back"><ArrowDown size={16} /></button>
        <button {...hold('r')} className={pad} aria-label="Step right"><ArrowRight size={16} /></button>
      </div>
      <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-lg bg-slate-900/60 px-3 py-1 text-[11px] text-slate-200 lg:block">
        Drag to look · W A S D or arrows to walk · Shift to run · Esc to exit
      </p>
    </div>
  )
}
