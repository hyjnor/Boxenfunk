'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/context/AuthContext'


// ─── Input ────────────────────────────────────────────────────────────────────

function Field({
  label, type = 'text', value, onChange, placeholder,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: '#0A0E1A',
          border: '1px solid #1E293B',
          borderRadius: 2,
          padding: '10px 14px',
          fontSize: 14,
          color: '#F1F5F9',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = '#38BDF8')}
        onBlur={e  => (e.currentTarget.style.borderColor = '#1E293B')}
      />
    </div>
  )
}

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm() {
  const { login } = useAuth()
  const router    = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? data.message ?? 'Login fehlgeschlagen.')
        return
      }
      login(data.token, {
        user_id:       data.user_id,
        username:      data.username,
        punkte_total:  data.punkte_total ?? 0,
      })
      router.push('/predict')
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="E-Mail" type="email" value={email} onChange={setEmail} placeholder="deine@email.com" />
      <Field label="Passwort" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
      {error && (
        <p style={{ fontSize: 13, color: '#EF4444', marginBottom: 16, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 2 }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%', padding: '12px', background: loading ? '#1E293B' : '#38BDF8',
          color: loading ? '#94A3B8' : '#0A0E1A', border: 'none', borderRadius: 2,
          fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
        }}
      >
        {loading ? 'Wird eingeloggt…' : 'Einloggen'}
      </button>
    </form>
  )
}

// ─── Register form ────────────────────────────────────────────────────────────

function RegisterForm() {
  const { login } = useAuth()
  const router    = useRouter()
  const [username,   setUsername]   = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [password2,  setPassword2]  = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6)          { setError('Passwort muss mindestens 6 Zeichen lang sein.'); return }
    if (password !== password2)        { setError('Passwörter stimmen nicht überein.'); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? data.message ?? 'Registrierung fehlgeschlagen.')
        return
      }
      login(data.token, {
        user_id:       data.user_id,
        username:      data.username,
        punkte_total:  data.punkte_total ?? 0,
      })
      router.push('/predict')
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Benutzername" value={username} onChange={setUsername} placeholder="DeinName" />
      <Field label="E-Mail" type="email" value={email} onChange={setEmail} placeholder="deine@email.com" />
      <Field label="Passwort" type="password" value={password} onChange={setPassword} placeholder="Min. 6 Zeichen" />
      <Field label="Passwort wiederholen" type="password" value={password2} onChange={setPassword2} placeholder="••••••••" />
      {error && (
        <p style={{ fontSize: 13, color: '#EF4444', marginBottom: 16, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 2 }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%', padding: '12px', background: loading ? '#1E293B' : '#38BDF8',
          color: loading ? '#94A3B8' : '#0A0E1A', border: 'none', borderRadius: 2,
          fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
        }}
      >
        {loading ? 'Wird registriert…' : 'Registrieren'}
      </button>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', textTransform: 'uppercase', color: '#F1F5F9', lineHeight: 1 }}>
          BOXEN<span style={{ color: '#38BDF8' }}>FUNK</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#94A3B8', textTransform: 'uppercase', marginTop: 4 }}>
          F1 Tipp-Spiel
        </div>
      </Link>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 420, background: '#111827', border: '1px solid #1E293B', borderRadius: 4, overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #1E293B' }}>
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '14px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: tab === t ? '#38BDF8' : '#94A3B8',
                borderBottom: tab === t ? '2px solid #38BDF8' : '2px solid transparent',
                transition: 'color 0.2s',
              }}
            >
              {t === 'login' ? 'Login' : 'Registrieren'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ padding: 28 }}>
          {tab === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: '#475569', textAlign: 'center' }}>
        {tab === 'login' ? (
          <>Noch kein Konto?{' '}
            <button onClick={() => setTab('register')} style={{ background: 'none', border: 'none', color: '#38BDF8', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Jetzt registrieren
            </button>
          </>
        ) : (
          <>Bereits registriert?{' '}
            <button onClick={() => setTab('login')} style={{ background: 'none', border: 'none', color: '#38BDF8', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Einloggen
            </button>
          </>
        )}
      </p>
    </div>
  )
}
