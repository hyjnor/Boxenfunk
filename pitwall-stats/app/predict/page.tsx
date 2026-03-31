'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/context/AuthContext'
import { getTeamColor } from '@/app/components/HelmetAvatar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Driver {
  driverId: string
  code:     string
  name:     string
  team:     string
}

interface RaceInfo {
  raceName: string
  round:    string
  date:     string
  time:     string
}

interface ExistingTip {
  tipp_sieger:      string
  tipp_p2:          string
  tipp_p3:          string
  tipp_fastest_lap: string
  tipp_safety_car:  boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(raceDate: Date): string {
  const diff = raceDate.getTime() - Date.now()
  if (diff <= 0) return 'Gestartet'
  const totalSecs = Math.floor(diff / 1000)
  const days  = Math.floor(totalSecs / 86400)
  const hours = Math.floor((totalSecs % 86400) / 3600)
  const mins  = Math.floor((totalSecs % 3600) / 60)
  if (days >= 1)  return `${days}T ${hours}H`
  if (hours >= 1) return `${hours}H ${mins}M`
  return `${mins} Min`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function driverLabel(driverId: string, drivers: Driver[]): string {
  const d = drivers.find(d => d.driverId === driverId)
  return d ? `${d.code} — ${d.name}` : driverId
}

function driverTeam(driverId: string, drivers: Driver[]): string {
  return drivers.find(d => d.driverId === driverId)?.team ?? ''
}

// ─── DriverSelect ─────────────────────────────────────────────────────────────

function DriverSelect({
  label, value, onChange, drivers, exclude = [],
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
  drivers:  Driver[]
  exclude?: string[]
}) {
  const available = drivers.filter(d => !exclude.includes(d.driverId) || d.driverId === value)
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 6 }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', background: '#0A0E1A', border: '1px solid #1E293B', borderRadius: 2,
          padding: '10px 14px', fontSize: 14, color: value ? '#F1F5F9' : '#64748B', outline: 'none',
          cursor: 'pointer', boxSizing: 'border-box',
        }}
      >
        <option value="">— Fahrer wählen —</option>
        {available.map(d => (
          <option key={d.driverId} value={d.driverId}>
            {d.code}  {d.name}
          </option>
        ))}
      </select>
      {value && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: getTeamColor(available.find(d => d.driverId === value)?.team ?? '') }} />
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            {available.find(d => d.driverId === value)?.team}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

function SectionCard({ title, pts, children }: { title: string; pts: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 4, padding: 24, marginBottom: 16, borderLeft: '3px solid #38BDF8' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F1F5F9' }}>
          {title}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '2px 10px' }}>
          {pts}
        </span>
      </div>
      {children}
    </div>
  )
}

// ─── DriverBadge (read-only) ──────────────────────────────────────────────────

function DriverBadge({ driverId, drivers }: { driverId: string; drivers: Driver[] }) {
  const team = driverTeam(driverId, drivers)
  const label = driverLabel(driverId, drivers)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0A0E1A', border: '1px solid #334155', borderRadius: 2, padding: '8px 14px' }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: getTeamColor(team), flexShrink: 0 }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', fontFamily: 'monospace' }}>{label}</span>
    </div>
  )
}

// ─── ReadOnlyView — shows submitted tip ───────────────────────────────────────

function ReadOnlyView({ tip, race, drivers }: { tip: ExistingTip; race: RaceInfo; drivers: Driver[] }) {
  return (
    <div>
      {/* Confirmation banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 4, padding: '12px 16px', marginBottom: 24 }}>
        <span style={{ fontSize: 18 }}>✅</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#22C55E', margin: 0 }}>Tipp abgegeben!</p>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, marginTop: 2 }}>
            Du hast bereits einen Tipp für {race.raceName} abgegeben. Änderungen sind nicht mehr möglich.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 24, alignItems: 'start' }}>
        <div>
          {/* P1 */}
          <SectionCard title="Rennsieger" pts="+15 Pkt">
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }}>Dein Tipp P1</p>
            <DriverBadge driverId={tip.tipp_sieger} drivers={drivers} />
          </SectionCard>

          {/* P2 + P3 */}
          <SectionCard title="Podium P2 & P3" pts="+10 Pkt komplett / +3 Pkt einzeln">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }}>P2</p>
                <DriverBadge driverId={tip.tipp_p2} drivers={drivers} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }}>P3</p>
                <DriverBadge driverId={tip.tipp_p3} drivers={drivers} />
              </div>
            </div>
          </SectionCard>

          {/* Fastest Lap */}
          <SectionCard title="Fastest Lap" pts="+8 Pkt">
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }}>Dein Tipp</p>
            <DriverBadge driverId={tip.tipp_fastest_lap} drivers={drivers} />
          </SectionCard>

          {/* Safety Car */}
          <SectionCard title="Safety Car" pts="+5 Pkt">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 44, height: 24, borderRadius: 12,
                background: tip.tipp_safety_car ? '#38BDF8' : '#1E293B',
                border: `1px solid ${tip.tipp_safety_car ? '#38BDF8' : '#334155'}`,
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: 'white',
                  position: 'absolute', top: 2, left: tip.tipp_safety_car ? 22 : 2,
                }} />
              </div>
              <span style={{ fontSize: 14, color: tip.tipp_safety_car ? '#F1F5F9' : '#94A3B8', fontWeight: 500 }}>
                {tip.tipp_safety_car ? 'Ja — Safety Car erwartet' : 'Nein — kein Safety Car erwartet'}
              </span>
            </div>
          </SectionCard>
        </div>

        {/* Points sidebar */}
        <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 4, padding: 24, position: 'sticky', top: 80 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 16 }}>
            Mögliche Punkte
          </p>
          {[
            { label: 'Rennsieger',       pts: 15 },
            { label: 'Podium komplett',  pts: 10 },
            { label: 'Podium einzeln',   pts: '3 / Platz' },
            { label: 'Fastest Lap',      pts: 8  },
            { label: 'Safety Car',       pts: 5  },
          ].map(({ label, pts }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1E293B' }}>
              <span style={{ fontSize: 13, color: '#94A3B8' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8' }}>+{pts} Pkt</span>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: '12px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 2, textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Maximum</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#38BDF8' }}>38 Punkte</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PredictPage() {
  const router = useRouter()
  const { isLoggedIn, token } = useAuth()

  const [race,        setRace]        = useState<RaceInfo | null>(null)
  const [drivers,     setDrivers]     = useState<Driver[]>([])
  const [loading,     setLoading]     = useState(true)
  const [locked,      setLocked]      = useState(false)
  const [existingTip, setExistingTip] = useState<ExistingTip | null>(null)

  const [tippSieger,     setTippSieger]     = useState('')
  const [tippP2,         setTippP2]         = useState('')
  const [tippP3,         setTippP3]         = useState('')
  const [tippFastestLap, setTippFastestLap] = useState('')
  const [tippSafetyCar,  setTippSafetyCar]  = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [success,    setSuccess]    = useState('')
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!isLoggedIn) router.replace('/login')
  }, [isLoggedIn, router])

  useEffect(() => {
    if (!isLoggedIn) return
    async function load() {
      try {
        const [racesRes, standingsRes] = await Promise.all([
          fetch('https://api.jolpi.ca/ergast/f1/2026/races.json', { signal: AbortSignal.timeout(7000) }),
          fetch('https://api.jolpi.ca/ergast/f1/2026/driverStandings.json?limit=30', { signal: AbortSignal.timeout(7000) }),
        ])
        const racesJson    = await racesRes.json()
        const standingsJson = await standingsRes.json()

        const mrRaces     = racesJson?.data?.MRData    ?? racesJson?.MRData
        const mrStandings = standingsJson?.data?.MRData ?? standingsJson?.MRData

        const races: any[] = mrRaces?.RaceTable?.Races ?? []
        const now  = new Date()
        const next = races.find((r: any) => {
          const d = new Date(`${r.date}T${r.time ?? '12:00:00Z'}`)
          return d.getTime() > now.getTime() - 2 * 3_600_000
        })

        let nextRace: RaceInfo | null = null
        if (next) {
          nextRace = { raceName: next.raceName, round: next.round, date: next.date, time: next.time ?? '12:00:00Z' }
          setRace(nextRace)
          const raceStart = new Date(`${next.date}T${next.time ?? '12:00:00Z'}`)
          setLocked(raceStart.getTime() <= now.getTime())
        }

        const standings: any[] = mrStandings?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []
        setDrivers(standings.map((s: any) => ({
          driverId: s.Driver.driverId,
          code:     s.Driver.code ?? s.Driver.driverId.slice(0, 3).toUpperCase(),
          name:     `${s.Driver.givenName} ${s.Driver.familyName}`,
          team:     s.Constructors?.[0]?.name ?? '',
        })))

        // Check if user already tipped this race
        if (nextRace) {
          // 1. Check localStorage first (instant, works without n8n)
          try {
            const lsKey = `bf-tip-round-${nextRace.round}`
            const stored = localStorage.getItem(lsKey)
            if (stored) {
              setExistingTip(JSON.parse(stored))
            }
          } catch { /* ignore */ }

          // 2. Also check via API (catches tips submitted on other devices)
          try {
            const tipRes = await fetch(`/api/my-tip?race_id=${nextRace.round}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            })
            const tipData = await tipRes.json()
            if (tipData?.tip) {
              setExistingTip(tipData.tip)
              // Sync to localStorage so future loads are instant
              try { localStorage.setItem(`bf-tip-round-${nextRace.round}`, JSON.stringify(tipData.tip)) } catch { /* ignore */ }
            }
          } catch { /* n8n webhook not yet set up — localStorage check above is sufficient */ }
        }
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [isLoggedIn, token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!tippSieger)              { setError('Bitte einen Rennsieger auswählen.'); return }
    if (!tippP2 || !tippP3)       { setError('Bitte P2 und P3 auswählen.'); return }
    if (!tippFastestLap)          { setError('Bitte Fastest Lap auswählen.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          race_id:          race?.round,
          race_name:        race?.raceName,
          tipp_sieger:      tippSieger,
          tipp_p2:          tippP2,
          tipp_p3:          tippP3,
          tipp_fastest_lap: tippFastestLap,
          tipp_safety_car:  tippSafetyCar,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? data.message ?? 'Speichern fehlgeschlagen.')
      } else {
        setSuccess('Tipp gespeichert! Viel Glück 🏎️')
        const savedTip: ExistingTip = {
          tipp_sieger:      tippSieger,
          tipp_p2:          tippP2,
          tipp_p3:          tippP3,
          tipp_fastest_lap: tippFastestLap,
          tipp_safety_car:  tippSafetyCar,
        }
        // Persist to localStorage so re-loading the page blocks re-submission
        try { localStorage.setItem(`bf-tip-round-${race?.round}`, JSON.stringify(savedTip)) } catch { /* ignore */ }
        // Switch to read-only view
        setExistingTip(savedTip)
      }
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isLoggedIn) return null

  const raceDate = race ? new Date(`${race.date}T${race.time}`) : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 3, height: 24, background: '#38BDF8', borderRadius: 2 }} />
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', textTransform: 'uppercase', color: '#F1F5F9', margin: 0 }}>
            {loading ? 'Lade Renndaten…' : race ? `Deine Tipps für ${race.raceName}` : 'Kein Rennen gefunden'}
          </h1>
        </div>
        {race && raceDate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>{formatDate(race.date)}</span>
            {!locked && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '2px 10px' }}>
                Noch {formatCountdown(raceDate)}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#94A3B8', fontSize: 14 }}>Lade Daten…</div>
      ) : locked ? (
        existingTip ? (
          <ReadOnlyView tip={existingTip} race={race!} drivers={drivers} />
        ) : (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, padding: '20px 24px', color: '#EF4444', fontWeight: 600, fontSize: 15 }}>
            🔒 Tipps sind gesperrt — das Rennen hat bereits begonnen.
          </div>
        )
      ) : !race ? (
        <div style={{ color: '#94A3B8', fontSize: 14 }}>Kein bevorstehendes Rennen gefunden.</div>
      ) : existingTip ? (
        // Already tipped — show read-only
        <ReadOnlyView tip={existingTip} race={race} drivers={drivers} />
      ) : (
        // No tip yet — show form
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 24, alignItems: 'start' }}>
            <div>
              <SectionCard title="Rennsieger" pts="+15 Pkt">
                <DriverSelect label="P1 — Wer gewinnt das Rennen?" value={tippSieger} onChange={setTippSieger} drivers={drivers} />
              </SectionCard>

              <SectionCard title="Podium P2 & P3" pts="+10 Pkt komplett / +3 Pkt einzeln">
                <DriverSelect label="P2" value={tippP2} onChange={setTippP2} drivers={drivers} exclude={[tippSieger, tippP3]} />
                <DriverSelect label="P3" value={tippP3} onChange={setTippP3} drivers={drivers} exclude={[tippSieger, tippP2]} />
              </SectionCard>

              <SectionCard title="Fastest Lap" pts="+8 Pkt">
                <DriverSelect label="Wer fährt die schnellste Runde?" value={tippFastestLap} onChange={setTippFastestLap} drivers={drivers} />
              </SectionCard>

              <SectionCard title="Safety Car" pts="+5 Pkt">
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <div
                    onClick={() => setTippSafetyCar(v => !v)}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: tippSafetyCar ? '#38BDF8' : '#1E293B',
                      border: '1px solid', borderColor: tippSafetyCar ? '#38BDF8' : '#334155',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0, cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      position: 'absolute', top: 2, left: tippSafetyCar ? 22 : 2, transition: 'left 0.2s',
                    }} />
                  </div>
                  <span style={{ fontSize: 14, color: tippSafetyCar ? '#F1F5F9' : '#94A3B8', fontWeight: 500 }}>
                    Wird es einen Safety Car geben?
                  </span>
                </label>
              </SectionCard>

              {error && (
                <div style={{ fontSize: 13, color: '#EF4444', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 2, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ fontSize: 14, color: '#34d399', padding: '12px 16px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 2, marginBottom: 16, fontWeight: 600 }}>
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '13px 32px', background: submitting ? '#1E293B' : '#38BDF8',
                  color: submitting ? '#94A3B8' : '#0A0E1A', border: 'none', borderRadius: 2,
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
                }}
              >
                {submitting ? 'Wird gespeichert…' : 'Tipp abgeben →'}
              </button>
            </div>

            {/* Points sidebar */}
            <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 4, padding: 24, position: 'sticky', top: 80 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 16 }}>
                Mögliche Punkte
              </p>
              {[
                { label: 'Rennsieger',      pts: 15 },
                { label: 'Podium komplett', pts: 10 },
                { label: 'Podium einzeln',  pts: '3 / Platz' },
                { label: 'Fastest Lap',     pts: 8  },
                { label: 'Safety Car',      pts: 5  },
              ].map(({ label, pts }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1E293B' }}>
                  <span style={{ fontSize: 13, color: '#94A3B8' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8' }}>+{pts} Pkt</span>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: '12px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 2, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Maximum</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#38BDF8' }}>38 Punkte</p>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
