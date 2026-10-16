import clsx from 'clsx'
import { Box, ChevronDown, Eye, Footprints, Layers, Maximize2, Minimize2, RotateCcw, Scissors, SquareDashedBottom } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ROOM_TYPE_META, STATUS_META, type HousePlan, type RoomType, type WorkStatus } from '../../data/housePlan'
import { buildHouse, type HouseScene } from './buildHouse'
import { HouseWalk } from './HouseWalk'
import { presetView, type Preset, type ViewState } from './view'

const EXPLODE_GAP = 14
const CUT_HEIGHT = 4

const PRESETS: { id: Preset; label: string; icon: typeof Box }[] = [
  { id: 'exterior', label: 'Exterior', icon: Box },
  { id: 'cutaway', label: 'Cutaway', icon: SquareDashedBottom },
  { id: 'exploded', label: 'Exploded floors', icon: Layers },
  { id: 'section', label: 'Section cut', icon: Scissors },
]

interface Engine {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  renderer: THREE.WebGLRenderer
  house: HouseScene | null
  sections: Map<string, THREE.Object3D>
  levelPlanes: THREE.Plane[]
  sectionPlane: THREE.Plane
  explodeTarget: number
  focus: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null
}

export function HouseViewer({ plan, view, onView, selectedId, onSelect, titleFor }: {
  plan: HousePlan
  view: ViewState
  onView: (v: ViewState) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  titleFor: (id: string) => string | undefined
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasHost = useRef<HTMLDivElement>(null)
  const tagRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const hoverRef = useRef<string | null>(null)
  const selectedRef = useRef<string | null>(selectedId)
  const viewRef = useRef(view)
  const [hover, setHover] = useState<string | null>(null)
  const [full, setFull] = useState(false)
  const [fitKey, setFitKey] = useState(0)
  const [panelOpen, setPanelOpen] = useState(true)
  const [walking, setWalking] = useState(false)
  const walkingRef = useRef(false)
  const downAt = useRef<{ x: number; y: number } | null>(null)
  const fittedRef = useRef(false)
  useLayoutEffect(() => {
    viewRef.current = view
    selectedRef.current = selectedId
    walkingRef.current = walking
  })

  /* ── Renderer, camera and render loop (once) ── */
  useEffect(() => {
    const host = canvasHost.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.localClippingEnabled = true
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dde9f3')
    scene.add(new THREE.HemisphereLight('#f4f8ff', '#8a7a60', 1.4))
    const sun = new THREE.DirectionalLight('#fff4e2', 2.3)
    sun.position.set(60, 110, 45)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 320 })
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.04
    scene.add(sun)

    const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI * 0.495
    controls.minDistance = 12
    controls.maxDistance = 260

    const engine: Engine = {
      scene, camera, controls, renderer, house: null, sections: new Map(),
      levelPlanes: [], sectionPlane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), explodeTarget: 0, focus: null,
    }
    engineRef.current = engine
    fittedRef.current = false

    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const tmp = new THREE.Vector3()
    const box = new THREE.Box3()
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const house = engine.house
      if (house) {
        // Ease floors apart / together for the exploded view, keeping the clip planes attached.
        house.levels.forEach((g, i) => {
          g.position.y += (i * engine.explodeTarget - g.position.y) * 0.14
          const plane = engine.levelPlanes[i]
          if (plane) plane.constant = house.levelBase[i]! + g.position.y + CUT_HEIGHT
        })
        house.roof.position.y += (house.levels.length * engine.explodeTarget - house.roof.position.y) * 0.14
      }
      if (engine.focus) {
        const f = engine.focus
        f.t = Math.min(1, f.t + 0.06)
        const k = 1 - Math.pow(1 - f.t, 3)
        tmp.lerpVectors(f.from, f.to, k).sub(controls.target)
        controls.target.add(tmp)
        camera.position.add(tmp)
        if (f.t >= 1) engine.focus = null
      }
      if (walkingRef.current) return
      controls.update()
      renderer.render(scene, camera)
      // Floating tag over the selected section.
      const tag = tagRef.current
      const sel = selectedRef.current && engine.sections.get(selectedRef.current)
      if (tag) {
        if (sel) {
          box.setFromObject(sel)
          box.getCenter(tmp)
          tmp.y = box.max.y + 1
          tmp.project(camera)
          const visible = tmp.z < 1
          tag.style.opacity = visible ? '1' : '0'
          tag.style.transform = `translate(-50%, -100%) translate(${(tmp.x * 0.5 + 0.5) * host.clientWidth}px, ${(-tmp.y * 0.5 + 0.5) * host.clientHeight}px)`
        } else tag.style.opacity = '0'
      }
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      engine.house?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      engineRef.current = null
    }
  }, [])

  /* ── (Re)build the house whenever the plan changes ── */
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    if (engine.house) {
      engine.scene.remove(engine.house.root)
      engine.house.dispose()
    }
    const house = buildHouse(plan)
    engine.house = house
    engine.scene.add(house.root)
    engine.sections.clear()
    house.root.traverse((o) => { if (o.userData.sectionId) engine.sections.set(o.userData.sectionId as string, o) })
    engine.levelPlanes = house.levels.map(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0))
    // Start each level at its exploded/unexploded resting position so a rebuild does not jump.
    house.levels.forEach((g, i) => { g.position.y = i * engine.explodeTarget })
    house.roof.position.y = house.levels.length * engine.explodeTarget
    applyView(engine, viewRef.current)
    applyHighlight(engine, selectedRef.current, hoverRef.current)
    if (!fittedRef.current) {
      fittedRef.current = true
      fitCamera(engine)
    }
  }, [plan])

  useEffect(() => {
    if (fitKey && engineRef.current) fitCamera(engineRef.current)
  }, [fitKey])

  useEffect(() => {
    if (engineRef.current) applyView(engineRef.current, view)
  }, [view])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    applyHighlight(engine, selectedId, hover)
  }, [selectedId, hover])

  // Glide the orbit target to a newly selected section.
  useEffect(() => {
    const engine = engineRef.current
    const obj = selectedId ? engine?.sections.get(selectedId) : null
    if (!engine || !obj) return
    const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3())
    engine.focus = { from: engine.controls.target.clone(), to: c, t: 0 }
  }, [selectedId])

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === hostRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  /* ── Picking ── */
  const raycaster = useRef(new THREE.Raycaster())
  const pick = (e: ReactPointerEvent<HTMLDivElement>): string | null => {
    const engine = engineRef.current
    if (!engine?.house) return null
    const rect = canvasHost.current!.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.current.setFromCamera(ndc, engine.camera)
    const globals = engine.renderer.clippingPlanes
    const hits = raycaster.current.intersectObject(engine.house.root, true)
    for (const h of hits) {
      if (!visibleChain(h.object)) continue
      if (globals.some((p) => p.distanceToPoint(h.point) < 0)) continue
      const local = (h.object as THREE.Mesh).material as THREE.Material
      if (local.clippingPlanes?.some((p) => p.distanceToPoint(h.point) < 0)) continue
      if (h.object === engine.house.ground && viewRef.current.foundation) continue
      let o: THREE.Object3D | null = h.object
      while (o && !o.userData.sectionId) o = o.parent
      return (o?.userData.sectionId as string | undefined) ?? null
    }
    return null
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => { downAt.current = { x: e.clientX, y: e.clientY } }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = downAt.current
    downAt.current = null
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return
    onSelect(pick(e))
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons) return
    const id = pick(e)
    if (id !== hoverRef.current) {
      hoverRef.current = id
      setHover(id)
    }
  }

  const set = (patch: Partial<ViewState>) => onView({ ...view, ...patch })
  const legend: [string, string][] = view.colorMode === 'type'
    ? (Object.keys(ROOM_TYPE_META) as RoomType[]).map((k) => [ROOM_TYPE_META[k].label, ROOM_TYPE_META[k].color])
    : (Object.keys(STATUS_META) as WorkStatus[]).map((k) => [k, STATUS_META[k].color])

  return (
    <div ref={hostRef} className={clsx('relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100', full ? 'h-screen' : 'h-[560px]')}>
      <div
        ref={canvasHost}
        className={clsx('absolute inset-0', hover ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing')}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
        onPointerLeave={() => { hoverRef.current = null; setHover(null) }}
      />

      <div ref={tagRef} className="pointer-events-none absolute left-0 top-0 rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white shadow-lg transition-opacity" style={{ opacity: 0 }}>
        {selectedId ? titleFor(selectedId) : ''}
      </div>

      {/* Presets */}
      <div className="absolute left-3 top-3 flex flex-wrap gap-1 rounded-xl bg-white/90 p-1 shadow-sm ring-1 ring-slate-200 backdrop-blur">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => onView(presetView(p.id, plan.floors.length, view))} className={clsx('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer', view.preset === p.id ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100')}>
            <p.icon size={14} />{p.label}
          </button>
        ))}
        <button onClick={() => setWalking(true)} className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white transition cursor-pointer hover:brightness-110">
          <Footprints size={14} />Walk through
        </button>
      </div>

      <div className="absolute right-3 top-3 flex gap-1">
        <button onClick={() => setFitKey((k) => k + 1)} className="grid size-8 place-items-center rounded-lg bg-white/90 text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-white cursor-pointer" aria-label="Reset camera" title="Reset camera"><RotateCcw size={15} /></button>
        <button onClick={() => (full ? document.exitFullscreen() : hostRef.current?.requestFullscreen())} className="grid size-8 place-items-center rounded-lg bg-white/90 text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-white cursor-pointer" aria-label="Toggle full screen" title="Full screen">{full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
      </div>

      {/* Layers & options */}
      <div className="absolute bottom-3 left-3 w-56 rounded-xl bg-white/92 p-3 text-xs shadow-sm ring-1 ring-slate-200 backdrop-blur">
        <button onClick={() => setPanelOpen((o) => !o)} className={clsx('flex w-full items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer', panelOpen && 'mb-1.5')} aria-expanded={panelOpen}>
          <Eye size={12} />Layers & colours<ChevronDown size={12} className={clsx('ml-auto transition', !panelOpen && 'rotate-180')} />
        </button>
        {panelOpen && <>
        <div className="space-y-1">
          <Check label="Roof" checked={view.roof} onChange={(v) => set({ roof: v })} />
          {plan.floors.map((f, i) => (
            <Check key={f.id} label={f.name} checked={view.floors[i] ?? true} onChange={(v) => set({ floors: plan.floors.map((_, j) => (j === i ? v : view.floors[j] ?? true)) })} />
          ))}
          <Check label="Foundation (below ground)" checked={view.foundation} onChange={(v) => set({ foundation: v })} />
          <Check label="Cut walls at 4 ft" checked={view.cutaway} onChange={(v) => set({ cutaway: v })} />
          <Check label="Separate floors" checked={view.explode} onChange={(v) => set({ explode: v })} />
          <Check label="Section cut" checked={view.section} onChange={(v) => set({ section: v })} />
        </div>
        {view.section && (
          <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
            <div className="grid grid-cols-2 gap-1">
              {(['x', 'z'] as const).map((a) => (
                <button key={a} onClick={() => set({ sectionAxis: a })} className={clsx('rounded-md py-1 text-[11px] font-semibold cursor-pointer', view.sectionAxis === a ? 'bg-accent text-white' : 'bg-slate-100 text-slate-600')}>
                  {a === 'x' ? 'East–west' : 'North–south'}
                </button>
              ))}
            </div>
            <input type="range" min={0} max={1} step={0.01} value={view.sectionPos} onChange={(e) => set({ sectionPos: +e.target.value })} className="w-full accent-[var(--accent)]" aria-label="Section position" />
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-1 border-t border-slate-100 pt-2">
          {(['type', 'status'] as const).map((m) => (
            <button key={m} onClick={() => set({ colorMode: m })} className={clsx('rounded-md py-1 text-[11px] font-semibold cursor-pointer', view.colorMode === m ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600')}>
              {m === 'type' ? 'Room type' : 'Progress'}
            </button>
          ))}
        </div>
        </>}
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 hidden max-w-[260px] flex-wrap justify-end gap-x-3 gap-y-1 rounded-xl bg-white/90 px-3 py-2 text-[11px] text-slate-600 shadow-sm ring-1 ring-slate-200 sm:flex">
        {legend.map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm ring-1 ring-black/10" style={{ background: color }} />{label}</span>
        ))}
      </div>

      {walking && <HouseWalk plan={plan} onExit={() => setWalking(false)} full={full} onToggleFull={() => (full ? document.exitFullscreen() : hostRef.current?.requestFullscreen())} />}

      {hover && hover !== selectedId && (
        <div className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-700 shadow ring-1 ring-slate-200">
          {titleFor(hover)} · click for details
        </div>
      )}
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-3.5 accent-[var(--accent)]" />
      {label}
    </label>
  )
}

function visibleChain(o: THREE.Object3D | null) {
  for (; o; o = o.parent) if (!o.visible) return false
  return true
}

function fitCamera(engine: Engine) {
  const size = engine.house?.size ?? 40
  engine.focus = null
  engine.controls.target.set(0, 9, 0)
  // Large commercial plans need more room to zoom out than a house does.
  engine.controls.maxDistance = Math.max(260, size * 3)
  engine.camera.position.set(size * 1.15, size * 0.95, size * 1.45)
  engine.controls.update()
}

function applyView(engine: Engine, v: ViewState) {
  const house = engine.house
  if (!house) return
  house.roof.visible = v.roof
  house.levels.forEach((g, i) => { g.visible = v.floors[i] ?? true })
  // The foundation only shows when the ground is see-through.
  const groundMat = house.ground.material as THREE.MeshStandardMaterial
  groundMat.opacity = v.foundation ? 0.28 : 1
  groundMat.depthWrite = !v.foundation
  house.base.children.forEach((c) => { if (c.userData.sectionId === 'foundation') c.visible = v.foundation })
  engine.explodeTarget = v.explode ? EXPLODE_GAP : 0
  house.wallMaterials.forEach((mats, i) => {
    const planes = v.cutaway ? [engine.levelPlanes[i]!] : null
    for (const m of mats) { m.clippingPlanes = planes; m.needsUpdate = true }
  })
  if (v.section) {
    const half = house.size / 2 + 2
    const pos = -half + v.sectionPos * half * 2
    engine.sectionPlane.normal.set(v.sectionAxis === 'x' ? -1 : 0, 0, v.sectionAxis === 'z' ? -1 : 0)
    engine.sectionPlane.constant = pos
    engine.renderer.clippingPlanes = [engine.sectionPlane]
  } else engine.renderer.clippingPlanes = []
  house.setColorMode(v.colorMode)
}

function applyHighlight(engine: Engine, selected: string | null, hover: string | null) {
  for (const [id, obj] of engine.sections) {
    const color = id === selected ? '#f5a524' : id === hover ? '#38bdf8' : '#000000'
    const intensity = id === selected ? 0.55 : id === hover ? 0.3 : 0
    obj.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m?.emissive) { m.emissive.set(color); m.emissiveIntensity = intensity }
    })
  }
}
