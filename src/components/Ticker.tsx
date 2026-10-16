import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { MATERIALS } from '../data/materials'
import { num } from '../lib/format'
import { usePrices } from '../store/store'

const TICKER_IDS = ['cement-opc', 'steel-t12', 'steel-t16', 'sand-river', 'sand-msand', 'metal-20', 'brick-clay', 'block-6', 'rmc-g25', 'tile-floor', 'paint-int', 'wire-25', 'roof-zinc', 'alu-section', 'glass-5', 'teak', 'pvc-4']

export function Ticker({ dark = false }: { dark?: boolean }) {
  const { prices, localPrice } = usePrices()
  const items = TICKER_IDS.map((id) => MATERIALS.find((m) => m.id === id)!)
  const row = items.map((m) => {
    const p = prices[m.id]!
    const change = p.price / p.open - 1
    const up = change > 0.00005
    const down = change < -0.00005
    return (
      <span key={m.id} className="inline-flex items-center gap-2 px-4 text-xs">
        <span className={clsx('font-medium', dark ? 'text-slate-400' : 'text-slate-500')}>{m.name.replace(/ \(.*\)/, '')}</span>
        <span key={p.at} className={clsx('num font-semibold rounded px-1', dark ? 'text-white' : 'text-slate-900', p.at && (p.dir > 0 ? 'flash-up' : 'flash-down'))}>
          {num(localPrice(m.id), localPrice(m.id) < 100 ? 2 : 0)}
        </span>
        <span className={clsx('num inline-flex items-center font-semibold', up ? 'text-red-500' : down ? 'text-emerald-500' : dark ? 'text-slate-500' : 'text-slate-400')}>
          {up ? <ArrowUpRight size={12} /> : down ? <ArrowDownRight size={12} /> : null}
          {(Math.abs(change) * 100).toFixed(2)}%
        </span>
        <span className={dark ? 'text-slate-700' : 'text-slate-300'}>•</span>
      </span>
    )
  })
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <div className="marquee inline-flex">{row}{row}</div>
    </div>
  )
}
