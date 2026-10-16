import type { DailyLog } from '../data/types'
import { rsCompact } from '../lib/format'

export function Sparkline({ data, width = 96, height = 28, color }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return <svg width={width} height={height} />
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const up = data[data.length - 1]! >= data[0]!
  const stroke = color ?? (up ? '#ef4444' : '#10b981')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={`${d} L${width} ${height} L0 ${height} Z`} fill={stroke} opacity={0.08} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Shared Recharts tooltip with LKR formatting. */
export function ChartTooltip({ active, payload, label, fmt = rsCompact, labelFmt }: {
  active?: boolean
  payload?: { name: string; value: number; color: string; dataKey: string }[]
  label?: string
  fmt?: (n: number) => string
  labelFmt?: (l: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur text-xs">
      <div className="mb-1 font-semibold text-slate-700">{labelFmt ? labelFmt(String(label)) : label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}</span>
          <span className="ml-auto pl-4 num font-semibold text-slate-900">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** Illustrated stand-in for site photos so the demo carries no external images. */
export function SitePhoto({ photo, className }: { photo: DailyLog['photos'][number]; className?: string }) {
  const { hue, kind } = photo
  const sky = `hsl(${205} 70% ${kind === 'roof' ? 78 : 84}%)`
  const ground = `hsl(${30} 35% 62%)`
  return (
    <svg viewBox="0 0 160 110" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`sky-${hue}-${kind}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky} />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>
      <rect width="160" height="110" fill={`url(#sky-${hue}-${kind})`} />
      <path d="M0 62 Q30 52 60 60 T120 56 T160 58 V110 H0Z" fill="#86b98a" opacity={0.6} />
      <rect y="80" width="160" height="30" fill={ground} />
      {kind === 'rebar' && (
        <g stroke={`hsl(${hue} 55% 38%)`} strokeWidth={1.6}>
          {Array.from({ length: 9 }, (_, i) => <line key={i} x1={20 + i * 14} x2={20 + i * 14} y1={22} y2={86} />)}
          {Array.from({ length: 7 }, (_, i) => <line key={i} x1={16} x2={136} y1={30 + i * 9} y2={30 + i * 9} strokeWidth={0.9} />)}
        </g>
      )}
      {kind === 'slab' && (
        <g>
          <rect x="18" y="44" width="124" height="10" fill="#9ca3af" />
          {[24, 60, 96, 132].map((x) => <rect key={x} x={x} y="54" width="6" height="30" fill="#a3a3a3" />)}
          <rect x="18" y="40" width="124" height="4" fill="#d1d5db" />
          <rect x="108" y="20" width="22" height="18" fill="#f59e0b" /><rect x="112" y="16" width="10" height="5" fill="#334155" />
        </g>
      )}
      {kind === 'wall' && (
        <g>
          {Array.from({ length: 6 }, (_, r) => Array.from({ length: 9 }, (_, c) => <rect key={`${r}${c}`} x={14 + c * 15 + (r % 2) * 7} y={40 + r * 7} width={14} height={6} fill={`hsl(${hue} 60% ${46 + ((r + c) % 3) * 4}%)`} />))}
          <rect x="62" y="44" width="26" height="24" fill="#e2e8f0" />
        </g>
      )}
      {kind === 'roof' && (
        <g>
          <rect x="30" y="52" width="100" height="32" fill="#e7e5e4" />
          <path d="M20 54 L80 22 L140 54 Z" fill={`hsl(${hue + 10} 55% 48%)`} />
          {Array.from({ length: 8 }, (_, i) => <line key={i} x1={28 + i * 15} y1={54} x2={80} y2={24} stroke="#7c2d12" strokeWidth={0.6} opacity={0.5} />)}
        </g>
      )}
      {kind === 'site' && (
        <g>
          <rect x="24" y="70" width="40" height="12" fill="#a16207" opacity={0.6} />
          <rect x="92" y="58" width="34" height="18" rx="2" fill="#f59e0b" /><rect x="118" y="46" width="4" height="16" fill="#334155" />
          <circle cx="98" cy="80" r="5" fill="#1f2937" /><circle cx="120" cy="80" r="5" fill="#1f2937" />
          {[30, 44, 58].map((x) => <line key={x} x1={x} x2={x} y1={60} y2={82} stroke="#f97316" strokeWidth={1.5} />)}
        </g>
      )}
      {kind === 'finish' && (
        <g>
          <rect x="0" y="20" width="160" height="62" fill={`hsl(${hue} 25% 92%)`} />
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x={i * 28} y="82" width="27" height="28" fill={`hsl(${hue} 10% ${84 - (i % 2) * 6}%)`} />)}
          <rect x="58" y="32" width="44" height="34" fill="#bae6fd" stroke="#94a3b8" />
          <line x1="80" x2="80" y1="32" y2="66" stroke="#94a3b8" />
        </g>
      )}
    </svg>
  )
}
