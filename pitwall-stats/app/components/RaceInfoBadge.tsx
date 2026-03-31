'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type RaceStatus = 'upcoming' | 'imminent' | 'live' | 'finished'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(raceDate: Date, nowMs: number): RaceStatus {
  const diff = raceDate.getTime() - nowMs
  if (diff > 3 * 86_400_000) return 'upcoming'
  if (diff > 0)              return 'imminent'
  if (diff > -2 * 3_600_000) return 'live'
  return 'finished'
}

function formatCountdown(raceDate: Date, nowMs: number): string {
  const diff      = raceDate.getTime() - nowMs
  if (diff <= 0) return ''
  const totalSecs = Math.floor(diff / 1000)
  const days      = Math.floor(totalSecs / 86400)
  const hours     = Math.floor((totalSecs % 86400) / 3600)
  const mins      = Math.floor((totalSecs % 3600) / 60)
  const secs      = totalSecs % 60
  if (days >= 1)  return `IN ${days}D ${hours}H`
  if (hours >= 1) return `IN ${hours}H ${mins}M`
  return `IN ${mins}M ${secs}S`
}

const DOT_COLOR: Record<RaceStatus, string> = {
  upcoming: '#38BDF8',
  imminent: '#F59E0B',
  live:     '#EF4444',
  finished: '#64748B',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RaceInfoBadge() {
  const [raceName,  setRaceName]  = useState<string | null>(null)
  const [raceDate,  setRaceDate]  = useState<Date | null>(null)
  const [status,    setStatus]    = useState<RaceStatus>('upcoming')
  const [countdown, setCountdown] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch next race ───────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchRace() {
      try {
        const res    = await fetch('https://api.jolpi.ca/ergast/f1/2026/races.json', { signal: AbortSignal.timeout(7000) })
        const json   = await res.json()
        const mrdata = json?.data?.MRData ?? json?.MRData
        const races: any[] = mrdata?.RaceTable?.Races ?? []
        const now    = new Date()
        const next   = races.find((r: any) => new Date(`${r.date}T${r.time ?? '00:00:00Z'}`) > now)
        if (!next) return
        setRaceName(next.raceName)
        setRaceDate(new Date(`${next.date}T${next.time ?? '00:00:00Z'}`))
      } catch { /* badge stays hidden */ }
    }
    fetchRace()
  }, [])

  // ── Ticker ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!raceDate) return
    function tick() {
      const now = Date.now()
      setStatus(getStatus(raceDate!, now))
      setCountdown(formatCountdown(raceDate!, now))
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [raceDate])

  if (!raceName) return null

  const isLive    = status === 'live'
  const isFinished = status === 'finished'
  const dotColor  = DOT_COLOR[status]

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '0.5px solid rgba(56,189,248,0.2)',
        borderRadius: 999,
        padding: '6px 14px',
        fontSize: 12,
        fontFamily: 'monospace',
        color: '#94A3B8',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Status dot */}
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          animation: isLive ? 'pulse 1s ease-in-out infinite' : 'none',
          display: 'inline-block',
        }}
      />

      {/* Race name */}
      <span style={{ color: '#F1F5F9', fontWeight: 500 }}>
        {raceName}
      </span>

      <span style={{ color: '#475569' }}>·</span>

      {/* Countdown or status */}
      {isLive ? (
        <span style={{ color: '#EF4444', fontWeight: 600 }}>LIVE</span>
      ) : isFinished ? (
        <span style={{ color: '#64748B' }}>FINISHED</span>
      ) : (
        <span style={{ color: dotColor }}>{countdown}</span>
      )}
    </div>
  )
}
