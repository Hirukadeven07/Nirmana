// Sri Lankan rupee formatting. Large figures use the "Mn" / "Bn" notation common in local quotations.
const full = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 })
const two = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function rs(n: number, decimals = false): string {
  const sign = n < 0 ? '−' : ''
  return `${sign}Rs ${(decimals ? two : full).format(Math.abs(n))}`
}

export function rsCompact(n: number): string {
  const a = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (a >= 1e9) return `${sign}Rs ${(a / 1e9).toFixed(2)} Bn`
  if (a >= 1e6) return `${sign}Rs ${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)} Mn`
  if (a >= 1e5) return `${sign}Rs ${(a / 1e3).toFixed(0)}K`
  return `${sign}Rs ${full.format(a)}`
}

export function num(n: number, digits = 0): string {
  return new Intl.NumberFormat('en-LK', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)
}

export function pct(n: number, digits = 1, signed = false): string {
  const s = `${Math.abs(n).toFixed(digits)}%`
  if (!signed) return n < 0 ? `−${s}` : s
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function date(iso: string, withYear = true): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`
}

export function monthLabel(iso: string): string {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

export function relative(iso: string, now = TODAY): string {
  const days = Math.round((now.getTime() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 31) return `${Math.round(days / 7)} wk ago`
  return date(iso)
}

export function initials(name: string): string {
  return name
    .replace(/^(Dr\.|Mrs\.|Mr\.|Archt\.|Eng\.)\s*/i, '')
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

// The demo runs against a fixed "today" so seeded schedules stay coherent.
export const TODAY = new Date('2026-10-16T09:00:00+05:30')
export const TODAY_ISO = '2026-10-16'

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

/** Short chart-axis label: 1.2B, 45M, 800K. */
export function axisRs(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e9) return `${+(v / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${+(v / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`
  if (a >= 1e3) return `${+(v / 1e3).toFixed(0)}K`
  return String(Math.round(v))
}
