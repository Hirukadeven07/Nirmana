import { districtFactor, marketPriceAt } from '../data/materials'
import type { LedgerEntry, Project, Role } from '../data/types'
import { TODAY_ISO, daysBetween } from './format'
import { clamp } from './random'

export const RATE_TOLERANCE = 0.05

/** Ledger rate vs the market rate in the project's district for the month of purchase. */
export function rateVariance(e: LedgerEntry, district: string): number | null {
  if (!e.materialId || !e.rate) return null
  const market = marketPriceAt(e.materialId, e.date) * districtFactor(district)
  return market ? e.rate / market - 1 : null
}

export function projectMetrics(p: Project) {
  const costToDate = p.ledger.reduce((s, e) => s + e.amount, 0)
  const approvedChanges = p.changes.filter((c) => c.status === 'Approved').reduce((s, c) => s + c.amount, 0)
  const pendingChanges = p.changes.filter((c) => c.status === 'Pending client').reduce((s, c) => s + c.amount, 0)
  const revised = p.contractSum + approvedChanges
  const paid = p.milestones.filter((m) => m.status === 'Paid').reduce((s, m) => s + m.amount, 0)
  const invoiced = p.milestones.filter((m) => m.status === 'Invoiced').reduce((s, m) => s + m.amount, 0)
  const earned = revised * (p.progress / 100)
  const cpi = costToDate > 0 ? earned / costToDate : 1
  const eac = p.progress > 0 ? costToDate + (revised - earned) / clamp(cpi, 0.7, 1.3) : revised + pendingChanges
  const totalDays = daysBetween(p.start, p.end)
  const elapsed = clamp(daysBetween(p.start, TODAY_ISO) / totalDays, 0, 1)
  const pvToday = [...p.curve].reverse().find((c) => c.month <= TODAY_ISO)?.pv ?? 0
  const spi = pvToday > 0 ? (p.contractSum * (p.progress / 100)) / pvToday : 1
  const daysLeft = Math.max(0, daysBetween(TODAY_ISO, p.end))

  const priced = p.ledger.filter((e) => e.materialId)
  const flagged = priced.filter((e) => (rateVariance(e, p.district) ?? 0) > RATE_TOLERANCE)
  const receipts = p.ledger.length ? p.ledger.filter((e) => e.receipt).length / p.ledger.length : 1
  const verified = p.ledger.length ? p.ledger.filter((e) => e.status === 'Verified').length / p.ledger.length : 1
  const rateOk = priced.length ? 1 - flagged.length / priced.length : 1
  const recentLogs = p.logs.filter((l) => daysBetween(l.date, TODAY_ISO) <= 14).length
  const logScore = p.progress === 0 ? 1 : clamp(recentLogs / 4, 0, 1)
  const pendingApprovals = pendingItems(p, 'client').length
  const approvalScore = clamp(1 - pendingApprovals * 0.12, 0.4, 1)

  const transparency = Math.round(receipts * 25 + verified * 15 + rateOk * 30 + logScore * 15 + approvalScore * 15)

  return {
    costToDate, approvedChanges, pendingChanges, revised, paid, invoiced, earned, cpi, eac,
    variance: eac - revised, elapsed, spi, daysLeft, flagged, receipts, verified, rateOk, recentLogs, transparency,
  }
}

export type PendingItem = { kind: 'change' | 'plan' | 'payment' | 'log' | 'ledger' | 'phase'; id: string; title: string; detail: string; amount?: number; date: string }

/** Items waiting on a given role — the heart of the shared approvals inbox. */
export function pendingItems(p: Project, role: Role): PendingItem[] {
  const out: PendingItem[] = []
  if (role === 'client') {
    p.changes.filter((c) => c.status === 'Pending client').forEach((c) => out.push({ kind: 'change', id: c.id, title: `${c.code} · ${c.title}`, detail: c.reason, amount: c.amount, date: c.date }))
    p.plans.filter((s) => s.status === 'Awaiting client').forEach((s) => out.push({ kind: 'plan', id: s.id, title: `${s.code} ${s.title} (Rev ${s.rev})`, detail: s.discipline, date: s.date }))
    p.milestones.filter((m) => m.status === 'Invoiced').forEach((m) => out.push({ kind: 'payment', id: m.id, title: m.name, detail: `Certified by ${m.certifiedBy ?? 'architect'}`, amount: m.amount, date: m.due }))
  }
  if (role === 'architect') {
    p.logs.filter((l) => !l.acknowledgedBy.includes('architect')).forEach((l) => out.push({ kind: 'log', id: l.id, title: l.title, detail: 'Daily log to review', date: l.date }))
    p.milestones.filter((ms) => ms.status === 'Invoiced' && !ms.certifiedBy).forEach((ms) => out.push({ kind: 'payment', id: ms.id, title: `Certify invoice: ${ms.name}`, detail: 'Contractor invoice awaiting payment certificate', amount: ms.amount, date: ms.due }))
    p.phases.filter((ph) => ph.progress === 100 && !ph.verifiedBy).forEach((ph) => out.push({ kind: 'phase', id: ph.id, title: `Certify: ${ph.name}`, detail: 'Phase reported complete by contractor', date: ph.end }))
    p.plans.filter((s) => s.status === 'Revision requested').forEach((s) => out.push({ kind: 'plan', id: s.id, title: `${s.code} ${s.title}`, detail: 'Client requested a revision', date: s.date }))
  }
  if (role === 'contractor') {
    p.ledger.filter((e) => e.status === 'Queried').forEach((e) => out.push({ kind: 'ledger', id: e.id, title: e.description, detail: e.query ?? 'Client query', amount: e.amount, date: e.date }))
    p.changes.filter((c) => c.status === 'Rejected' && c.raisedBy === 'contractor').forEach((c) => out.push({ kind: 'change', id: c.id, title: `${c.code} · ${c.title}`, detail: 'Rejected by client — revise or withdraw', amount: c.amount, date: c.date }))
  }
  return out
}

export const PENDING_TAB: Record<PendingItem['kind'], string> = {
  change: 'changes', plan: 'plans', payment: 'payments', log: 'progress', ledger: 'ledger', phase: 'schedule',
}

export const HEALTH_STYLE: Record<Project['health'], { fg: string; bg: string; dot: string }> = {
  'On track': { fg: '#047857', bg: '#ecfdf5', dot: '#10b981' },
  'At risk': { fg: '#b45309', bg: '#fffbeb', dot: '#f59e0b' },
  Delayed: { fg: '#b91c1c', bg: '#fef2f2', dot: '#ef4444' },
  'Pre-construction': { fg: '#475569', bg: '#f1f5f9', dot: '#94a3b8' },
}

/** The phase currently being worked on: the first one not yet complete. */
export function currentStage(p: Project): string {
  if (p.progress === 0) return 'Design & approvals'
  if (p.progress >= 100) return 'Handover & defects liability'
  return p.phases.find((ph) => ph.progress < 100)?.name ?? p.phases[p.phases.length - 1]!.name
}
