import clsx from 'clsx'
import { Box, Check, FileUp, History, MessageSquarePlus, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Drawing } from '../../components/Drawing'
import { Avatar, Badge, Button, Card, Field, Modal, RoleBadge, inputCls } from '../../components/ui'
import { TOURABLE } from '../../data/floorplans'
import type { PlanSheet, PlanStatus } from '../../data/types'
import { TODAY_ISO, date, relative } from '../../lib/format'
import { useApp } from '../../store/store'
import { useProject } from './ProjectLayout'

const STATUS_TONE: Record<PlanStatus, 'green' | 'amber' | 'red' | 'slate'> = {
  Approved: 'green', 'Awaiting client': 'amber', 'Revision requested': 'red', Superseded: 'slate',
}

export default function Plans() {
  const p = useProject()
  const { role, update, toast, personFor } = useApp()
  const [selected, setSelected] = useState(p.plans.find((s) => s.status === 'Awaiting client')?.id ?? p.plans[0]?.id)
  const [zoom, setZoom] = useState(1)
  const [commenting, setCommenting] = useState(false)
  const [draft, setDraft] = useState<{ x: number; y: number; text: string } | null>(null)
  const [activePin, setActivePin] = useState<string | null>(null)
  const [revModal, setRevModal] = useState<'request' | 'issue' | null>(null)
  const [note, setNote] = useState('')
  const sheet = p.plans.find((s) => s.id === selected) ?? p.plans[0]

  useEffect(() => { setZoom(1); setDraft(null); setActivePin(null) }, [selected])

  if (!sheet) return <p className="text-sm text-slate-500">No drawings uploaded yet.</p>

  const patch = (fn: (s: PlanSheet) => PlanSheet, text: string) =>
    update(p.id, (x) => ({ ...x, plans: x.plans.map((s) => (s.id === sheet.id ? fn(s) : s)) }), { text, kind: 'plan' })

  const approve = () => {
    patch((s) => ({ ...s, status: 'Approved' }), `approved ${sheet.code} ${sheet.title} (Rev ${sheet.rev})`)
    toast({ title: `${sheet.code} approved`, body: 'The contractor can now build to this revision.', tone: 'success' })
  }
  const requestRevision = () => {
    patch((s) => ({ ...s, status: 'Revision requested', comments: note ? [...s.comments, { id: `c${Date.now()}`, x: 50, y: 8, text: note, author: personFor(p).name, role, date: TODAY_ISO, resolved: false }] : s.comments }), `requested a revision to ${sheet.code}`)
    toast({ title: 'Revision requested', body: 'The architect has been notified.', tone: 'info' })
    setRevModal(null); setNote('')
  }
  const issueRevision = () => {
    const next = String.fromCharCode(sheet.rev.charCodeAt(0) + 1)
    patch((s) => ({
      ...s, rev: next, date: TODAY_ISO, status: 'Awaiting client', notes: note || 'Revised per comments',
      revisions: [...s.revisions, { rev: next, date: TODAY_ISO, note: note || 'Revised per comments' }],
      comments: s.comments.map((c) => ({ ...c, resolved: true })),
    }), `issued ${sheet.code} Rev ${next} for client approval`)
    toast({ title: `Rev ${next} issued`, body: 'Sent to the client for approval.', tone: 'success' })
    setRevModal(null); setNote('')
  }

  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!commenting) return
    const r = e.currentTarget.getBoundingClientRect()
    setDraft({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, text: '' })
  }
  const saveComment = () => {
    if (!draft?.text.trim()) return
    patch((s) => ({ ...s, comments: [...s.comments, { id: `c${Date.now()}`, x: draft.x, y: draft.y, text: draft.text.trim(), author: personFor(p).name, role, date: TODAY_ISO, resolved: false }] }), `commented on ${sheet.code}`)
    setDraft(null); setCommenting(false)
  }

  const groups = Array.from(new Set(p.plans.map((s) => s.discipline)))

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit p-2">
        <p className="px-3 pb-1 pt-2 text-xs text-slate-500">{p.plans.length} sheets · {p.architect.org}</p>
        {groups.map((g) => (
          <div key={g} className="mt-2">
            <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g}</p>
            {p.plans.filter((s) => s.discipline === g).map((s) => (
              <button key={s.id} onClick={() => setSelected(s.id)} className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left cursor-pointer', s.id === sheet.id ? 'bg-accent-soft' : 'hover:bg-slate-50')}>
                <div className="h-10 w-14 shrink-0 overflow-hidden rounded border border-slate-200 bg-white"><Drawing kind={s.drawing} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-800">{s.code} · {s.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5"><span className="text-[11px] text-slate-500">Rev {s.rev}</span><Badge tone={STATUS_TONE[s.status]} className="!text-[10px] !px-1">{s.status}</Badge></div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </Card>

      <div className="min-w-0 space-y-4">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-display font-bold">{sheet.code} — {sheet.title}</p>
                <p className="text-xs text-slate-500">Rev {sheet.rev} · issued {date(sheet.date)} · {sheet.discipline}</p>
              </div>
              <Badge tone={STATUS_TONE[sheet.status]}>{sheet.status}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-200">
                <button className="p-2 text-slate-500 hover:text-slate-900 cursor-pointer" onClick={() => setZoom((z) => Math.max(1, z - 0.25))} aria-label="Zoom out"><Minus size={14} /></button>
                <span className="num w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
                <button className="p-2 text-slate-500 hover:text-slate-900 cursor-pointer" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))} aria-label="Zoom in"><Plus size={14} /></button>
                <button className="border-l border-slate-200 p-2 text-slate-500 hover:text-slate-900 cursor-pointer" onClick={() => setZoom(1)} aria-label="Reset zoom"><RotateCcw size={14} /></button>
              </div>
              {TOURABLE.includes(sheet.drawing) && <Link to="../tour"><Button size="sm" variant="secondary"><Box size={14} />Walk through in 3D</Button></Link>}
              <Button size="sm" variant={commenting ? 'primary' : 'secondary'} onClick={() => { setCommenting((c) => !c); setDraft(null) }}><MessageSquarePlus size={14} />{commenting ? 'Click on drawing…' : 'Comment'}</Button>
              {role === 'client' && sheet.status === 'Awaiting client' && <>
                <Button size="sm" variant="danger" onClick={() => setRevModal('request')}><X size={14} />Request changes</Button>
                <Button size="sm" variant="success" onClick={approve}><Check size={14} />Approve</Button>
              </>}
              {role === 'architect' && sheet.status !== 'Superseded' && <Button size="sm" variant="primary" onClick={() => setRevModal('issue')}><FileUp size={14} />Issue new revision</Button>}
            </div>
          </div>
          <div className="relative overflow-auto bg-slate-100 scroll-thin" style={{ maxHeight: 620 }}>
            <div className={clsx('relative mx-auto origin-top-left bg-white shadow-sm', commenting && 'cursor-crosshair')} style={{ width: `${zoom * 100}%`, aspectRatio: '800 / 540' }} onClick={onCanvasClick}>
              <Drawing kind={sheet.drawing} />
              {sheet.comments.map((c, i) => (
                <button key={c.id} onClick={(e) => { e.stopPropagation(); setActivePin(activePin === c.id ? null : c.id) }} className={clsx('absolute z-10 grid size-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-bl-none text-[11px] font-bold text-white shadow-lg ring-2 ring-white cursor-pointer', c.resolved ? 'bg-slate-400' : 'bg-brand !text-slate-900')} style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                  {i + 1}
                </button>
              ))}
              {activePin && (() => {
                const c = sheet.comments.find((x) => x.id === activePin)
                if (!c) return null
                return (
                  <div className="absolute z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl" style={{ left: `min(${c.x}%, calc(100% - 270px))`, top: `${c.y + 1}%` }} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2"><Avatar name={c.author} role={c.role} size={22} /><span className="text-xs font-semibold">{c.author}</span><RoleBadge role={c.role} /></div>
                    <p className="mt-2 text-sm text-slate-700">{c.text}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{relative(c.date)}{c.resolved && ' · resolved'}</p>
                  </div>
                )
              })()}
              {draft && (
                <div className="absolute z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl" style={{ left: `min(${draft.x}%, calc(100% - 270px))`, top: `${draft.y}%` }} onClick={(e) => e.stopPropagation()}>
                  <textarea autoFocus value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="Add a comment on this spot…" className={clsx(inputCls, 'min-h-16 text-xs')} />
                  <div className="mt-2 flex justify-end gap-1.5"><Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button><Button size="sm" variant="primary" onClick={saveComment}>Post</Button></div>
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-px border-t border-slate-200 bg-slate-200 text-xs sm:grid-cols-4">
            {[['Project', p.name], ['Architect', `${p.architect.name}`], ['Drawing', `${sheet.code} Rev ${sheet.rev}`], ['Scale / date', `1:100 · ${date(sheet.date)}`]].map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</p><p className="truncate font-medium text-slate-700">{v}</p></div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><History size={15} className="text-slate-400" />Revision history</p>
            <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
              {[...sheet.revisions].reverse().map((r, i) => (
                <li key={r.rev} className="relative">
                  <span className={clsx('absolute -left-[23px] top-0.5 grid size-4 place-items-center rounded-full text-[9px] font-bold', i === 0 ? 'bg-accent text-white' : 'bg-slate-200 text-slate-600')}>{r.rev}</span>
                  <p className="text-sm font-medium text-slate-800">Rev {r.rev} <span className="font-normal text-slate-400">· {date(r.date)}</span></p>
                  <p className="text-xs text-slate-500">{r.note}</p>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-4">
            <p className="text-sm font-semibold">Comments ({sheet.comments.length})</p>
            {sheet.comments.length === 0 && <p className="mt-2 text-sm text-slate-500">No comments yet. Click <b>Comment</b> and then a spot on the drawing to pin a question.</p>}
            <div className="mt-2 space-y-2.5">
              {sheet.comments.map((c, i) => (
                <button key={c.id} onClick={() => setActivePin(c.id)} className="flex w-full gap-2.5 rounded-lg p-1.5 text-left hover:bg-slate-50 cursor-pointer">
                  <span className={clsx('grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold', c.resolved ? 'bg-slate-200 text-slate-500' : 'bg-brand text-slate-900')}>{i + 1}</span>
                  <div className="min-w-0"><p className="text-xs"><b>{c.author}</b> <span className="text-slate-400">· {relative(c.date)}</span></p><p className={clsx('text-sm', c.resolved ? 'text-slate-400 line-through' : 'text-slate-700')}>{c.text}</p></div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={revModal != null} onClose={() => setRevModal(null)} title={revModal === 'issue' ? `Issue ${sheet.code} Rev ${String.fromCharCode(sheet.rev.charCodeAt(0) + 1)}` : `Request changes to ${sheet.code}`}
        subtitle={revModal === 'issue' ? 'The new revision goes to the client for approval. Open comments are marked resolved.' : 'Tell the architect what should change. Construction to this sheet is put on hold.'}
        footer={<><Button onClick={() => setRevModal(null)}>Cancel</Button><Button variant="primary" onClick={revModal === 'issue' ? issueRevision : requestRevision}>{revModal === 'issue' ? 'Issue revision' : 'Send request'}</Button></>}>
        <Field label={revModal === 'issue' ? 'Revision note' : 'What should change?'}>
          <textarea className={clsx(inputCls, 'min-h-28')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={revModal === 'issue' ? 'e.g. Bedroom 2 window widened to 6 ft per client comment' : 'e.g. Please move the pantry door to face the dining area'} autoFocus />
        </Field>
      </Modal>
    </div>
  )
}
