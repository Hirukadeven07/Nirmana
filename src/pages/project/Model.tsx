import { housePlanFor } from '../../data/projectHousePlan'
import { HouseModelWorkspace } from '../HouseModel'
import { useProject } from './ProjectLayout'

/** The project's own 3D house model, generated from its floor plans and editable here. */
export default function Model() {
  const p = useProject()
  return (
    <HouseModelWorkspace
      key={p.id}
      storageKey={`nirmana.v1.housePlan.${p.id}`}
      makePlan={() => housePlanFor(p)}
      resetLabel="Project plan"
      header={(actions) => (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-xl font-bold text-slate-900">3D model</h2>
            <p className="mt-1 text-sm text-slate-500">Every room, slab and roof of {p.name}, generated from its floor plans. Click a part to see its specification, quantities and progress, or edit the plan below.</p>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      )}
    />
  )
}
