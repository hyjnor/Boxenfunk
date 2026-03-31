'use client'

import { createContext, useContext, useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  user_id: string
  username: string
  punkte_total: number
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  isLoggedIn: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
})

const LS_TOKEN = 'bf-token'
const LS_USER  = 'bf-user'

function tryDecodeJwtExp(token: string): number | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    return JSON.parse(atob(part))?.exp ?? null
  } catch { return null }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user,  setUser]  = useState<AuthUser | null>(null)

  useEffect(() => {
    try {
      const t = localStorage.getItem(LS_TOKEN)
      const u = localStorage.getItem(LS_USER)
      if (!t || !u) return
      const exp = tryDecodeJwtExp(t)
      if (exp && exp * 1000 < Date.now()) {
        localStorage.removeItem(LS_TOKEN)
        localStorage.removeItem(LS_USER)
        return
      }
      setToken(t)
      setUser(JSON.parse(u))
    } catch { /* ignore */ }
  }, [])

  function login(t: string, u: AuthUser) {
    setToken(t)
    setUser(u)
    try {
      localStorage.setItem(LS_TOKEN, t)
      localStorage.setItem(LS_USER, JSON.stringify(u))
    } catch { /* ignore */ }
  }

  function logout() {
    setToken(null)
    setUser(null)
    try {
      localStorage.removeItem(LS_TOKEN)
      localStorage.removeItem(LS_USER)
    } catch { /* ignore */ }
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoggedIn: !!token && !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext)
}
