import clsx from 'clsx'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Box, Check, Footprints, Layers, Loader2, Maximize2, Minimize2, Mountain } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { TourModel } from '../../data/floorplans'
import { buildScene, type BuiltScene, type RoomInfo, type Segment } from './buildScene'

export type TourMode = 'walk' | 'dollhouse' | 'outside'

const EYE = 5.4
const RADIUS = 1.15
const WALK_SPEED = 9
const RUN_SPEED = 17

/** Models already "generated" this session, so the build-up animation plays once. */
const generated = new Set<string>()

interface Api {
  setMode: (m: TourMode) => void
  setShownLevel: (l: number) => void
  goTo: (r: RoomInfo) => void
  press: (key: string, down: boolean) => void
}

export function TourViewer({ model }: { model: TourModel }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasHost = useRef<HTMLDivElement>(null)
  const miniRef = useRef<HTMLCanvasElement>(null)
  const apiRef = useRef<Api | null>(null)
  const [mode, setModeState] = useState<TourMode>('walk')
  const [shownLevel, setShownLevel] = useState(model.levels.length - 1)
  const [hud, setHud] = useState({ room: '', level: '' })
  const [stats, setStats] = useState<BuiltScene['stats'] | null>(null)
  const [rooms, setRooms] = useState<RoomInfo[][]>([])
  const genKey = `${model.id}:${model.sources.map((s) => s.rev).join('')}`
  const [genStep, setGenStep] = useState(generated.has(genKey) ? 99 : 0)
  const [full, setFull] = useState(false)

  useEffect(() => {
    if (genStep >= 4) { generated.add(genKey); return }
    const t = setTimeout(() => setGenStep((s) => s + 1), genStep === 0 ? 350 : 520)
    return () => clearTimeout(t)
  }, [genStep, genKey])

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === hostRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    const host = canvasHost.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#cfe3f3')
    const built = buildScene(model)
    scene.add(built.root)
    setStats(built.stats)
    setRooms(built.levels.map((l) => l.rooms.filter((r) => r.kind !== 'stair')))
    scene.fog = new THREE.Fog('#cfe3f3', built.size * 3, built.size * 9)

    const size = built.size
    const c = built.centre
    scene.add(new THREE.HemisphereLight('#eef5ff', '#7a6a55', 1.25))
    scene.add(new THREE.AmbientLight('#ffffff', 0.35))
    const sun = new THREE.DirectionalLight('#fff3df', 2.4)
    sun.position.set(c.x + size * 0.7, c.y + size * 1.3, c.z + size * 0.45)
    sun.target.position.copy(c)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const sb = size * 0.9
    Object.assign(sun.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, near: 1, far: size * 4 })
    sun.shadow.bias = -0.0008
    sun.shadow.normalBias = 0.05
    scene.add(sun, sun.target)

    const camera = new THREE.PerspectiveCamera(72, 1, 0.3, size * 12)
    camera.rotation.order = 'YXZ'
    const lamp = new THREE.PointLight('#fff1dc', 90, 45, 2)
    camera.add(lamp)
    scene.add(camera)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI * 0.49
    controls.minDistance = 8
    controls.maxDistance = size * 4
    controls.enabled = false

    // -- Walker state ------------------------------------------------------
    const w = { x: model.start.x, y: model.start.y, level: model.start.level, yaw: model.start.facing, pitch: -0.05, elev: built.levels[model.start.level].base, eye: 0 }
    w.eye = w.elev + EYE
    const keys = new Set<string>()
    let mode: TourMode = 'walk'
    let shown = model.levels.length - 1
    let tween: null | { t: number; dur: number; p0: THREE.Vector3; p1: THREE.Vector3; q0: THREE.Quaternion; q1: THREE.Quaternion; target?: THREE.Vector3 } = null

    const segDist = (px: number, py: number, s: Segment) => {
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1
      const l2 = dx * dx + dy * dy
      const t = l2 ? Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / l2)) : 0
      return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy))
    }
    const lot = model.lot
    const blocked = (x: number, y: number, level: number) => {
      if (x < lot.minX + 1.5 || x > lot.maxX - 1.5 || y < lot.minY + 1.5 || y > lot.maxY - 1.5) return true
      return built.levels[level].colliders.some((s) => segDist(x, y, s) < RADIUS)
    }
    const stairAt = (x: number, y: number, level: number) =>
      built.stairs.find((s) => (s.level === level || s.level === level - 1) && x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h)
    const settle = () => {
      const s = stairAt(w.x, w.y, w.level)
      if (s && built.levels[s.level + 1]) {
        const t = Math.max(0, Math.min(1, (s.y + s.h - w.y) / s.h))
        const lo = built.levels[s.level].base, hi = built.levels[s.level + 1].base
        w.elev = lo + t * (hi - lo)
        w.level = t > 0.5 ? s.level + 1 : s.level
      } else w.elev = built.levels[w.level].base
    }
    const roomAt = (x: number, y: number, level: number) => {
      const L = built.levels[level]
      const r = L.rooms.find((r) => r.label !== L.fill && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
      if (r) return r.label
      if (x >= 0 && y >= 0 && x <= model.width && y <= model.depth) return L.fill ?? (model.style === 'house' ? 'Garden court' : 'Outside')
      return model.style === 'house' ? 'Garden' : model.style === 'warehouse' ? 'Yard' : 'Outside'
    }
    const walkQuat = (yaw = w.yaw, pitch = w.pitch) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))

    const applyVisibility = () => {
      built.levels.forEach((l, i) => { l.group.visible = mode !== 'dollhouse' || i <= shown })
      built.covers.visible = mode !== 'dollhouse'
      built.labels.visible = mode === 'dollhouse'
      built.labels.children.forEach((s) => { s.visible = s.userData.level === shown })
      lamp.visible = mode === 'walk'
    }
    const orbitPose = (m: TourMode) => {
      const target = m === 'dollhouse'
        ? new THREE.Vector3(c.x, built.levels[shown].base, c.z)
        : new THREE.Vector3(c.x, model.style === 'office' ? c.y : c.y * 0.6, c.z)
      const off = m === 'dollhouse' ? new THREE.Vector3(size * 0.55, size * 0.95, size * 0.85) : new THREE.Vector3(size * 0.95, size * 0.32, size * 1.15)
      const p = target.clone().add(off)
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p, target, new THREE.Vector3(0, 1, 0)))
      return { p, q, target }
    }
    const startTween = (p1: THREE.Vector3, q1: THREE.Quaternion, target?: THREE.Vector3) => {
      tween = { t: 0, dur: 0.75, p0: camera.position.clone(), p1, q0: camera.quaternion.clone(), q1, target }
    }
    const setMode = (m: TourMode, instant = false) => {
      mode = m
      setModeState(m)
      controls.enabled = false
      applyVisibility()
      camera.near = m === 'walk' ? 0.3 : 1
      camera.updateProjectionMatrix()
      if (m === 'walk') {
        settle()
        w.eye = w.elev + EYE
        const p = new THREE.Vector3(w.x, w.eye, w.y)
        if (instant) { camera.position.copy(p); camera.quaternion.copy(walkQuat()) } else startTween(p, walkQuat())
      } else {
        const { p, q, target } = orbitPose(m)
        if (instant) { camera.position.copy(p); camera.quaternion.copy(q); controls.target.copy(target); controls.enabled = true } else startTween(p, q, target)
      }
    }
    const goTo = (r: RoomInfo) => {
      let { x, y } = r.spot
      if (blocked(x, y, r.level)) {
        outer: for (let rad = 1; rad < 8; rad += 0.5) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
          const nx = x + Math.cos(a) * rad, ny = y + Math.sin(a) * rad
          if (nx > r.x && nx < r.x + r.w && ny > r.y && ny < r.y + r.h && !blocked(nx, ny, r.level)) { x = nx; y = ny; break outer }
        }
      }
      w.x = x; w.y = y; w.level = r.level
      // face the most open direction, so the room fills the view
      let best = 0
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, fx = -Math.sin(a), fz = -Math.cos(a)
        let d = 0
        while (d < 40 && !blocked(x + fx * (d + 0.5), y + fz * (d + 0.5), r.level)) d += 0.5
        if (d > best) { best = d; w.yaw = a }
      }
      w.pitch = -0.05
      setMode('walk')
    }
    apiRef.current = {
      setMode,
      setShownLevel: (l) => { shown = l; setShownLevel(l); applyVisibility(); if (mode === 'dollhouse') { const { p, q, target } = orbitPose('dollhouse'); startTween(p, q, target) } },
      goTo,
      press: (k, down) => (down ? keys.add(k) : keys.delete(k)),
    }

    // -- Input -------------------------------------------------------------
    const el = renderer.domElement
    let drag: null | { x: number; y: number; sx: number; sy: number; id: number } = null
    const onDown = (e: PointerEvent) => {
      hostRef.current?.focus({ preventScroll: true })
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, id: e.pointerId }
      if (mode === 'walk') el.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId || mode !== 'walk' || tween) return
      w.yaw += (e.clientX - drag.x) * 0.0042
      w.pitch = Math.max(-1.2, Math.min(1.2, w.pitch + (e.clientY - drag.y) * 0.0042))
      drag.x = e.clientX; drag.y = e.clientY
    }
    const raycaster = new THREE.Raycaster()
    const onUp = (e: PointerEvent) => {
      if (!drag) return
      const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy)
      drag = null
      if (moved > 5 || mode !== 'dollhouse') return
      const r = el.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      const hit = raycaster.intersectObjects(built.floors.filter((f) => f.parent?.visible && f.userData.level === shown), false)[0]
      if (!hit) return
      const lvl = hit.object.userData.level as number
      const room = built.levels[lvl].rooms.find((rm) => rm.label === hit.object.userData.label)
      if (room && blocked(hit.point.x, hit.point.z, lvl)) return goTo(room)
      w.x = hit.point.x; w.y = hit.point.z; w.level = lvl
      setMode('walk')
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', () => { drag = null })
    const KEYMAP: Record<string, string> = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run' }
    const hostEl = hostRef.current!
    const onKey = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code]
      if (!k || mode !== 'walk') return
      e.preventDefault()
      if (e.type === 'keydown') keys.add(k)
      else keys.delete(k)
    }
    const onBlur = () => keys.clear()
    hostEl.addEventListener('keydown', onKey)
    hostEl.addEventListener('keyup', onKey)
    hostEl.addEventListener('blur', onBlur)

    // Minimap: click to teleport on the current level.
    const mini = miniRef.current!
    const mm = { s: 1, ox: 0, oy: 0 }
    const onMini = (e: MouseEvent) => {
      const r = mini.getBoundingClientRect()
      const x = (e.clientX - r.left - mm.ox) / mm.s, y = (e.clientY - r.top - mm.oy) / mm.s
      const L = built.levels[w.level]
      const room = L.rooms.find((rm) => x > rm.x && x < rm.x + rm.w && y > rm.y && y < rm.y + rm.h && rm.label !== L.fill && rm.kind !== 'stair')
      if (!blocked(x, y, w.level) && (room || w.level === 0)) { w.x = x; w.y = y; settle() }
      else if (room) goTo(room)
    }
    mini.addEventListener('click', onMini)

    const drawMini = () => {
      const g = mini.getContext('2d')
      if (!g) return
      const dpr = Math.min(window.devicePixelRatio, 2)
      const cw = mini.clientWidth, ch = mini.clientHeight
      if (mini.width !== cw * dpr) { mini.width = cw * dpr; mini.height = ch * dpr }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, cw, ch)
      const pad = 10
      mm.s = Math.min((cw - pad * 2) / model.width, (ch - pad * 2) / model.depth)
      mm.ox = (cw - model.width * mm.s) / 2
      mm.oy = (ch - model.depth * mm.s) / 2
      const L = built.levels[w.level]
      for (const r of L.rooms) {
        const fill = r.label === L.fill
        g.fillStyle = fill ? 'rgba(255,255,255,0.10)' : r.kind === 'dashed' ? 'rgba(255,255,255,0.06)' : r.kind === 'stair' ? 'rgba(245,165,36,0.25)' : 'rgba(255,255,255,0.16)'
        g.strokeStyle = 'rgba(255,255,255,0.7)'
        g.lineWidth = fill ? 1.5 : 1
        g.setLineDash(r.kind === 'dashed' ? [3, 2] : [])
        g.fillRect(mm.ox + r.x * mm.s, mm.oy + r.y * mm.s, r.w * mm.s, r.h * mm.s)
        g.strokeRect(mm.ox + r.x * mm.s, mm.oy + r.y * mm.s, r.w * mm.s, r.h * mm.s)
      }
      g.setLineDash([])
      const px = mm.ox + w.x * mm.s, py = mm.oy + w.y * mm.s
      g.save()
      g.translate(px, py)
      g.rotate(-w.yaw)
      g.fillStyle = 'rgba(45,212,191,0.28)'
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 26, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.closePath(); g.fill()
      g.fillStyle = '#2dd4bf'; g.strokeStyle = '#fff'; g.lineWidth = 2
      g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill(); g.stroke()
      g.restore()
    }

    // -- Loop --------------------------------------------------------------
    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = host
      renderer.setSize(cw, ch, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = cw / Math.max(ch, 1)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()
    setMode('walk', true)

    let last = performance.now(), raf = 0, lastHud = ''
    const vel = new THREE.Vector2()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (tween) {
        tween.t += dt / tween.dur
        const k = tween.t >= 1 ? 1 : 1 - Math.pow(1 - tween.t, 3)
        camera.position.lerpVectors(tween.p0, tween.p1, k)
        camera.quaternion.slerpQuaternions(tween.q0, tween.q1, k)
        if (tween.t >= 1) {
          if (tween.target) { controls.target.copy(tween.target); controls.enabled = true; controls.update() }
          tween = null
        }
      } else if (mode === 'walk') {
        const f = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0)
        const s = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0)
        const speed = keys.has('run') ? RUN_SPEED : WALK_SPEED
        const len = Math.hypot(f, s) || 1
        const fx = -Math.sin(w.yaw), fz = -Math.cos(w.yaw)
        const tx = ((fx * f + Math.cos(w.yaw) * s) / len) * speed, tz = ((fz * f - Math.sin(w.yaw) * s) / len) * speed
        vel.x += (tx - vel.x) * Math.min(1, dt * 10)
        vel.y += (tz - vel.y) * Math.min(1, dt * 10)
        const nx = w.x + vel.x * dt, nz = w.y + vel.y * dt
        if (!blocked(nx, w.y, w.level)) w.x = nx; else vel.x = 0
        if (!blocked(w.x, nz, w.level)) w.y = nz; else vel.y = 0
        settle()
        const bob = Math.hypot(vel.x, vel.y) > 1 ? Math.sin(now / 140) * 0.06 : 0
        w.eye += (w.elev + EYE - w.eye) * Math.min(1, dt * 12)
        camera.position.set(w.x, w.eye + bob, w.y)
        camera.quaternion.copy(walkQuat())
      } else controls.update()

      if (mode === 'walk') drawMini()
      const label = mode === 'walk' ? `${roomAt(w.x, w.y, w.level)}|${built.levels[w.level].name}` : mode === 'dollhouse' ? `|${built.levels[shown].name}` : '|'
      if (label !== lastHud) { lastHud = label; const [room, level] = label.split('|'); setHud({ room, level }) }
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      hostEl.removeEventListener('keydown', onKey)
      hostEl.removeEventListener('keyup', onKey)
      hostEl.removeEventListener('blur', onBlur)
      mini.removeEventListener('click', onMini)
      controls.dispose()
      built.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      apiRef.current = null
    }
  }, [model])

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void hostRef.current?.requestFullscreen?.()
  }
  const hold = (k: string) => ({
    onPointerDown: (e: ReactPointerEvent) => { e.preventDefault(); apiRef.current?.press(k, true) },
    onPointerUp: () => apiRef.current?.press(k, false),
    onPointerLeave: () => apiRef.current?.press(k, false),
    onPointerCancel: () => apiRef.current?.press(k, false),
  })
  const generating = genStep < 4
  const steps = stats && [
    `Reading ${model.sources.map((s) => `${s.code} Rev ${s.rev}`).join(' + ')}`,
    `Tracing walls · ${stats.rooms} rooms, ${stats.doors} doorways${stats.windows ? `, ${stats.windows} windows` : ''}`,
    `Furnishing · ${stats.furniture} pieces placed`,
    'Lighting the scene',
  ]

  return (
    <div className="space-y-3">
      <div ref={hostRef} tabIndex={0} className={clsx('relative overflow-hidden bg-slate-900 outline-none', full ? 'h-screen' : 'h-[min(72vh,680px)] min-h-[420px] rounded-2xl')}>
        <div ref={canvasHost} className="absolute inset-0" />

        {/* Mode switch */}
        <div className="absolute left-3 top-3 flex rounded-xl bg-slate-900/75 p-1 text-xs font-semibold text-slate-300 backdrop-blur">
          {([['walk', 'Walk', Footprints], ['dollhouse', 'Dollhouse', Box], ['outside', 'Outside', Mountain]] as const).map(([m, label, Icon]) => (
            <button key={m} onClick={() => apiRef.current?.setMode(m)} className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 cursor-pointer transition', mode === m ? 'bg-white text-slate-900' : 'hover:text-white')}>
              <Icon size={14} /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <button onClick={toggleFull} className="absolute right-3 top-3 grid size-9 place-items-center rounded-xl bg-slate-900/75 text-slate-200 backdrop-blur hover:text-white cursor-pointer" aria-label={full ? 'Exit full screen' : 'Full screen'}>
          {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        {/* Where am I */}
        {hud.level && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-xl bg-slate-900/75 px-3.5 py-1.5 text-center backdrop-blur max-sm:top-14">
            {mode === 'walk' && <p className="font-display text-sm font-bold text-white">{hud.room}</p>}
            <p className="text-[11px] text-slate-300">{hud.level}</p>
          </div>
        )}

        {/* Dollhouse level picker */}
        {mode === 'dollhouse' && model.levels.length > 1 && (
          <div className="absolute right-3 top-14 flex flex-col gap-1 rounded-xl bg-slate-900/75 p-1 text-xs font-semibold text-slate-300 backdrop-blur">
            <p className="flex items-center gap-1 px-2 pt-1 text-[10px] uppercase tracking-wider text-slate-400"><Layers size={11} />Show</p>
            {[...model.levels].map((l, i) => ({ l, i })).reverse().map(({ l, i }) => (
              <button key={i} onClick={() => apiRef.current?.setShownLevel(i)} className={clsx('rounded-lg px-2.5 py-1.5 text-left cursor-pointer', shownLevel === i ? 'bg-white text-slate-900' : 'hover:text-white')}>{l.name}</button>
            ))}
          </div>
        )}

        {/* Minimap */}
        <canvas ref={miniRef} className={clsx('absolute bottom-3 right-3 h-[120px] w-[150px] cursor-crosshair rounded-xl bg-slate-900/75 backdrop-blur sm:h-[150px] sm:w-[190px]', mode !== 'walk' && 'hidden')} title="Click to jump" />

        {/* On-screen movement */}
        {mode === 'walk' && (
          <div className="absolute bottom-3 left-3 grid select-none grid-cols-3 gap-1">
            <span />
            <button {...hold('f')} className="pad" aria-label="Forward"><ArrowUp size={16} /></button>
            <span />
            <button {...hold('l')} className="pad" aria-label="Step left"><ArrowLeft size={16} /></button>
            <button {...hold('b')} className="pad" aria-label="Back"><ArrowDown size={16} /></button>
            <button {...hold('r')} className="pad" aria-label="Step right"><ArrowRight size={16} /></button>
          </div>
        )}
        <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-lg bg-slate-900/60 px-3 py-1 text-[11px] text-slate-200 lg:block">
          {mode === 'walk' ? 'Drag to look · WASD / arrows to walk · Shift to run · click the map to jump' : mode === 'dollhouse' ? 'Drag to orbit · scroll to zoom · click a room to walk into it' : 'Drag to orbit · scroll to zoom'}
        </p>

        {/* Generation overlay */}
        {generating && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/85 backdrop-blur-sm">
            <div className="w-[min(380px,90%)]">
              <p className="font-display text-lg font-bold text-white">Generating 3D tour</p>
              <p className="mt-0.5 text-xs text-slate-400">From the architect's latest approved floor plans</p>
              <ul className="mt-4 space-y-2.5">
                {steps?.map((s, i) => (
                  <li key={i} className={clsx('flex items-center gap-2.5 text-sm transition', i < genStep ? 'text-slate-200' : i === genStep ? 'text-white' : 'text-slate-600')}>
                    {i < genStep ? <Check size={15} className="text-teal-400" /> : i === genStep ? <Loader2 size={15} className="animate-spin text-teal-300" /> : <span className="size-[15px] rounded-full border border-slate-700" />}
                    {s}
                  </li>
                ))}
              </ul>
              <button onClick={() => setGenStep(4)} className="mt-5 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer">Skip</button>
            </div>
          </div>
        )}
      </div>

      {/* Room jump list */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {rooms.map((list, li) => list.length > 0 && (
          <div key={li} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{model.levels[li].name}</span>
            {list.map((r) => (
              <button key={r.label} onClick={() => apiRef.current?.goTo(r)} className={clsx('rounded-full border px-2.5 py-1 text-xs font-medium cursor-pointer transition', mode === 'walk' && hud.room === r.label && hud.level === model.levels[li].name ? 'border-accent bg-accent text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-accent hover:text-accent-strong')}>
                {r.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
