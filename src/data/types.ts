import type { Sector } from './estimator'

export type Role = 'client' | 'contractor' | 'architect'

export interface Person {
  name: string
  org: string
  role: Role
  phone: string
  credential?: string
}

export interface Phase {
  id: string
  name: string
  start: string
  end: string
  weight: number
  budget: number
  actual: number
  progress: number
  verifiedBy?: string
}

export interface DailyLog {
  id: string
  date: string
  author: string
  role: Role
  weather: 'Sunny' | 'Cloudy' | 'Light rain' | 'Heavy rain'
  workers: number
  title: string
  notes: string
  phaseId: string
  progressAfter: number
  photos: { caption: string; hue: number; kind: 'rebar' | 'slab' | 'wall' | 'roof' | 'site' | 'finish' }[]
  materials: { materialId: string; qty: number }[]
  acknowledgedBy: Role[]
}

export type PlanStatus = 'Approved' | 'Awaiting client' | 'Revision requested' | 'Superseded'

export interface PlanComment {
  id: string
  x: number
  y: number
  text: string
  author: string
  role: Role
  date: string
  resolved: boolean
}

export interface PlanSheet {
  id: string
  code: string
  title: string
  discipline: 'Architectural' | 'Structural' | 'MEP' | 'Landscape'
  rev: string
  date: string
  status: PlanStatus
  drawing: 'res-gf' | 'res-ff' | 'res-elev' | 'res-found' | 'res-roof' | 'res-elec' | 'com-typ' | 'com-elev' | 'com-site' | 'wh-plan' | 'wh-elev'
  notes: string
  revisions: { rev: string; date: string; note: string }[]
  comments: PlanComment[]
}

export interface BoqItem {
  materialId: string
  planned: number
  delivered: number
  used: number
  /** Rate agreed in the contract BOQ (LKR / unit). */
  contractRate: number
}

export type ChangeStatus = 'Pending client' | 'Approved' | 'Rejected'

export interface ChangeOrder {
  id: string
  code: string
  title: string
  reason: 'Client request' | 'Site condition' | 'Design change' | 'Regulatory' | 'Value engineering'
  description: string
  raisedBy: Role
  date: string
  amount: number
  days: number
  status: ChangeStatus
  decidedOn?: string
  lines: { item: string; amount: number }[]
}

export type PaymentStatus = 'Paid' | 'Invoiced' | 'Upcoming' | 'Retention'

export interface Milestone {
  id: string
  name: string
  pct: number
  amount: number
  due: string
  status: PaymentStatus
  paidOn?: string
  certifiedBy?: string
}

export type LedgerStatus = 'Verified' | 'Pending review' | 'Queried'

export interface LedgerEntry {
  id: string
  date: string
  category: string
  description: string
  vendor: string
  materialId?: string
  qty?: number
  unit?: string
  rate?: number
  amount: number
  postedBy: Role
  receipt: boolean
  status: LedgerStatus
  query?: string
}

export interface Message {
  id: string
  author: string
  role: Role
  date: string
  text: string
}

export interface Activity {
  id: string
  date: string
  role: Role
  actor: string
  text: string
  kind: 'log' | 'plan' | 'change' | 'payment' | 'ledger' | 'message' | 'phase'
}

export interface Project {
  id: string
  sector: Sector
  name: string
  type: string
  typeId: string
  location: string
  district: string
  area: number
  floors: number
  start: string
  end: string
  contractSum: number
  progress: number
  health: 'On track' | 'At risk' | 'Delayed' | 'Pre-construction'
  stage: string
  client: Person
  architect: Person
  contractor: Person
  cover: [string, string]
  phases: Phase[]
  logs: DailyLog[]
  plans: PlanSheet[]
  boq: BoqItem[]
  changes: ChangeOrder[]
  milestones: Milestone[]
  ledger: LedgerEntry[]
  messages: Message[]
  activity: Activity[]
  /** Monthly cumulative cost series: planned value, earned value, actual cost. */
  curve: { month: string; pv: number; ev: number | null; ac: number | null }[]
}
