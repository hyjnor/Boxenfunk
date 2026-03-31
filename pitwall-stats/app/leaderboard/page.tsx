'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/app/context/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rang:     number
  username: string
  punkte:   number
  rennen:   number
}

export interface TipDetail {
  race_name:        string
  race_round:       number
  tipp_sieger:      string
  tipp_p2:          string
  tipp_p3:          string
  tipp_fastest_lap: string
  tipp_safety_car:  boolean
  sieger:           string | null
  p2:               string | null
  p3:               string | null
  fastest_lap:      string | null
  safety_car:       boolean | null
  punkte_sieger:    number
  punkte_podium:    number
  punkte_fastest:   number
  punkte_sc:        number
  punkte_total:     number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentSeason(): number {
  const now = new Date()
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear()
}

function match(tipp: string, actual: string | null) {
  if (!actual) return null
  return tipp?.toLowerCase() === actual?.toLowerCase()
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ height = 52 }: { height?: number }) {
  return (
    <div style={{
      background: 'linear-gradient(90deg, #111827 25%, #1E293B 50%, #111827 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      height,
      borderRadius: 2,
    }} />
  )
}

// ─── TipCell ──────────────────────────────────────────────────────────────────

function TipCell({ tipp, actual }: { tipp: string; actual: string | null }) {
  const ok = match(tipp, actual)
  const color = ok === true ? '#22C55E' : ok === false ? '#EF4444' : '#94A3B8'
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: 'monospace' }}>
      {tipp || '—'}
    </span>
  )
}

function ActualCell({ actual }: { actual: string | null }) {
  return (
    <span style={{ fontSize: 12, color: actual ? '#F1F5F9' : '#475569', fontFamily: 'monospace' }}>
      {actual || '?'}
    </span>
  )
}

// ─── ExpandedDetail ───────────────────────────────────────────────────────────

interface JolpicaRace {
  round:    string
  raceName: string
  date:     string
}

interface MergedRow {
  round:    number
  name:     string
  date:     string
  tip:      TipDetail | null
}

function ExpandedDetail({ username }: { username: string }) {
  const [rows,    setRows]    = useState<MergedRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const season = getCurrentSeason()
    const today  = new Date()

    Promise.all([
      fetch(`/api/season-races?season=${season}`)
        .then(r => r.json())
        .then((d): JolpicaRace[] => Array.isArray(d) ? d : [])
        .catch((): JolpicaRace[] => []),
      fetch(`/api/leaderboard/${encodeURIComponent(username)}`)
        .then(r => r.json())
        .then((d): TipDetail[] => Array.isArray(d) ? d : (d.tips ?? []))
        .catch((): TipDetail[] => []),
    ]).then(([races, tips]) => {
      const past = races.filter(r => new Date(r.date) <= today)
      const merged: MergedRow[] = past.map(r => ({
        round: parseInt(r.round),
        name:  r.raceName,
        date:  r.date,
        tip:   tips.find(t => t.race_round === parseInt(r.round)) ?? null,
      }))
      setRows(merged)
    }).finally(() => setLoading(false))
  }, [username])

  const COLS = '1fr 72px 72px 72px 52px 52px 52px'

  return (
    <div style={{ background: '#0A0E1A', borderTop: '1px solid #1E293B', padding: '16px 20px' }}>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} height={40} />)}
        </div>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: '#475569' }}>Noch keine Rennen in dieser Saison.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '4px 8px 8px', borderBottom: '1px solid #1E293B', marginBottom: 4 }}>
            {['Rennen', 'P1', 'P2', 'P3', 'FL', 'SC', 'Pkt'].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569' }}>
                {h}
              </span>
            ))}
          </div>

          {rows.map((row, i) => {
            const t = row.tip
            if (!t) {
              return (
                <div key={row.round} style={{
                  display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center',
                  padding: '8px 8px',
                  borderBottom: i < rows.length - 1 ? '1px solid rgba(30,41,59,0.4)' : 'none',
                  opacity: 0.45,
                }}>
                  <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>{row.name}</span>
                  <span style={{ fontSize: 11, color: '#475569', gridColumn: '2 / -1' }}>Nicht getippt</span>
                </div>
              )
            }

            // Normalise SC booleans — API may return strings "true"/"false"
            const tippSc   = t.tipp_safety_car === true || (t.tipp_safety_car as unknown) === 'true'
            const actualSc = t.safety_car      === true || (t.safety_car      as unknown) === 'true'
            const scKnown  = t.safety_car !== null && (t.safety_car as unknown) !== 'null'
            const scMatch  = scKnown && tippSc === actualSc
            const scColor  = !scKnown ? '#94A3B8' : scMatch ? '#22C55E' : '#EF4444'

            return (
              <div key={row.round} style={{
                display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center',
                padding: '8px 8px',
                borderBottom: i < rows.length - 1 ? '1px solid rgba(30,41,59,0.4)' : 'none',
              }}>
                {/* Race */}
                <span style={{ fontSize: 12, color: '#F1F5F9', fontWeight: 500 }}>{row.name}</span>
                {/* P1 */}
                <TipCell tipp={t.tipp_sieger}      actual={t.sieger}      />
                {/* P2 */}
                <TipCell tipp={t.tipp_p2}          actual={t.p2}          />
                {/* P3 */}
                <TipCell tipp={t.tipp_p3}          actual={t.p3}          />
                {/* FL */}
                <TipCell tipp={t.tipp_fastest_lap} actual={t.fastest_lap} />
                {/* SC — boolean: show ✓ / ✗ */}
                <span style={{ fontSize: 14, fontWeight: 700, color: scColor, textAlign: 'center' }}>
                  {!scKnown ? '?' : tippSc ? '✓' : '✗'}
                </span>
                {/* Points breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: Number(t.punkte_total) > 0 ? '#38BDF8' : '#475569', lineHeight: 1 }}>
                    {Number(t.punkte_total) > 0 ? `+${t.punkte_total}` : '—'}
                  </span>
                  {Number(t.punkte_sieger) > 0  && <span style={{ fontSize: 9, color: '#22C55E', lineHeight: 1.4 }}>Sieger +{t.punkte_sieger}</span>}
                  {Number(t.punkte_podium) > 0  && <span style={{ fontSize: 9, color: '#22C55E', lineHeight: 1.4 }}>Podium +{t.punkte_podium}</span>}
                  {Number(t.punkte_fastest) > 0 && <span style={{ fontSize: 9, color: '#22C55E', lineHeight: 1.4 }}>FL +{t.punkte_fastest}</span>}
                  {Number(t.punkte_sc) > 0      && <span style={{ fontSize: 9, color: '#22C55E', lineHeight: 1.4 }}>SC +{t.punkte_sc}</span>}
                </div>
              </div>
            )
          })}

          {/* Summary */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #1E293B', display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              {rows.filter(r => r.tip).length} / {rows.length} getippt
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8' }}>
              {rows.reduce((s, r) => s + Number(r.tip?.punkte_total ?? 0), 0)} Pkt total
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Medal colors ─────────────────────────────────────────────────────────────

const MEDAL: Record<number, { color: string; label: string }> = {
  1: { color: '#FFD700', label: '🥇' },
  2: { color: '#C0C0C0', label: '🥈' },
  3: { color: '#CD7F32', label: '🥉' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { user }    = useAuth()
  const [entries,   setEntries]   = useState<LeaderboardEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const season = getCurrentSeason()

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/leaderboard?season=${season}`, { signal: AbortSignal.timeout(8000) })
        const data = await res.json()
        if (!res.ok || data.error) {
          setError(data.error ?? 'Fehler beim Laden der Rangliste.')
          return
        }
        const list: LeaderboardEntry[] = (Array.isArray(data) ? data : (data.entries ?? [])).filter((e: LeaderboardEntry) => e.username)
        setEntries(list)
      } catch {
        setError('Verbindungsfehler. Bitte versuche es erneut.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function toggleExpand(username: string) {
    setExpanded(prev => prev === username ? null : username)
  }

  const GRID = '3rem 1fr 5rem 7rem 2rem'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes expand-in { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 800px; } }
        .expand-row { animation: expand-in 0.25s ease forwards; overflow: hidden; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', textTransform: 'uppercase', color: '#F1F5F9', margin: 0 }}>
          SAISON RANGLISTE <span style={{ color: '#38BDF8' }}>{season}</span>
        </h1>
        <p style={{ fontSize: 14, color: '#94A3B8', marginTop: 8 }}>
          Wer ist der beste F1-Tipp-König?
        </p>
      </div>

      {/* Table */}
      <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 4, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '10px 20px', borderBottom: '1px solid #1E293B', background: '#0A0E1A' }}>
          {['Rang', 'Benutzername', 'Punkte', 'Rennen', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748B' }}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#EF4444', fontSize: 14 }}>{error}</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🏁</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#94A3B8' }}>Noch keine Tipps abgegeben</p>
            <p style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>Sei der Erste — gib jetzt deinen Tipp ab!</p>
          </div>
        ) : (
          <div>
            {entries.map((entry, idx) => {
              const medal      = MEDAL[entry.rang]
              const isMe       = user?.username === entry.username
              const isTop3     = entry.rang <= 3
              const isExpanded = expanded === entry.username
              const rowColor   = isMe ? 'rgba(56,189,248,0.08)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'

              return (
                <div key={entry.username}>
                  {/* Main row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: GRID,
                      alignItems: 'center',
                      padding: '14px 20px',
                      borderBottom: isExpanded ? 'none' : '1px solid #1E293B',
                      background: isExpanded ? (isMe ? 'rgba(56,189,248,0.10)' : '#0F172A') : rowColor,
                      borderLeft: isMe ? '3px solid #38BDF8' : '3px solid transparent',
                      transition: 'background 0.15s',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleExpand(entry.username)}
                  >
                    {/* Rang */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {medal ? (
                        <span style={{ fontSize: 18 }}>{medal.label}</span>
                      ) : (
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#64748B' }}>
                          {entry.rang}
                        </span>
                      )}
                    </div>

                    {/* Username */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 14, fontWeight: isTop3 || isMe ? 700 : 500,
                        color: isMe ? '#38BDF8' : isTop3 ? (medal?.color ?? '#F1F5F9') : '#F1F5F9',
                      }}>
                        {entry.username}
                      </span>
                      {isMe && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#38BDF8', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '1px 6px', letterSpacing: '0.08em' }}>
                          DU
                        </span>
                      )}
                    </div>

                    {/* Punkte */}
                    <span style={{
                      fontSize: 15, fontWeight: 800,
                      color: isTop3 ? (medal?.color ?? '#38BDF8') : isMe ? '#38BDF8' : '#F1F5F9',
                    }}>
                      {entry.punkte}
                    </span>

                    {/* Rennen */}
                    <span style={{ fontSize: 13, color: '#64748B' }}>
                      {entry.rennen} Rennen
                    </span>

                    {/* Chevron */}
                    <span style={{
                      fontSize: 14,
                      color: '#475569',
                      transition: 'transform 0.2s',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block',
                      textAlign: 'center',
                      userSelect: 'none',
                    }}>
                      ▾
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div
                      className="expand-row"
                      style={{ borderBottom: '1px solid #1E293B' }}
                    >
                      <ExpandedDetail username={entry.username} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!loading && entries.length > 0 && (
        <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 16 }}>
          {entries.length} Teilnehmer · Saison {season} · Klicke auf eine Zeile für Details
        </p>
      )}
    </div>
  )
}
