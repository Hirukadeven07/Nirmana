import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MATERIALS, MATERIAL_BY_ID, districtFactor } from '../data/materials'
import { SEED_PROJECTS } from '../data/projects'
import type { Activity, Person, Project, Role } from '../data/types'
import { TODAY_ISO } from '../lib/format'
import { clamp, gaussian, hashString } from '../lib/random'
import { useAuth } from './auth'

// Keyed on a hash of the seed so stored demo state resets whenever the seed data changes.
const STORE_KEY = `nirmana.projects.${hashString(JSON.stringify(SEED_PROJECTS)).toString(36)}`
const PREFS_KEY = 'nirmana.v1.prefs'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: the session still works in memory */
  }
}

/* ───────────────────────── Live prices ───────────────────────── */

export interface LivePrice {
  price: number
  open: number
  prev: number
  dir: -1 | 0 | 1
  at: number
  spark: number[]
}

interface PriceCtx {
  prices: Record<string, LivePrice>
  /** Live Colombo price. */
  priceOf: (id: string) => number
  /** Live price adjusted to the selected district. */
  localPrice: (id: string) => number
  district: string
  setDistrict: (d: string) => void
  lastTick: number
  paused: boolean
  setPaused: (v: boolean) => void
}

const PriceContext = createContext<PriceCtx | null>(null)

function initialPrices(): Record<string, LivePrice> {
  return Object.fromEntries(
    MATERIALS.map((m) => [m.id, { price: m.base, open: m.base, prev: m.base, dir: 0 as const, at: 0, spark: [m.base] }]),
  )
}

export function PriceProvider({ children }: { children: ReactNode }) {
  const prefs = load(PREFS_KEY, { district: 'Colombo' } as { district?: string })
  const [prices, setPrices] = useState(initialPrices)
  const [district, setDistrictState] = useState(prefs.district ?? 'Colombo')
  const [lastTick, setLastTick] = useState(Date.now())
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => {
      const now = Date.now()
      setPrices((cur) => {
        const next = { ...cur }
        // A handful of instruments update per tick, like a real quote feed.
        const movers = MATERIALS.filter((m) => m.category !== 'Labour' && Math.random() < 0.28)
        for (const m of movers) {
          const p = cur[m.id]!
          // Mean-reverting random walk around today's reference price (bounded ±4%).
          const pull = (m.base - p.price) / m.base
          const step = gaussian(Math.random) * m.vol * 0.12 + pull * 0.15
          const price = clamp(p.price * (1 + step), m.base * 0.96, m.base * 1.04)
          const rounded = m.base > 1000 ? Math.round(price) : Math.round(price * 100) / 100
          if (rounded === p.price) continue
          next[m.id] = { ...p, prev: p.price, price: rounded, dir: rounded > p.price ? 1 : -1, at: now, spark: [...p.spark.slice(-39), rounded] }
        }
        return next
      })
      setLastTick(now)
    }, 2600)
    return () => window.clearInterval(id)
  }, [paused])

  const setDistrict = useCallback((d: string) => {
    setDistrictState(d)
    save(PREFS_KEY, { ...load(PREFS_KEY, {}), district: d })
  }, [])

  const value = useMemo<PriceCtx>(() => {
    const f = districtFactor(district)
    return {
      prices,
      priceOf: (id) => prices[id]?.price ?? MATERIAL_BY_ID[id]?.base ?? 0,
      localPrice: (id) => (prices[id]?.price ?? MATERIAL_BY_ID[id]?.base ?? 0) * f,
      district, setDistrict, lastTick, paused, setPaused,
    }
  }, [prices, district, setDistrict, lastTick, paused])

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>
}

export function usePrices() {
  const ctx = useContext(PriceContext)
  if (!ctx) throw new Error('usePrices outside PriceProvider')
  return ctx
}

/* ───────────────────────── Projects & roles ───────────────────────── */

export interface Toast {
  id: number
  title: string
  body?: string
  tone: 'success' | 'info' | 'warning'
}

interface AppCtx {
  projects: Project[]
  /** The signed-in user's role. */
  role: Role
  getProject: (id: string) => Project | undefined
  /** Applies an immutable update and records an audit-trail entry. */
  update: (projectId: string, fn: (p: Project) => Project, activity?: { text: string; kind: Activity['kind'] }) => void
  personFor: (p: Project, role?: Role) => Person
  reset: () => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

const AppContext = createContext<AppCtx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => load(STORE_KEY, SEED_PROJECTS))
  const { user, person } = useAuth()
  const role: Role = user?.role ?? 'client'
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  useEffect(() => save(STORE_KEY, projects), [projects])

  // Drop demo state saved against older seed data.
  useEffect(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k !== STORE_KEY && (k.startsWith('nirmana.projects.') || /^nirmana\.v\d+\.projects$/.test(k)))
        .forEach((k) => localStorage.removeItem(k))
    } catch {
      /* storage unavailable */
    }
  }, [])

  // The signed-in user stands in for their own role on every project; the other parties come from project data.
  const personFor = useCallback((p: Project, r: Role = role) => {
    if (person && r === person.role) return person
    return r === 'client' ? p.client : r === 'architect' ? p.architect : p.contractor
  }, [role, person])

  const update = useCallback<AppCtx['update']>((projectId, fn, activity) => {
    setProjects((all) =>
      all.map((p) => {
        if (p.id !== projectId) return p
        let next = fn(p)
        if (activity) {
          const actor = personFor(p).name
          next = {
            ...next,
            activity: [{ id: `${p.id}-A${Date.now()}`, date: TODAY_ISO, role, actor, text: activity.text, kind: activity.kind }, ...next.activity],
          }
        }
        return next
      }),
    )
  }, [personFor, role])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastId.current
    setToasts((cur) => [...cur, { ...t, id }])
    window.setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 4200)
  }, [])

  const value = useMemo<AppCtx>(() => ({
    projects, role,
    getProject: (id) => projects.find((p) => p.id === id),
    update, personFor,
    reset: () => setProjects(SEED_PROJECTS),
    toasts, toast,
    dismiss: (id) => setToasts((cur) => cur.filter((x) => x.id !== id)),
  }), [projects, role, update, personFor, toasts, toast])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}

export const ROLE_META: Record<Role, { label: string; color: string; bg: string; description: string }> = {
  client: { label: 'Client', color: '#b45309', bg: '#fef3c7', description: 'Approves changes, plans & payments' },
  contractor: { label: 'Contractor', color: '#0369a1', bg: '#e0f2fe', description: 'Posts progress, costs & invoices' },
  architect: { label: 'Architect', color: '#7c3aed', bg: '#ede9fe', description: 'Issues plans, certifies work' },
}
