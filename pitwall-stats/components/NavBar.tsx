'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/app/context/AuthContext'

const BASE_NAV = [
  { href: '/elo',         label: 'Elo'           },
  { href: '/duels',       label: 'Teammate Duels' },
  { href: '/race-day',    label: 'Race Day'       },
  { href: '/what-if',     label: 'What-If'        },
  { href: '/drivers',     label: 'Drivers'        },
  { href: '/leaderboard', label: 'Rangliste'      },
]

export default function NavBar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { isLoggedIn, user, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    setIsMenuOpen(false)
    router.push('/')
  }

  const navLinks = isLoggedIn
    ? [...BASE_NAV, { href: '/predict', label: 'Tipps' }]
    : BASE_NAV

  return (
    <nav className="sticky top-0 z-50 bg-surface/90 backdrop-blur-sm border-b border-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setIsMenuOpen(false)}>
            <span className="text-xl font-black tracking-widest text-primary uppercase">
              BOXENFUNK
            </span>
            <span className="text-xs font-medium text-text-base tracking-widest uppercase border border-muted px-1.5 py-0.5">
              STATS
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium tracking-wide transition-colors rounded-sm whitespace-nowrap ${
                    isActive
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-text-secondary hover:text-text-base hover:bg-muted'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Right side: user + hamburger */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User pill / Login */}
            {isLoggedIn && user ? (
              <>
                <div
                  className="hidden sm:inline-flex"
                  style={{
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(56,189,248,0.08)',
                    border: '1px solid rgba(56,189,248,0.25)',
                    borderRadius: 999,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: '#38BDF8',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{user.username}</span>
                  <span style={{ color: '#475569' }}>·</span>
                  <span style={{ fontWeight: 700 }}>{user.punkte_total} Pkt</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="hidden sm:block px-3 py-1.5 text-xs font-bold tracking-widest uppercase border border-muted text-text-secondary hover:text-text-base hover:border-primary/40 transition-colors rounded-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs font-bold tracking-widest uppercase border border-primary/40 text-primary hover:bg-primary/10 transition-colors rounded-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
            )}

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setIsMenuOpen(v => !v)}
              className="lg:hidden flex items-center justify-center w-9 h-9 text-text-secondary hover:text-text-base transition-colors rounded-sm"
              aria-label="Menu"
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{isMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {isMenuOpen && (
        <div
          className="lg:hidden border-t border-muted"
          style={{ background: '#111827' }}
        >
          {/* Nav links */}
          <div className="px-4 py-3 flex flex-col">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-3 py-3 text-sm font-medium tracking-wide transition-colors rounded-sm border-b border-muted/40 last:border-0 ${
                    isActive
                      ? 'text-primary'
                      : 'text-text-secondary hover:text-text-base'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* User info + logout on mobile */}
          {isLoggedIn && user && (
            <div className="px-4 py-3 border-t border-muted flex items-center justify-between">
              <div style={{ fontSize: 13, color: '#94A3B8', fontFamily: 'monospace' }}>
                <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{user.username}</span>
                <span style={{ color: '#475569', margin: '0 6px' }}>·</span>
                <span style={{ color: '#38BDF8', fontWeight: 700 }}>{user.punkte_total} Pkt</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-bold tracking-widest uppercase border border-muted text-text-secondary hover:text-text-base hover:border-primary/40 transition-colors rounded-sm"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
