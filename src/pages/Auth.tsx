import clsx from 'clsx'
import { AlertCircle, ArrowRight, Building2, Eye, EyeOff, HardHat, Home, PencilRuler, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { Field, inputCls } from '../components/ui'
import type { Sector } from '../data/estimator'
import type { Role } from '../data/types'
import { DEMO_ACCOUNTS, useAuth } from '../store/auth'
import { ROLE_META } from '../store/store'

const ROLE_ICON = { client: UserRound, architect: PencilRuler, contractor: HardHat } satisfies Record<Role, unknown>
const ROLES: Role[] = ['client', 'architect', 'contractor']
const ORG_LABEL: Record<Role, string> = { client: 'Company (optional)', architect: 'Practice / firm', contractor: 'Construction company' }

function isRole(v: string | null): v is Role {
  return v === 'client' || v === 'architect' || v === 'contractor'
}

export default function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const { user, logIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const initialRole = params.get('role')
  const [role, setRole] = useState<Role>(isRole(initialRole) ? initialRole : 'client')
  const [sector, setSector] = useState<Sector>(params.get('sector') === 'commercial' ? 'commercial' : 'residential')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', org: '', phone: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.sector = sector
  }, [sector])

  // Where to go after signing in: the page the user was sent away from, or the chosen workspace.
  const from = (location.state as { from?: string } | null)?.from
  const destination = from ?? `/${sector}/dashboard`
  if (user) return <Navigate to={destination} replace />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'signup') {
      if (form.name.trim().length < 2) return setError('Enter your full name.')
      if (role !== 'client' && !form.org.trim()) return setError(`Enter your ${ORG_LABEL[role].toLowerCase()}.`)
      if (form.password.length < 8) return setError('Use a password of at least 8 characters.')
      if (form.password !== form.confirm) return setError('Passwords do not match.')
    }
    setBusy(true)
    const err = mode === 'login'
      ? await logIn(form.email, form.password, role)
      : await signUp({ name: form.name, email: form.email, password: form.password, role, org: form.org, phone: form.phone })
    setBusy(false)
    if (err) return setError(err)
    navigate(destination, { replace: true })
  }

  const meta = ROLE_META[role]
  const otherMode = mode === 'login' ? '/signup' : '/login'
  const query = `?role=${role}&sector=${sector}`

  return (
    <div className="grid min-h-full lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-ink text-white lg:block">
        <div className="absolute inset-0 blueprint-bg opacity-40" />
        <div className="absolute -top-40 right-[-20%] size-[560px] rounded-full bg-accent/30 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/"><Logo light /></Link>
          <div>
            <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight">One workspace.<br />Three perspectives.</h2>
            <p className="mt-4 max-w-md text-slate-300">Clients, architects and contractors each see the actions that are theirs to take, with every change recorded for all three.</p>
            <div className="mt-8 space-y-3">
              {ROLES.map((r) => {
                const Icon = ROLE_ICON[r]
                return (
                  <div key={r} className={clsx('flex items-center gap-3 rounded-xl p-3 ring-1 transition', r === role ? 'bg-white/10 ring-white/25' : 'ring-white/5')}>
                    <span className="grid size-9 place-items-center rounded-lg" style={{ background: ROLE_META[r].bg, color: ROLE_META[r].color }}><Icon size={17} /></span>
                    <span>
                      <span className="block text-sm font-semibold">{ROLE_META[r].label}</span>
                      <span className="block text-xs text-slate-400">{ROLE_META[r].description}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="text-xs text-slate-500">Accounts are stored in this browser for now.</p>
        </div>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center bg-white px-5 py-10 sm:px-8">
        <div className="w-full max-w-md rise">
          <Link to="/" className="lg:hidden"><Logo /></Link>
          <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-slate-900 lg:mt-0">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {mode === 'login' ? 'Log in as' : 'Sign up as'} a client, architect or contractor.
          </p>

          <div role="tablist" aria-label="Account type" className="mt-6 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1.5">
            {ROLES.map((r) => {
              const Icon = ROLE_ICON[r]
              const active = r === role
              return (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setRole(r); setError(null) }}
                  className={clsx('flex flex-col items-center gap-1 rounded-lg py-2.5 text-xs font-semibold transition cursor-pointer', active ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-800')}
                  style={active ? { color: ROLE_META[r].color } : undefined}
                >
                  <Icon size={18} />
                  {ROLE_META[r].label}
                </button>
              )
            })}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
            {mode === 'signup' && (
              <>
                <Field label="Full name"><input className={inputCls} value={form.name} onChange={set('name')} autoComplete="name" required /></Field>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label={ORG_LABEL[role]}><input className={inputCls} value={form.org} onChange={set('org')} autoComplete="organization" /></Field>
                  <Field label="Phone"><input className={inputCls} value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="+94 7X XXX XXXX" /></Field>
                </div>
              </>
            )}
            <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={set('email')} autoComplete="email" required /></Field>
            <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className={clsx(inputCls, 'pr-10')} value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-400 hover:text-slate-600 cursor-pointer" aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            {mode === 'signup' && (
              <Field label="Confirm password"><input type={showPw ? 'text' : 'password'} className={inputCls} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required /></Field>
            )}

            {!from && (
              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Open workspace</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['residential', 'commercial'] as Sector[]).map((s) => (
                    <button key={s} type="button" onClick={() => setSector(s)} className={clsx('flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition cursor-pointer', s === sector ? 'border-accent bg-accent-soft text-accent-strong' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                      {s === 'residential' ? <Home size={14} /> : <Building2 size={14} />}
                      {s === 'residential' ? 'Residential' : 'Commercial'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'login' && (
              <button type="button" onClick={() => setForm((f) => ({ ...f, email: DEMO_ACCOUNTS[role].email, password: DEMO_ACCOUNTS[role].password }))} className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 cursor-pointer">
                Demo {meta.label}: <b>{DEMO_ACCOUNTS[role].email}</b> / <b>{DEMO_ACCOUNTS[role].password}</b> — click to fill
              </button>
            )}

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />{error}
              </p>
            )}

            <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60 cursor-pointer" style={{ background: meta.color }}>
              {busy ? 'Please wait…' : `${mode === 'login' ? 'Log in' : 'Sign up'} as ${meta.label}`}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'login' ? 'New to Nirmana?' : 'Already have an account?'}{' '}
            <Link to={`${otherMode}${query}`} state={location.state} className="font-semibold text-accent hover:underline">
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
