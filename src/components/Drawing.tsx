import { RES_FF, RES_GF, bespokeLayout, type Layout, type Room } from '../data/floorplans'
import type { PlanSheet, Project } from '../data/types'

const INK = '#1e293b'
const FAINT = '#94a3b8'
const W = 800
const H = 540

/** Label font size that fits a room width, capped at the normal 11px. */
const fitText = (label: string, width: number) => Math.min(11, (width - 8) / (label.length * 0.6))

function RoomPlan({ rooms, scale, ox, oy, symbols }: { rooms: Room[]; scale: number; ox: number; oy: number; symbols?: boolean }) {
  return (
    <g>
      {rooms.map(([x, y, w, h, label, kind], i) => {
        const X = ox + x * scale, Y = oy + y * scale, RW = w * scale, RH = h * scale
        return (
          <g key={i}>
            <rect x={X} y={Y} width={RW} height={RH} fill={kind === 'wet' ? '#f0f7ff' : kind === 'glass' ? '#f5f9ff' : kind === 'void' ? '#f1f5f9' : '#fff'} stroke={kind === 'glass' ? '#2563eb' : INK} strokeWidth={kind === 'dashed' || kind === 'open' ? 1.2 : kind === 'glass' || kind === 'void' ? 2 : 4} strokeDasharray={kind === 'dashed' || kind === 'void' ? '6 4' : kind === 'open' ? '2 4' : undefined} />
            {kind === 'void' && <path d={`M${X} ${Y} L${X + RW} ${Y + RH} M${X + RW} ${Y} L${X} ${Y + RH}`} stroke={FAINT} strokeWidth={1} />}
            {kind === 'stair' && Array.from({ length: 9 }, (_, s) => <line key={s} x1={X + 4} x2={X + RW - 4} y1={Y + 8 + s * (RH - 16) / 8} y2={Y + 8 + s * (RH - 16) / 8} stroke={FAINT} strokeWidth={1} />)}
            {kind === 'stair' && <path d={`M${X + RW / 2} ${Y + RH - 8} L${X + RW / 2} ${Y + 12} m-5 7 l5 -7 l5 7`} fill="none" stroke={INK} strokeWidth={1.2} />}
            {kind !== 'stair' && fitText(label, RW) >= 7 && (
              <>
                <text x={X + RW / 2} y={Y + RH / 2 - 2} textAnchor="middle" fontSize={fitText(label, RW)} fontWeight={600} fill={INK} fontFamily="Inter">{label}</text>
                <text x={X + RW / 2} y={Y + RH / 2 + 12} textAnchor="middle" fontSize={9} fill="#64748b" fontFamily="JetBrains Mono">{w}'×{h}'</text>
              </>
            )}
            {/* door swing on rooms with solid walls */}
            {!kind && w > 7 && (
              <path d={`M${X + 10} ${Y + RH - 2} a 20 20 0 0 1 20 -20 L${X + 10} ${Y + RH - 22} Z`} fill="none" stroke={FAINT} strokeWidth={1} />
            )}
            {symbols && !kind && (
              <g stroke="#b45309" fill="none" strokeWidth={1.3}>
                <circle cx={X + RW / 2} cy={Y + 16} r={6} /><path d={`M${X + RW / 2 - 4} ${Y + 12} l8 8 m0 -8 l-8 8`} />
                <rect x={X + 6} y={Y + RH / 2} width={8} height={8} /><rect x={X + RW - 14} y={Y + RH - 18} width={8} height={8} />
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}

function Dim({ x1, y1, x2, y2, label, vertical }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  return (
    <g stroke={FAINT} strokeWidth={1} fontFamily="JetBrains Mono" fontSize={10}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={x1 - (vertical ? 5 : 0)} y1={y1 - (vertical ? 0 : 5)} x2={x1 + (vertical ? 5 : 0)} y2={y1 + (vertical ? 0 : 5)} />
      <line x1={x2 - (vertical ? 5 : 0)} y1={y2 - (vertical ? 0 : 5)} x2={x2 + (vertical ? 5 : 0)} y2={y2 + (vertical ? 0 : 5)} />
      <text x={(x1 + x2) / 2 + (vertical ? -8 : 0)} y={(y1 + y2) / 2 + (vertical ? 0 : -6)} textAnchor="middle" fill="#64748b" stroke="none" transform={vertical ? `rotate(-90 ${(x1 + x2) / 2 - 8} ${(y1 + y2) / 2})` : undefined}>{label}</text>
    </g>
  )
}

function North({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={16} fill="none" stroke={INK} strokeWidth={1.2} />
      <path d="M0 -13 L6 8 L0 4 L-6 8 Z" fill={INK} />
      <text y={-20} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK} fontFamily="Inter">N</text>
    </g>
  )
}

function ResPlan({ upper, symbols }: { upper?: boolean; symbols?: boolean }) {
  const s = 11, ox = 120, oy = 60
  return (
    <>
      <RoomPlan rooms={upper ? RES_FF : RES_GF} scale={s} ox={ox} oy={oy} symbols={symbols} />
      {!upper && <text x={ox + 38 * s} y={oy + 7 * s} textAnchor="middle" fontSize={11} fill="#16a34a" fontStyle="italic" fontFamily="Inter">Garden court</text>}
      {!upper && Array.from({ length: 5 }, (_, i) => <circle key={i} cx={ox + (20 + i * 5.5) * s} cy={oy + 4 * s} r={9} fill="#dcfce7" stroke="#86efac" />)}
      <Dim x1={ox} y1={oy - 22} x2={ox + 46 * s} y2={oy - 22} label="46'-0&quot;" />
      <Dim x1={ox - 26} y1={oy} x2={ox - 26} y2={oy + 38 * s} label="38'-0&quot;" vertical />
      <North x={W - 70} y={70} />
    </>
  )
}

function ResElevation() {
  const g = 440
  return (
    <g>
      <line x1={60} x2={W - 60} y1={g} y2={g} stroke={INK} strokeWidth={2.5} />
      {Array.from({ length: 30 }, (_, i) => <line key={i} x1={60 + i * 23} y1={g} x2={50 + i * 23} y2={g + 10} stroke={FAINT} />)}
      <rect x={160} y={g - 250} width={480} height={250} fill="#fff" stroke={INK} strokeWidth={2.5} />
      <line x1={160} x2={640} y1={g - 125} y2={g - 125} stroke={INK} strokeWidth={1.5} />
      <path d={`M140 ${g - 250} L400 ${g - 360} L660 ${g - 250} Z`} fill="#fef3c7" stroke={INK} strokeWidth={2.5} />
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1={160 + i * 40} y1={g - 250 - (i < 6 ? i : 11 - i) * 17} x2={160 + i * 40} y2={g - 250} stroke="#d97706" strokeWidth={0.8} />)}
      {[200, 330, 480].map((x) => <g key={x}><rect x={x} y={g - 220} width={70} height={70} fill="#e0f2fe" stroke={INK} strokeWidth={1.5} /><line x1={x + 35} x2={x + 35} y1={g - 220} y2={g - 150} stroke={INK} /></g>)}
      {[200, 480].map((x) => <g key={x}><rect x={x} y={g - 95} width={70} height={65} fill="#e0f2fe" stroke={INK} strokeWidth={1.5} /><line x1={x + 35} x2={x + 35} y1={g - 95} y2={g - 30} stroke={INK} /></g>)}
      <rect x={350} y={g - 105} width={60} height={105} fill="#fde68a" stroke={INK} strokeWidth={1.5} />
      <rect x={160} y={g - 140} width={130} height={15} fill="#fff" stroke={INK} strokeWidth={1.2} />
      {Array.from({ length: 9 }, (_, i) => <line key={i} x1={165 + i * 15} x2={165 + i * 15} y1={g - 160} y2={g - 140} stroke={INK} />)}
      <line x1={160} x2={290} y1={g - 160} y2={g - 160} stroke={INK} strokeWidth={1.5} />
      <Dim x1={680} y1={g} x2={680} y2={g - 125} label="10'-6&quot;" vertical />
      <Dim x1={680} y1={g - 125} x2={680} y2={g - 250} label="10'-6&quot;" vertical />
      <text x={400} y={g + 32} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK} fontFamily="Inter">FRONT ELEVATION — 1:100</text>
    </g>
  )
}

function Foundation() {
  const xs = [140, 300, 440, 620], ys = [90, 230, 360, 470]
  return (
    <g>
      {xs.map((x, i) => <g key={x}><line x1={x} x2={x} y1={50} y2={500} stroke={FAINT} strokeDasharray="10 4 2 4" /><circle cx={x} cy={36} r={13} fill="#fff" stroke={INK} /><text x={x} y={40} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="Inter">{'ABCD'[i]}</text></g>)}
      {ys.map((y, i) => <g key={y}><line y1={y} y2={y} x1={90} x2={680} stroke={FAINT} strokeDasharray="10 4 2 4" /><circle cx={76} cy={y} r={13} fill="#fff" stroke={INK} /><text x={76} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="Inter">{i + 1}</text></g>)}
      {xs.flatMap((x) => ys.map((y) => (
        <g key={`${x}-${y}`}>
          <rect x={x - 22} y={y - 22} width={44} height={44} fill="#f1f5f9" stroke={INK} strokeDasharray="4 3" />
          <rect x={x - 7} y={y - 7} width={14} height={14} fill={INK} />
        </g>
      )))}
      {ys.map((y) => <line key={y} x1={140} x2={620} y1={y} y2={y} stroke={INK} strokeWidth={3} opacity={0.35} />)}
      <g fontFamily="Inter" fontSize={10} fill="#334155">
        <rect x={560} y={500} width={190} height={34} fill="#fff" stroke={FAINT} />
        <text x={570} y={514}>F1: 1500×1500×450, T12@150 B/W</text>
        <text x={570} y={527}>C1: 225×225, 4T16, R6@150</text>
      </g>
    </g>
  )
}

function Roof() {
  const x = 140, y = 70, w = 520, h = 400
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff7ed" stroke={INK} strokeWidth={2.5} />
      <path d={`M${x} ${y} L${x + 160} ${y + h / 2} L${x + w - 160} ${y + h / 2} L${x + w} ${y} M${x} ${y + h} L${x + 160} ${y + h / 2} M${x + w - 160} ${y + h / 2} L${x + w} ${y + h}`} fill="none" stroke={INK} strokeWidth={1.5} />
      {[[x + 260, y + 80, 0, 50], [x + 260, y + h - 80, 0, -50], [x + 70, y + h / 2, 50, 0], [x + w - 70, y + h / 2, -50, 0]].map(([ax, ay, dx, dy], i) => (
        <g key={i}><line x1={ax} y1={ay} x2={ax! + dx!} y2={ay! + dy!} stroke="#b45309" strokeWidth={1.5} markerEnd="url(#arrow)" /><text x={ax! + dx! / 2 + 12} y={ay! + dy! / 2} fontSize={10} fill="#b45309" fontFamily="JetBrains Mono">25°</text></g>
      ))}
      <rect x={x - 12} y={y - 12} width={w + 24} height={h + 24} fill="none" stroke={FAINT} strokeDasharray="6 4" />
      <text x={x + w / 2} y={y + h + 36} textAnchor="middle" fontSize={11} fill="#64748b" fontFamily="Inter">Eaves overhang 2'-0" all round · Gutters 5" half-round PVC</text>
      <North x={W - 70} y={70} />
    </g>
  )
}

function ComTypical() {
  const ox = 70, oy = 60, s = 5.4, w = 120, h = 80
  return (
    <g>
      <rect x={ox} y={oy} width={w * s} height={h * s} fill="#fff" stroke={INK} strokeWidth={4} />
      {Array.from({ length: 5 }, (_, i) => Array.from({ length: 4 }, (_, j) => <rect key={`${i}${j}`} x={ox + i * 30 * s - 5} y={oy + j * (80 / 3) * s - 5} width={10} height={10} fill={INK} />))}
      <rect x={ox + 46 * s} y={oy + 26 * s} width={28 * s} height={28 * s} fill="#f1f5f9" stroke={INK} strokeWidth={3} />
      {[0, 1, 2].map((i) => <rect key={i} x={ox + (48 + i * 8) * s} y={oy + 28 * s} width={7 * s} height={8 * s} fill="#e2e8f0" stroke={INK} />)}
      <text x={ox + 60 * s} y={oy + 42 * s} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="Inter">CORE</text>
      <text x={ox + 60 * s} y={oy + 48 * s} textAnchor="middle" fontSize={9} fill="#64748b" fontFamily="Inter">3 lifts · 2 stairs · WCs</text>
      {[0, 1, 2, 3].map((i) => <g key={i}><rect x={ox + i * 15 * s} y={oy} width={15 * s} height={16 * s} fill="#eef2ff" stroke={INK} strokeWidth={1.5} /><text x={ox + (i * 15 + 7.5) * s} y={oy + 9 * s} textAnchor="middle" fontSize={9.5} fontFamily="Inter">Meeting {i + 1}</text></g>)}
      {Array.from({ length: 6 }, (_, r) => Array.from({ length: 4 }, (_, c) => <rect key={`${r}-${c}`} x={ox + (6 + c * 9) * s} y={oy + (24 + r * 8.5) * s} width={7 * s} height={3.5 * s} fill="none" stroke={FAINT} />))}
      {Array.from({ length: 6 }, (_, r) => Array.from({ length: 4 }, (_, c) => <rect key={`b${r}-${c}`} x={ox + (80 + c * 9) * s} y={oy + (8 + r * 11) * s} width={7 * s} height={3.5 * s} fill="none" stroke={FAINT} />))}
      <text x={ox + 22 * s} y={oy + 76 * s} textAnchor="middle" fontSize={11} fontWeight={600} fill="#475569" fontFamily="Inter">Open office — Tenant A</text>
      <text x={ox + 98 * s} y={oy + 76 * s} textAnchor="middle" fontSize={11} fontWeight={600} fill="#475569" fontFamily="Inter">Open office — Tenant B</text>
      <Dim x1={ox} y1={oy - 22} x2={ox + w * s} y2={oy - 22} label="120'-0&quot; (36.6m)" />
      <Dim x1={ox + w * s + 24} y1={oy} x2={ox + w * s + 24} y2={oy + h * s} label="80'-0&quot;" vertical />
    </g>
  )
}

function ComElevation() {
  const g = 500, x = 250, w = 300, fl = 34
  return (
    <g>
      <line x1={60} x2={W - 60} y1={g} y2={g} stroke={INK} strokeWidth={2.5} />
      <rect x={x - 60} y={g - 60} width={w + 120} height={60} fill="#e2e8f0" stroke={INK} strokeWidth={2} />
      <rect x={x} y={g - 60 - fl * 12} width={w} height={fl * 12} fill="#dbeafe" stroke={INK} strokeWidth={2.5} />
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1={x} x2={x + w} y1={g - 60 - i * fl} y2={g - 60 - i * fl} stroke={INK} strokeWidth={1} />)}
      {Array.from({ length: 11 }, (_, i) => <line key={i} y1={g - 60 - fl * 12} y2={g - 60} x1={x + (i + 1) * (w / 12)} x2={x + (i + 1) * (w / 12)} stroke="#60a5fa" strokeWidth={0.8} />)}
      {Array.from({ length: 6 }, (_, i) => <rect key={i} x={x + i * 50 + 22} y={g - 60 - fl * 12} width={6} height={fl * 12} fill="#1e3a8a" opacity={0.75} />)}
      <rect x={x + 30} y={g - 60 - fl * 12 - 28} width={w - 60} height={28} fill="#f1f5f9" stroke={INK} strokeWidth={1.5} />
      <text x={x + w / 2} y={g - 60 - fl * 12 - 10} textAnchor="middle" fontSize={9} fontFamily="Inter" fill="#475569">PLANT ROOM · HELIPAD (PROV.)</text>
      {Array.from({ length: 12 }, (_, i) => <text key={i} x={x + w + 14} y={g - 60 - i * fl - 12} fontSize={9} fill="#64748b" fontFamily="JetBrains Mono">L{i + 1}</text>)}
      <text x={x + w / 2} y={g - 25} textAnchor="middle" fontSize={11} fontWeight={600} fontFamily="Inter">PODIUM · RETAIL & LOBBY</text>
      <text x={400} y={g + 28} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK} fontFamily="Inter">NORTH ELEVATION — 1:400</text>
    </g>
  )
}

function SitePlan() {
  return (
    <g>
      <path d="M90 80 L700 60 L720 470 L80 480 Z" fill="#f0fdf4" stroke="#16a34a" strokeWidth={2} strokeDasharray="12 5" />
      <rect x={230} y={150} width={320} height={210} fill="#fff" stroke={INK} strokeWidth={4} />
      <text x={390} y={258} textAnchor="middle" fontSize={13} fontWeight={700} fontFamily="Inter">BUILDING FOOTPRINT</text>
      <rect x={60} y={490} width={680} height={40} fill="#e5e7eb" />
      <text x={400} y={515} textAnchor="middle" fontSize={11} fontWeight={600} fill="#475569" fontFamily="Inter">MAIN ROAD (R.O.W. 60')</text>
      <path d="M340 490 L340 360 M440 490 L440 360" stroke="#64748b" strokeDasharray="8 6" />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={110 + i * 22} y={395} width={18} height={40} fill="none" stroke={FAINT} />)}
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={470 + i * 22} y={395} width={18} height={40} fill="none" stroke={FAINT} />)}
      <text x={210} y={452} textAnchor="middle" fontSize={10} fill="#64748b" fontFamily="Inter">Parking (P1–P10)</text>
      <text x={570} y={452} textAnchor="middle" fontSize={10} fill="#64748b" fontFamily="Inter">Parking (P11–P20)</text>
      <Dim x1={230} y1={130} x2={550} y2={130} label="Setback 20' front · 10' sides" />
      {[[120, 120], [660, 110], [660, 420], [130, 330]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={18} fill="#bbf7d0" stroke="#22c55e" />)}
      <North x={W - 60} y={110} />
    </g>
  )
}

function Warehouse({ elevation }: { elevation?: boolean }) {
  if (elevation) {
    const g = 470
    return (
      <g>
        <line x1={50} x2={W - 50} y1={g} y2={g} stroke={INK} strokeWidth={2.5} />
        <path d={`M100 ${g} L100 ${g - 220} L400 ${g - 290} L700 ${g - 220} L700 ${g}`} fill="#f8fafc" stroke={INK} strokeWidth={2.5} />
        {Array.from({ length: 30 }, (_, i) => <line key={i} x1={100 + i * 20} x2={100 + i * 20} y1={g - 220 - Math.min(i, 30 - i) * 4.6} y2={g} stroke="#cbd5e1" strokeWidth={0.8} />)}
        {Array.from({ length: 6 }, (_, i) => <g key={i}><rect x={130 + i * 95} y={g - 120} width={70} height={120} fill="#e2e8f0" stroke={INK} strokeWidth={1.5} />{Array.from({ length: 8 }, (_, k) => <line key={k} x1={130 + i * 95} x2={200 + i * 95} y1={g - 120 + k * 15} y2={g - 120 + k * 15} stroke={FAINT} />)}</g>)}
        <rect x={100} y={g - 180} width={600} height={14} fill="#bfdbfe" stroke={INK} />
        <Dim x1={730} y1={g} x2={730} y2={g - 220} label="12.0m eaves" vertical />
        <text x={400} y={g + 30} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK} fontFamily="Inter">SOUTH ELEVATION — DOCK FACE</text>
      </g>
    )
  }
  return (
    <g>
      <rect x={70} y={60} width={660} height={400} fill="#fff" stroke={INK} strokeWidth={4} />
      {Array.from({ length: 10 }, (_, i) => <line key={i} x1={70 + (i + 1) * 60} x2={70 + (i + 1) * 60} y1={60} y2={460} stroke={FAINT} strokeDasharray="10 4 2 4" />)}
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={170 + i * 58} y={90} width={14} height={280} fill="#fef3c7" stroke="#d97706" />)}
      <rect x={80} y={70} width={80} height={110} fill="#eef2ff" stroke={INK} strokeWidth={2} />
      <text x={120} y={128} textAnchor="middle" fontSize={10} fontWeight={600} fontFamily="Inter">Office</text>
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={110 + i * 50} y={452} width={34} height={16} fill={INK} />)}
      <text x={400} y={420} textAnchor="middle" fontSize={11} fontWeight={600} fill="#475569" fontFamily="Inter">Marshalling area · 12 dock doors</text>
      <text x={430} y={240} textAnchor="middle" fontSize={13} fontWeight={700} fill="#b45309" fontFamily="Inter" opacity={0.9}>SELECTIVE PALLET RACKING</text>
      <Dim x1={70} y1={40} x2={730} y2={40} label="240'-0&quot; (73.2m)" />
    </g>
  )
}

/** Floor plan of one level of a project's own layout, scaled to fit the sheet. */
function LevelPlan({ layout, level, symbols }: { layout: Layout; level: number; symbols?: boolean }) {
  const lv = layout.levels[Math.min(level, layout.levels.length - 1)]
  const s = Math.min((W - 220) / layout.width, (H - 140) / layout.depth)
  const ox = (W - layout.width * s) / 2, oy = 54 + (H - 140 - layout.depth * s) / 2
  const ft = (n: number) => `${n}'-0"`
  return (
    <>
      <RoomPlan rooms={lv.rooms} scale={s} ox={ox} oy={oy} symbols={symbols} />
      {(lv.objects ?? []).filter((o) => o.kind !== 'tree' && o.kind !== 'pool').map((o, i) => (
        <rect key={i} x={ox + o.x * s} y={oy + o.y * s} width={o.w * s} height={o.d * s} fill={o.kind === 'plant' ? '#dcfce7' : 'none'} stroke={o.kind === 'plant' ? '#86efac' : FAINT} />
      ))}
      <Dim x1={ox} y1={oy - 22} x2={ox + layout.width * s} y2={oy - 22} label={ft(layout.width)} />
      <Dim x1={ox - 26} y1={oy} x2={ox - 26} y2={oy + layout.depth * s} label={ft(layout.depth)} vertical />
      <North x={W - 60} y={70} />
      <text x={W / 2} y={H - 22} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK} fontFamily="Inter">{lv.name.toUpperCase()} PLAN — 1:100</text>
    </>
  )
}

/** Which level of a layout a floor-plan sheet shows. */
const SHEET_LEVEL: Partial<Record<PlanSheet['drawing'], number>> = { 'res-gf': 0, 'res-ff': 1, 'res-elec': 0, 'com-typ': 0, 'wh-plan': 0 }

export function Drawing({ kind, project }: { kind: PlanSheet['drawing']; project?: Pick<Project, 'id'> }) {
  // Projects with their own layout draw it, so the sheet matches the 3D tour.
  const layout = project && SHEET_LEVEL[kind] !== undefined ? bespokeLayout(project) : null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" role="img" aria-label="Drawing">
      <defs>
        <pattern id="paper-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 L0 0 0 20" fill="none" stroke="#eef2f7" strokeWidth={1} /></pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#b45309" /></marker>
      </defs>
      <rect width={W} height={H} fill="#fcfcfd" />
      <rect width={W} height={H} fill="url(#paper-grid)" />
      {layout && <LevelPlan layout={layout} level={SHEET_LEVEL[kind]!} symbols={kind === 'res-elec'} />}
      {!layout && kind === 'res-gf' && <ResPlan />}
      {!layout && kind === 'res-ff' && <ResPlan upper />}
      {!layout && kind === 'res-elec' && <ResPlan symbols />}
      {kind === 'res-elev' && <ResElevation />}
      {kind === 'res-found' && <Foundation />}
      {kind === 'res-roof' && <Roof />}
      {!layout && kind === 'com-typ' && <ComTypical />}
      {kind === 'com-elev' && <ComElevation />}
      {kind === 'com-site' && <SitePlan />}
      {!layout && kind === 'wh-plan' && <Warehouse />}
      {kind === 'wh-elev' && <Warehouse elevation />}
    </svg>
  )
}
