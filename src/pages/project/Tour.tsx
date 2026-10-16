import { Box, FileText } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Empty } from '../../components/ui'
import { TourViewer } from '../../components/tour/TourViewer'
import { tourModelFor } from '../../data/floorplans'
import { date } from '../../lib/format'
import { useApp } from '../../store/store'
import { useProject } from './ProjectLayout'

const LEAD = {
  client: 'Walk through the building before it is built. Check room sizes, sight lines and how spaces connect, then raise anything on the plan sheet.',
  architect: 'Generated from your floor-plan sheets. Issuing a new revision regenerates the tour, so the client always walks the current design.',
  contractor: 'A walkable view of the approved floor plans, for set-out briefings and sequencing discussions on site.',
} as const

export default function Tour() {
  const p = useProject()
  const { role } = useApp()
  // Rebuild only when the source sheets change revision, not on every project edit.
  const revKey = p.plans.map((s) => `${s.id}${s.rev}${s.status}`).join()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => tourModelFor(p), [p.id, revKey])

  if (!model) {
    return (
      <Card>
        <Empty icon={<Box size={22} />} title="No floor plans to walk through yet" body="The 3D tour is generated automatically once the architect uploads a floor-plan sheet." action={<Link to="../plans"><Button size="sm">Go to plans</Button></Link>} />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-display text-xl font-bold text-slate-900">3D virtual tour</h2>
          <p className="mt-1 text-sm text-slate-500">{LEAD[role]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {model.sources.map((s) => (
            <Link key={s.id} to="../plans" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 hover:border-accent">
              <FileText size={14} className="text-slate-400" />
              <div className="leading-tight">
                <p className="text-xs font-semibold text-slate-800">{s.code} · Rev {s.rev}</p>
                <p className="text-[11px] text-slate-500">{s.title} · {date(s.date)}</p>
              </div>
              <Badge tone={s.status === 'Approved' ? 'green' : s.status === 'Awaiting client' ? 'amber' : 'red'} className="!text-[10px] !px-1">{s.status}</Badge>
            </Link>
          ))}
        </div>
      </div>
      <TourViewer key={model.id + revKey} model={model} />
      <p className="text-xs text-slate-400">Indicative visualisation generated from plan dimensions. Furniture, finishes and materials are placeholders. The drawings remain the contract documents.</p>
    </div>
  )
}
