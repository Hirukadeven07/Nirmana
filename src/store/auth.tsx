import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Person, Role } from '../data/types'

/*
 * Accounts and the active session live in localStorage for now. Passwords are stored as salted
 * SHA-256 hashes, never in plain text. To move to a real backend, replace the functions in the
 * "Storage" block with API calls; the rest of the app only talks to `useAuth()`.
 */

const USERS_KEY = 'nirmana.v1.users'
const SESSION_KEY = 'nirmana.v1.session'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  org: string
  phone: string
  createdAt: string
}

interface StoredUser extends User {
  salt: string
  hash: string
}

/* ───────────────────────── Storage ───────────────────────── */

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? (JSON.parse(raw) as StoredUser[]) : []
  } catch {
    return []
  }
}

function writeUsers(users: StoredUser[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch {
    /* storage unavailable */
  }
}

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function writeSession(userId: string | null) {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable */
  }
}

async function hashPassword(password: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('')
}

function publicUser({ salt: _salt, hash: _hash, ...user }: StoredUser): User {
  return user
}

/* ───────────────────────── Context ───────────────────────── */

export interface SignUpInput {
  name: string
  email: string
  password: string
  role: Role
  org: string
  phone: string
}

interface AuthCtx {
  user: User | null
  /** Resolves to an error message, or null on success. */
  logIn: (email: string, password: string, role: Role) => Promise<string | null>
  signUp: (input: SignUpInput) => Promise<string | null>
  logOut: () => void
  /** The signed-in user in the shape project pages use for people. */
  person: Person | null
}

const AuthContext = createContext<AuthCtx | null>(null)

const normalise = (email: string) => email.trim().toLowerCase()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const id = readSession()
    const found = id ? readUsers().find((u) => u.id === id) : undefined
    return found ? publicUser(found) : null
  })

  // Keep tabs in sync when another tab logs in or out.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_KEY && e.key !== USERS_KEY) return
      const id = readSession()
      const found = id ? readUsers().find((u) => u.id === id) : undefined
      setUser(found ? publicUser(found) : null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const logIn = useCallback<AuthCtx['logIn']>(async (email, password, role) => {
    const found = readUsers().find((u) => u.email === normalise(email))
    if (!found || (await hashPassword(password, found.salt)) !== found.hash) return 'Incorrect email or password.'
    if (found.role !== role) {
      const label = found.role[0]!.toUpperCase() + found.role.slice(1)
      return `This account is registered as ${found.role === 'architect' ? 'an' : 'a'} ${label}. Choose "${label}" to log in.`
    }
    writeSession(found.id)
    setUser(publicUser(found))
    return null
  }, [])

  const signUp = useCallback<AuthCtx['signUp']>(async (input) => {
    const email = normalise(input.email)
    const users = readUsers()
    if (users.some((u) => u.email === email)) return 'An account with this email already exists.'
    const salt = randomId()
    const stored: StoredUser = {
      id: randomId(),
      name: input.name.trim(),
      email,
      role: input.role,
      org: input.org.trim(),
      phone: input.phone.trim(),
      createdAt: new Date().toISOString(),
      salt,
      hash: await hashPassword(input.password, salt),
    }
    writeUsers([...users, stored])
    writeSession(stored.id)
    setUser(publicUser(stored))
    return null
  }, [])

  const logOut = useCallback(() => {
    writeSession(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthCtx>(() => ({
    user, logIn, signUp, logOut,
    person: user ? { name: user.name, org: user.org || '—', role: user.role, phone: user.phone } : null,
  }), [user, logIn, signUp, logOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
