import clsx from 'clsx'
import { ArrowLeft, Download, FileJson, Hammer, Info, Plus, RotateCcw, Ruler, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/Layout'
import { HouseViewer } from '../components/model3d/HouseViewer'
import { presetView, type ViewState } from '../components/model3d/view'
import { Badge, Button, Card, CardHeader, Field, inputCls, Progress } from '../components/ui'
import {
  allSections, FINISH_RATES, newRoomId, planExtent, ROOM_TYPE_META, samplePlan, STATUS_META,
  type HousePlan, type PlanFloor, type PlanRoom, type RoofType, type RoomType, type SectionDetails, type WorkStatus,
} from '../data/housePlan'
import { rs, rsCompact } from '../lib/format'
import { useApp } from '../store/store'

const STORE_KEY = 'nirmana.v1.housePlan'

function loadPlan(): HousePlan {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as HousePlan
      if (Array.isArray(p.floors) && p.floors.length) return p
    }
  } catch {
    /* fall back to the sample */
  }
  return samplePlan()
}

export default function HouseModel() {
  const { toast } = useApp()
  const [plan, setPlan] = useState<HousePlan>(loadPlan)
  const [view, setView] = useState<ViewState>(() => presetView('exterior', plan.floors.length))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [floorIdx, setFloorIdx] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(plan)) } catch { /* storage unavailable */ }
  }, [plan])

  const sections = useMemo(() => allSections(plan), [plan])
  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections])
  const selected = selectedId ? byId.get(selectedId) ?? null : null

  const select = (id: string | null) => {
    setSelectedId(id)
    const s = id ? byId.get(id) : null
    if (s?.floorId) setFloorIdx(Math.max(0, plan.floors.findIndex((f) => f.id === s.floorId)))
  }

  const floor = plan.floors[Math.min(floorIdx, plan.floors.length - 1)]!
  const selectedRoom = selected?.roomId && selected.floorId === floor.id ? floor.rooms.find((r) => r.id === selected.roomId) : undefined

  const updateFloor = (fid: string, fn: (f: PlanFloor) => PlanFloor) => setPlan((p) => ({ ...p, floors: p.floors.map((f) => (f.id === fid ? fn(f) : f)) }))
  const updateRoom = (rid: string, patch: Partial<PlanRoom>) => updateFloor(floor.id, (f) => ({ ...f, rooms: f.rooms.map((r) => (r.id === rid ? { ...r, ...patch } : r)) }))

  const addRoom = () => {
    const ext = planExtent(plan)
    const r: PlanRoom = {
      id: newRoomId(), name: 'New room', type: 'bedroom', x: Math.round(ext.w), y: 8, w: 10, d: 10,
      floorFinish: 'Homogeneous tiles 600×600', wallFinish: 'Emulsion paint, 2 coats', ceiling: 'Gypsum board, emulsion paint',
      electrical: '2 light points, 2 socket outlets', notes: '', status: 'Not started', progress: 0,
    }
    updateFloor(floor.id, (f) => ({ ...f, rooms: [...f.rooms, r] }))
    setSelectedId(`${floor.id}:${r.id}`)
  }
  const deleteRoom = (rid: string) => {
    updateFloor(floor.id, (f) => ({ ...f, rooms: f.rooms.filter((r) => r.id !== rid) }))
    setSelectedId(null)
  }
  const addFloor = () => {
    const top = plan.floors[plan.floors.length - 1]!
    const id = `l${Date.now().toString(36)}`
    const rooms = top.rooms.filter((r) => r.type !== 'outdoor' || plan.floors.length > 1).map((r) => ({ ...r, id: newRoomId(), status: 'Not started' as WorkStatus, progress: 0 }))
    setPlan((p) => ({ ...p, floors: [...p.floors, { id, name: `Floor ${p.floors.length}`, height: top.height, rooms }] }))
    setView((v) => ({ ...v, floors: [...v.floors, true] }))
    setFloorIdx(plan.floors.length)
    toast({ title: 'Floor added', body: 'Copied from the floor below. Edit its rooms in the plan.', tone: 'success' })
  }
  const removeFloor = () => {
    if (plan.floors.length < 2) return
    setPlan((p) => ({ ...p, floors: p.floors.filter((_, i) => i !== floorIdx) }))
    setView((v) => ({ ...v, floors: v.floors.filter((_, i) => i !== floorIdx) }))
    setFloorIdx(0)
    setSelectedId(null)
  }

  const exportPlan = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${plan.name.replace(/\W+/g, '-').toLowerCase() || 'house'}-plan.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importPlan = async (file: File) => {
    try {
      const p = JSON.parse(await file.text()) as HousePlan
      if (!Array.isArray(p.floors) || !p.floors.length || !p.floors.every((f) => Array.isArray(f.rooms))) throw new Error('No floors')
      setPlan(p)
      setView(presetView('exterior', p.floors.length))
      setSelectedId(null)
      setFloorIdx(0)
      toast({ title: 'Plan imported', body: `${p.name}: ${p.floors.length} floors`, tone: 'success' })
    } catch {
      toast({ title: 'Could not read that file', body: 'Choose a plan exported from Nirmana (JSON).', tone: 'warning' })
    }
  }
  const resetPlan = () => {
    const p = samplePlan()
    setPlan(p)
    setView(presetView('exterior', p.floors.length))
    setSelectedId(null)
    setFloorIdx(0)
    toast({ title: 'Sample plan restored', tone: 'info' })
  }

  const totals = useMemo(() => {
    const rooms = plan.floors.flatMap((f) => f.rooms)
    const area = rooms.filter((r) => r.type !== 'outdoor').reduce((s, r) => s + r.w * r.d, 0)
    const cost = sections.reduce((s, x) => s + x.cost, 0)
    const progress = cost ? sections.reduce((s, x) => s + x.cost * x.progress, 0) / cost : 0
    return { area, cost, progress, rooms: rooms.length }
  }, [plan, sections])

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Plan to model"
        title="3D house model"
        subtitle="Generated from the plan and details below. Click any room or building element to see its specification, quantities and progress."
        actions={
          <>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importPlan(f); e.target.value = '' }} />
            <Button size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} />Import plan</Button>
            <Button size="sm" onClick={exportPlan}><Download size={14} />Export plan</Button>
            <Button size="sm" variant="ghost" onClick={resetPlan}><RotateCcw size={14} />Sample plan</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <HouseViewer plan={plan} view={view} onView={setView} selectedId={selectedId} onSelect={select} titleFor={(id) => byId.get(id)?.title} />
        <DetailsPanel
          plan={plan}
          totals={totals}
          sections={sections}
          selected={selected}
          onSelect={select}
          onEdit={() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      </div>

      {/* Plan input */}
      <div ref={editorRef} className="grid scroll-mt-4 gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader
            icon={<Ruler size={16} />}
            title="Floor plan"
            subtitle="Dimensions in feet. Click a room to select it here and in the 3D model."
            action={
              <div className="flex items-center gap-1.5">
                <Button size="sm" onClick={addRoom}><Plus size={14} />Room</Button>
                <Button size="sm" variant="ghost" onClick={addFloor}><Plus size={14} />Floor</Button>
              </div>
            }
          />
          <div className="px-5 pb-5">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {plan.floors.map((f, i) => (
                <button key={f.id} onClick={() => setFloorIdx(i)} className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer', i === floorIdx ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                  {f.name}
                </button>
              ))}
              {plan.floors.length > 1 && floorIdx > 0 && (
                <button onClick={() => { if (window.confirm(`Remove ${floor.name} and all its rooms?`)) removeFloor() }} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline cursor-pointer"><Trash2 size={12} />Remove {floor.name.toLowerCase()}</button>
              )}
            </div>
            <PlanSvg plan={plan} floor={floor} below={floorIdx > 0 ? plan.floors[floorIdx - 1] : undefined} selectedId={selectedId} onSelect={select} colorMode={view.colorMode} />
          </div>
        </Card>

        <Card>
          {selectedRoom ? (
            <RoomForm key={selectedRoom.id} room={selectedRoom} floor={floor} onChange={(patch) => updateRoom(selectedRoom.id, patch)} onDelete={() => deleteRoom(selectedRoom.id)} />
          ) : (
            <BuildingForm plan={plan} setPlan={setPlan} floor={floor} onFloor={(patch) => updateFloor(floor.id, (f) => ({ ...f, ...patch }))} />
          )}
        </Card>
      </div>
    </div>
  )
}

/* ───────────────────────── Details panel ───────────────────────── */

function DetailsPanel({ plan, totals, sections, selected, onSelect, onEdit }: {
  plan: HousePlan
  totals: { area: number; cost: number; progress: number; rooms: number }
  sections: SectionDetails[]
  selected: SectionDetails | null
  onSelect: (id: string | null) => void
  onEdit: () => void
}) {
  if (!selected) {
    const groups = ['Structure', ...plan.floors.map((f) => f.name)]
    return (
      <Card className="flex max-h-[560px] flex-col overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <p className="text-xs font-semibold text-accent">{plan.location}</p>
          <h3 className="font-display text-lg font-bold text-slate-900">{plan.name}</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Mini label="Floor area" value={`${totals.area.toLocaleString()} ft²`} />
            <Mini label="Est. cost" value={rsCompact(totals.cost)} />
            <Mini label="Progress" value={`${Math.round(totals.progress)}%`} />
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500"><Info size={13} className="mt-0.5 shrink-0" />Click a part of the model, or pick a section below.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 scroll-thin">
          {groups.map((g) => (
            <div key={g} className="mb-2">
              <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{g}</p>
              {sections.filter((s) => s.group === g).map((s) => (
                <button key={s.id} onClick={() => onSelect(s.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 cursor-pointer">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: STATUS_META[s.status].color }} />
                  <span className="flex-1 truncate text-sm text-slate-700">{s.title}</span>
                  <span className="num text-[11px] text-slate-400">{s.progress}%</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex max-h-[560px] flex-col overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <button onClick={() => onSelect(null)} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"><ArrowLeft size={13} />All sections</button>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-accent">{selected.group}</p>
            <h3 className="font-display text-lg font-bold text-slate-900">{selected.title}</h3>
            <p className="text-xs text-slate-500">{selected.summary}</p>
          </div>
          <Badge tone={STATUS_META[selected.status].tone}>{selected.status}</Badge>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={selected.progress} className="flex-1" color={STATUS_META[selected.status].color} />
          <span className="num text-xs font-semibold text-slate-600">{selected.progress}%</span>
        </div>
        <div className="mt-3 flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-xs text-slate-500">Estimated cost</span>
          <span className="num text-sm font-bold text-slate-900">{rs(selected.cost)}</span>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5 scroll-thin">
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Specification</p>
          <dl className="divide-y divide-slate-100 text-sm">
            {selected.specs.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2 py-1.5">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-[13px] text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Quantities</p>
          <table className="w-full text-[13px]">
            <tbody className="divide-y divide-slate-100">
              {selected.quantities.map((q) => (
                <tr key={q.item}>
                  <td className="py-1.5 pr-2 text-slate-700">{q.item}</td>
                  <td className="num py-1.5 text-right text-slate-900">{q.qty.toLocaleString()} <span className="text-slate-400">{q.unit}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected.notes && (
          <div className="rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-600">Notes</p>
            {selected.notes}
          </div>
        )}
        {selected.kind === 'room' && <Button size="sm" className="w-full" onClick={onEdit}><Hammer size={14} />Edit this room in the plan</Button>}
      </div>
    </Card>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <p className="num text-sm font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  )
}

/* ───────────────────────── 2D plan ───────────────────────── */

function PlanSvg({ plan, floor, below, selectedId, onSelect, colorMode }: {
  plan: HousePlan
  floor: PlanFloor
  below?: PlanFloor
  selectedId: string | null
  onSelect: (id: string) => void
  colorMode: 'type' | 'status'
}) {
  const ext = planExtent(plan)
  const pad = 3
  const W = Math.max(ext.w, 10) + pad * 2
  const D = Math.max(ext.d, 10) + pad * 2
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#f8f6f1]">
      <svg viewBox={`${-pad} ${-pad} ${W} ${D}`} className="block max-h-[460px] w-full" role="img" aria-label={`${floor.name} plan`}>
        <defs>
          <pattern id="grid" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M2 0H0V2" fill="none" stroke="#e7e2d7" strokeWidth="0.06" /></pattern>
        </defs>
        <rect x={-pad} y={-pad} width={W} height={D} fill="url(#grid)" />
        {below?.rooms.map((r) => <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.d} fill="none" stroke="#cbd5e1" strokeWidth="0.15" strokeDasharray="0.6 0.4" />)}
        {floor.rooms.map((r) => {
          const id = `${floor.id}:${r.id}`
          const sel = id === selectedId
          const fill = colorMode === 'status' ? STATUS_META[r.status].color : ROOM_TYPE_META[r.type].color
          // Fit the label to the room: roughly 0.6 em per character across the width.
          const fs = Math.max(0.55, Math.min(1.5, r.d / 4, (r.w * 0.9) / (r.name.length * 0.6)))
          return (
            <g key={r.id} onClick={() => onSelect(id)} className="cursor-pointer">
              <rect x={r.x} y={r.y} width={r.w} height={r.d} fill={fill} fillOpacity={r.type === 'outdoor' ? 0.45 : 0.8} stroke={sel ? '#f5a524' : '#334155'} strokeWidth={sel ? 0.45 : r.type === 'outdoor' ? 0.12 : plan.wallThickness / 2} strokeDasharray={r.type === 'outdoor' ? '0.6 0.4' : undefined} className="transition hover:fill-opacity-100" />
              <text x={r.x + r.w / 2} y={r.y + r.d / 2 - fs * 0.15} textAnchor="middle" fontSize={fs} fontWeight={700} fill="#1e293b" className="pointer-events-none select-none">{r.name}</text>
              <text x={r.x + r.w / 2} y={r.y + r.d / 2 + fs * 1.05} textAnchor="middle" fontSize={fs * 0.75} fill="#475569" className="pointer-events-none select-none">{r.w}′ × {r.d}′</text>
            </g>
          )
        })}
        <g transform={`translate(${W - pad - 4} ${-pad + 1.5})`}>
          <path d="M0 3 L1 0 L2 3 Z" fill="#334155" />
          <text x="1" y="4.6" textAnchor="middle" fontSize="1.2" fontWeight={700} fill="#334155">N</text>
        </g>
      </svg>
    </div>
  )
}

/* ───────────────────────── Forms ───────────────────────── */

function NumInput({ label, value, onChange, step = 0.5, min = 0 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  return (
    <Field label={label}>
      <input type="number" step={step} min={min} className={clsx(inputCls, 'num')} value={value} onChange={(e) => { const v = +e.target.value; if (Number.isFinite(v)) onChange(Math.max(min, v)) }} />
    </Field>
  )
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <Field label={label}><input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} /></Field>
}

function RoomForm({ room, floor, onChange, onDelete }: { room: PlanRoom; floor: PlanFloor; onChange: (p: Partial<PlanRoom>) => void; onDelete: () => void }) {
  const finishes = Object.keys(FINISH_RATES)
  return (
    <>
      <CardHeader icon={<Hammer size={16} />} title={`Edit ${room.name}`} subtitle={`${floor.name} · changes rebuild the model instantly`} action={<Button size="sm" variant="danger" onClick={onDelete}><Trash2 size={13} />Delete</Button>} />
      <div className="space-y-3 px-5 pb-5">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Name" value={room.name} onChange={(v) => onChange({ name: v })} />
          <Field label="Type">
            <select className={inputCls} value={room.type} onChange={(e) => onChange({ type: e.target.value as RoomType })}>
              {(Object.keys(ROOM_TYPE_META) as RoomType[]).map((t) => <option key={t} value={t}>{ROOM_TYPE_META[t].label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <NumInput label="X (ft)" value={room.x} onChange={(v) => onChange({ x: v })} />
          <NumInput label="Y (ft)" value={room.y} onChange={(v) => onChange({ y: v })} />
          <NumInput label="Width" value={room.w} min={2} onChange={(v) => onChange({ w: v })} />
          <NumInput label="Depth" value={room.d} min={2} onChange={(v) => onChange({ d: v })} />
        </div>
        <Field label="Floor finish">
          <select className={inputCls} value={room.floorFinish} onChange={(e) => onChange({ floorFinish: e.target.value })}>
            {!finishes.includes(room.floorFinish) && <option>{room.floorFinish}</option>}
            {finishes.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
        <TextInput label="Wall finish" value={room.wallFinish} onChange={(v) => onChange({ wallFinish: v })} />
        <TextInput label="Ceiling" value={room.ceiling} onChange={(v) => onChange({ ceiling: v })} />
        <TextInput label="Electrical" value={room.electrical} onChange={(v) => onChange({ electrical: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select className={inputCls} value={room.status} onChange={(e) => { const s = e.target.value as WorkStatus; onChange({ status: s, progress: s === 'Complete' ? 100 : s === 'Not started' ? 0 : Math.max(5, Math.min(95, room.progress)) }) }}>
              {(Object.keys(STATUS_META) as WorkStatus[]).map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <NumInput label="Progress %" value={room.progress} step={5} onChange={(v) => { const p = Math.min(100, v); onChange({ progress: p, status: p >= 100 ? 'Complete' : p > 0 ? 'In progress' : 'Not started' }) }} />
        </div>
        <Field label="Notes"><textarea className={clsx(inputCls, 'min-h-16')} value={room.notes} onChange={(e) => onChange({ notes: e.target.value })} /></Field>
      </div>
    </>
  )
}

function BuildingForm({ plan, setPlan, floor, onFloor }: { plan: HousePlan; setPlan: React.Dispatch<React.SetStateAction<HousePlan>>; floor: PlanFloor; onFloor: (p: Partial<PlanFloor>) => void }) {
  const set = (patch: Partial<HousePlan>) => setPlan((p) => ({ ...p, ...patch }))
  return (
    <>
      <CardHeader icon={<FileJson size={16} />} title="Building details" subtitle="Select a room on the plan to edit it" />
      <div className="space-y-3 px-5 pb-5">
        <TextInput label="Project name" value={plan.name} onChange={(v) => set({ name: v })} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Location" value={plan.location} onChange={(v) => set({ location: v })} />
          <TextInput label="Client" value={plan.client} onChange={(v) => set({ client: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label={`${floor.name} name`} value={floor.name} onChange={(v) => onFloor({ name: v })} />
          <NumInput label="Floor-to-floor (ft)" value={floor.height} min={8} onChange={(v) => onFloor({ height: v })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Roof">
            <select className={inputCls} value={plan.roof.type} onChange={(e) => set({ roof: { ...plan.roof, type: e.target.value as RoofType } })}>
              <option value="hip">Hipped</option>
              <option value="gable">Gable</option>
              <option value="flat">Flat</option>
            </select>
          </Field>
          <NumInput label="Pitch (°)" value={plan.roof.pitch} step={1} min={5} onChange={(v) => set({ roof: { ...plan.roof, pitch: Math.min(50, v) } })} />
          <NumInput label="Overhang (ft)" value={plan.roof.overhang} onChange={(v) => set({ roof: { ...plan.roof, overhang: Math.min(5, v) } })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="Wall thickness (ft)" value={plan.wallThickness} step={0.125} min={0.25} onChange={(v) => set({ wallThickness: Math.min(1.5, v) })} />
          <NumInput label="Plinth height (ft)" value={plan.plinth} step={0.25} onChange={(v) => set({ plinth: Math.min(4, v) })} />
        </div>
        <TextInput label="Foundation" value={plan.structure.foundation} onChange={(v) => set({ structure: { ...plan.structure, foundation: v } })} />
        <TextInput label="Walls" value={plan.structure.walls} onChange={(v) => set({ structure: { ...plan.structure, walls: v } })} />
        <TextInput label="Roof covering" value={plan.roof.material} onChange={(v) => set({ roof: { ...plan.roof, material: v } })} />
      </div>
    </>
  )
}
