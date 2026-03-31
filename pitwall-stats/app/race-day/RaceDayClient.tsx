'use client'

import { useState, useEffect, useRef } from 'react'
import type { RaceInfo, DriverOption } from './page'

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAM_COLORS: Record<string, string> = {
  red_bull:     '#3671C6',
  ferrari:      '#E8002D',
  mercedes:     '#27F4D2',
  mclaren:      '#FF8000',
  aston_martin: '#229971',
  alpine:       '#FF87BC',
  williams:     '#64C4FF',
  rb:           '#6692FF',
  sauber:       '#52E252',
  haas:         '#B6BABD',
}

// Map constructor IDs returned by Jolpica
const CONSTRUCTOR_ID_MAP: Record<string, string> = {
  'red_bull':     'red_bull',
  'ferrari':      'ferrari',
  'mercedes':     'mercedes',
  'mclaren':      'mclaren',
  'aston_martin': 'aston_martin',
  'alpine':       'alpine',
  'williams':     'williams',
  'rb':           'rb',
  'sauber':       'sauber',
  'haas':         'haas',
}

const FLAG_EMOJI: Record<string, string> = {
  Bahrain: '🇧🇭', 'Saudi Arabia': '🇸🇦', Australia: '🇦🇺', Japan: '🇯🇵',
  China: '🇨🇳', USA: '🇺🇸', Italy: '🇮🇹', Monaco: '🇲🇨', Canada: '🇨🇦',
  Spain: '🇪🇸', Austria: '🇦🇹', UK: '🇬🇧', Hungary: '🇭🇺', Belgium: '🇧🇪',
  Netherlands: '🇳🇱', Singapore: '🇸🇬', Mexico: '🇲🇽', Brazil: '🇧🇷',
  'United States': '🇺🇸', Qatar: '🇶🇦', Azerbaijan: '🇦🇿', 'Abu Dhabi': '🇦🇪',
}

const BINGO_POOL = [
  'Safety Car', 'Virtual Safety Car', 'Rain during race', 'Pit stop < 2.5s',
  'DNF top 5', 'Radio drama', 'Fastest lap change', 'Bottas points',
  'DRS train', 'Track limits warning', 'Strategy masterclass', 'Undercut works',
  'Overcut works', 'Penalty given', 'New lap record', 'Verstappen wins',
  'Leclerc on podium', 'Hamilton top 5', 'Norris fastest lap', 'Russell podium',
  'Red flag', 'Restart after SC', 'Pit stop mistake', 'Wrong tyre choice',
  'Overtake into Turn 1', 'Wheel to wheel battle', 'Team orders',
  'Driver complaint on radio', 'Puncture', 'Contact between teammates',
  'Stewards investigation', '5 second penalty', 'Drive through penalty',
  'Safety car restart chaos', 'Lap 1 incident', 'Pit lane speeding',
  'Car breakdown', 'Dramatic last lap', 'Photo finish', 'Crowd goes wild',
]

const BINGO_LINES = [
  [0, 1, 2, 3],   [4, 5, 6, 7],   [8, 9, 10, 11],  [12, 13, 14, 15],
  [0, 4, 8, 12],  [1, 5, 9, 13],  [2, 6, 10, 14],  [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12],
]

function shuffleTiles(): string[] {
  const pool = [...BINGO_POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 16)
}

const LS_PREDICTION_KEY = 'pitwall-prediction-v1'
const LS_BINGO_KEY      = 'pitwall-bingo-v1'

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcTimeLeft(targetISO: string) {
  const diff = new Date(targetISO).getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  }
}

function pad(n: number) { return String(n).padStart(2, '0') }

function getCompletedLines(checked: Set<number>): number[][] {
  return BINGO_LINES.filter((line) => line.every((i) => checked.has(i)))
}

// ── Live badge ────────────────────────────────────────────────────────────────

function LiveBadge({ status }: { status: 'loading' | 'live' | 'fallback' | 'error' }) {
  const cfg = {
    loading:  { color: '#94A3B8', dot: '#94A3B8', label: 'LOADING...' },
    live:     { color: '#34d399', dot: '#34d399', label: 'LIVE DATA' },
    fallback: { color: '#94A3B8', dot: '#94A3B8', label: 'FALLBACK DATA' },
    error:    { color: '#f87171', dot: '#f87171', label: 'ERROR' },
  }[status]
  return (
    <span
      className="flex items-center gap-1.5 text-xs font-bold tracking-widest px-2.5 py-1 rounded-sm border shrink-0"
      style={{ color: cfg.color, borderColor: `${cfg.dot}40`, background: `${cfg.dot}10` }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-sm ${className}`}
      style={{ background: 'linear-gradient(90deg, #111827 25%, #1E293B 50%, #111827 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}
    />
  )
}

// ── Section 1: Countdown ──────────────────────────────────────────────────────

function CountdownSection({ race, status, onRetry }: {
  race: RaceInfo | null
  status: 'loading' | 'live' | 'fallback' | 'error'
  onRetry: () => void
}) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [isPast, setIsPast] = useState(false)

  useEffect(() => {
    if (!race) return
    setTimeLeft(calcTimeLeft(race.dateTimeISO))
    setIsPast(false)
    const id = setInterval(() => {
      const tl = calcTimeLeft(race.dateTimeISO)
      setTimeLeft(tl)
      if (!tl.days && !tl.hours && !tl.minutes && !tl.seconds) {
        setIsPast(true)
        clearInterval(id)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [race?.dateTimeISO])

  const flag = race ? (FLAG_EMOJI[race.country] ?? '🏁') : '🏁'
  const raceDate = race
    ? new Date(race.dateTimeISO).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''
  const raceTime = race
    ? new Date(race.dateTimeISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
    : ''

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-[#38BDF8] rounded-full" />
          <h2 className="text-xl font-black tracking-tight text-[#F1F5F9] uppercase">Next Race Countdown</h2>
        </div>
        <LiveBadge status={status} />
      </div>

      {status === 'error' ? (
        <div className="bg-[#111827] border border-[#1E293B] rounded-sm p-8 text-center">
          <p className="text-[#94A3B8] mb-4">Could not load race data.</p>
          <button
            onClick={onRetry}
            className="px-5 py-2 text-sm font-bold tracking-wide rounded-sm"
            style={{ background: '#38BDF8', color: '#0A0E1A' }}
          >
            Retry
          </button>
        </div>
      ) : status === 'loading' ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Skeleton className="lg:col-span-2 h-52" />
          <Skeleton className="lg:col-span-3 h-52" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div
            className="lg:col-span-2 bg-[#111827] border border-[#1E293B] rounded-sm p-6 relative overflow-hidden"
            style={{ borderLeft: '4px solid #38BDF8' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-10">
              <div className="absolute top-4 right-4 w-16 h-16 border border-[#38BDF8] rotate-45" />
              <div className="absolute top-8 right-8 w-8 h-8 border border-[#38BDF8] rotate-45" />
            </div>
            <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-1">Round {race?.round}</p>
            <div className="flex items-start gap-2 mb-4">
              <span className="text-3xl">{flag}</span>
              <div>
                <h3 className="text-xl font-black text-[#F1F5F9] leading-tight">{race?.raceName}</h3>
                <p className="text-sm text-[#94A3B8] mt-0.5">{race?.country}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {[race?.circuitName, `${race?.locality}, ${race?.country}`, raceDate, raceTime].map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[#38BDF8] text-xs">◈</span>
                  <span className="text-[#94A3B8]">{line}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 bg-[#111827] border border-[#1E293B] rounded-sm p-6 flex flex-col justify-center">
            {isPast ? (
              <div className="text-center">
                <p className="text-4xl font-black text-[#38BDF8] mb-2">RACE IS ON</p>
                <p className="text-[#94A3B8] text-sm">Lights out and away we go!</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-5 text-center">Race starts in</p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'DAYS',    value: timeLeft.days },
                    { label: 'HOURS',   value: timeLeft.hours },
                    { label: 'MINUTES', value: timeLeft.minutes },
                    { label: 'SECONDS', value: timeLeft.seconds },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center">
                      <div
                        className="w-full aspect-square flex items-center justify-center rounded-sm border border-[#1E293B] bg-[#0A0E1A] relative overflow-hidden"
                        style={{ minHeight: 72 }}
                      >
                        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.08) 0%, transparent 70%)' }} />
                        <span className="text-3xl sm:text-4xl font-black tabular-nums text-[#38BDF8] relative z-10">{pad(value)}</span>
                      </div>
                      <span className="text-[9px] font-bold tracking-widest text-[#94A3B8] mt-2">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-[#1E293B] mt-5 select-none">── lights out ──</p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Section 2: Pre-Race Predictions ──────────────────────────────────────────

const POSITIONS = ['P1', 'P2', 'P3', 'P4', 'P5'] as const

function PredictionsSection({ drivers, raceName, status, onRetry }: {
  drivers: DriverOption[]
  raceName: string
  status: 'loading' | 'live' | 'fallback' | 'error'
  onRetry: () => void
}) {
  const [prediction, setPrediction] = useState<(string | null)[]>([null, null, null, null, null])
  const [locked, setLocked] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dragCode, setDragCode] = useState<string | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    try {
      const raw = localStorage.getItem(LS_PREDICTION_KEY)
      if (raw) {
        const { prediction: saved, locked: savedLocked } = JSON.parse(raw)
        if (Array.isArray(saved) && saved.length === 5) {
          setPrediction(saved)
          setLocked(!!savedLocked)
        }
      }
    } catch { /* ignore */ }
  }, [])

  const driverMap = Object.fromEntries(drivers.map((d) => [d.code, d]))

  function handleDriverClick(code: string) {
    if (locked) return
    const idx = prediction.indexOf(code)
    if (idx !== -1) {
      const next = [...prediction]; next[idx] = null; setPrediction(next)
    } else {
      const empty = prediction.indexOf(null)
      if (empty !== -1) { const next = [...prediction]; next[empty] = code; setPrediction(next) }
    }
  }

  function handleSlotClick(slotIdx: number) {
    if (locked || !prediction[slotIdx]) return
    const next = [...prediction]; next[slotIdx] = null; setPrediction(next)
  }

  function handleDrop(slotIdx: number) {
    if (!dragCode || locked) return
    const next = [...prediction]
    const existing = next.indexOf(dragCode)
    if (existing !== -1) next[existing] = null
    next[slotIdx] = dragCode
    setPrediction(next); setDragCode(null); setDragOverSlot(null)
  }

  function handleLock() {
    if (prediction.some((p) => p === null)) return
    try { localStorage.setItem(LS_PREDICTION_KEY, JSON.stringify({ prediction, locked: true })) } catch { /* ignore */ }
    setLocked(true)
  }

  function handleReset() {
    try { localStorage.removeItem(LS_PREDICTION_KEY) } catch { /* ignore */ }
    setPrediction([null, null, null, null, null]); setLocked(false)
  }

  function handleCopy() {
    const lines = prediction.map((code, i) => `${i + 1}. ${driverMap[code ?? '']?.name ?? code ?? '?'}`).join(' ')
    const text = `My #F1 prediction for ${raceName}: ${lines} — via boxenfunk.com`
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const shareText = prediction.map((code, i) => `${i + 1}. ${driverMap[code ?? '']?.name ?? code ?? '?'}`).join(' · ')
  const allFilled = prediction.every((p) => p !== null)
  const emptyCount = prediction.filter((p) => p === null).length

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-[#38BDF8] rounded-full" />
          <h2 className="text-xl font-black tracking-tight text-[#F1F5F9] uppercase">Pre-Race Predictions</h2>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge status={status} />
          {locked && (
            <button
              onClick={handleReset}
              className="text-xs font-bold tracking-widest uppercase px-3 py-1.5 border border-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#38BDF8]/40 transition-colors rounded-sm"
            >
              Edit prediction
            </button>
          )}
        </div>
      </div>

      {status === 'error' ? (
        <div className="bg-[#111827] border border-[#1E293B] rounded-sm p-8 text-center">
          <p className="text-[#94A3B8] mb-4">Could not load standings.</p>
          <button onClick={onRetry} className="px-5 py-2 text-sm font-bold tracking-wide rounded-sm" style={{ background: '#38BDF8', color: '#0A0E1A' }}>Retry</button>
        </div>
      ) : status === 'loading' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Driver list */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-sm p-5">
            <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-4">
              Top 10 Drivers — click or drag to predict
            </p>
            <div className="space-y-1.5">
              {drivers.map((d) => {
                const inSlot = prediction.indexOf(d.code)
                const inPrediction = inSlot !== -1
                const color = TEAM_COLORS[d.teamId] ?? '#38BDF8'
                return (
                  <div
                    key={d.code}
                    draggable={!locked}
                    onDragStart={() => setDragCode(d.code)}
                    onDragEnd={() => setDragCode(null)}
                    onClick={() => handleDriverClick(d.code)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-sm border transition-all select-none"
                    style={{
                      borderColor: inPrediction ? `${color}60` : '#1E293B',
                      background:  inPrediction ? `${color}12` : 'transparent',
                      cursor: locked ? 'default' : 'grab',
                      opacity: locked && !inPrediction ? 0.4 : 1,
                    }}
                  >
                    <span className="text-xs font-black tracking-wider px-1.5 py-0.5 rounded-sm shrink-0" style={{ color, background: `${color}20` }}>{d.code}</span>
                    <span className="text-sm font-medium text-[#F1F5F9] flex-1">{d.name}</span>
                    <span className="text-xs text-[#94A3B8] hidden sm:block">{d.team}</span>
                    {inPrediction && <span className="text-xs font-black ml-1 shrink-0" style={{ color: '#38BDF8' }}>P{inSlot + 1}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Prediction slots */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-sm p-5 flex flex-col">
            <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-4">Your predicted top 5</p>
            <div className="space-y-2 flex-1">
              {POSITIONS.map((pos, idx) => {
                const code = prediction[idx]
                const driver = code ? driverMap[code] : null
                const color = driver ? (TEAM_COLORS[driver.teamId] ?? '#38BDF8') : '#1E293B'
                const isOver = dragOverSlot === idx
                return (
                  <div
                    key={pos}
                    onDragOver={(e) => { e.preventDefault(); setDragOverSlot(idx) }}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={() => handleDrop(idx)}
                    onClick={() => handleSlotClick(idx)}
                    className="flex items-center gap-3 px-3 py-3 rounded-sm border transition-all"
                    style={{
                      borderColor: isOver ? '#38BDF8' : driver ? `${color}50` : '#1E293B',
                      background:  isOver ? 'rgba(56,189,248,0.08)' : driver ? `${color}10` : '#0A0E1A',
                      cursor: driver && !locked ? 'pointer' : 'default',
                      minHeight: 52,
                    }}
                  >
                    <span className="text-sm font-black w-8 shrink-0 text-right" style={{ color: driver ? '#38BDF8' : '#1E293B' }}>{pos}</span>
                    {driver ? (
                      <>
                        <span className="text-xs font-black tracking-wider px-1.5 py-0.5 rounded-sm shrink-0" style={{ color, background: `${color}20` }}>{driver.code}</span>
                        <span className="text-sm font-semibold text-[#F1F5F9] flex-1">{driver.name}</span>
                        {!locked && <span className="text-xs text-[#1E293B] hover:text-red-400 transition-colors shrink-0">✕</span>}
                      </>
                    ) : (
                      <span className="text-sm text-[#1E293B] italic">{isOver ? 'Drop here' : 'Empty — pick a driver'}</span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-5 pt-5 border-t border-[#1E293B]">
              {locked ? (
                <div className="space-y-3">
                  <div className="bg-[#0A0E1A] border border-[#1E293B] rounded-sm px-3 py-2.5">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#94A3B8] mb-1">Share text</p>
                    <p className="text-xs text-[#F1F5F9] leading-relaxed">
                      My #F1 prediction for {raceName}: <span className="text-[#38BDF8]">{shareText}</span> — via boxenfunk.com
                    </p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="w-full py-2.5 text-sm font-bold tracking-wide rounded-sm border transition-all"
                    style={{
                      borderColor: copied ? '#34d399' : '#38BDF8',
                      color:       copied ? '#34d399' : '#38BDF8',
                      background:  copied ? 'rgba(52,211,153,0.08)' : 'rgba(56,189,248,0.06)',
                    }}
                  >
                    {copied ? '✓ Copied!' : 'Copy share text'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLock}
                  disabled={!allFilled}
                  className="w-full py-3 text-sm font-black tracking-widest uppercase rounded-sm transition-all"
                  style={{
                    background: allFilled ? '#38BDF8' : '#1E293B',
                    color: allFilled ? '#0A0E1A' : '#94A3B8',
                    cursor: allFilled ? 'pointer' : 'not-allowed',
                  }}
                >
                  {allFilled ? 'Lock in prediction →' : `Pick ${emptyCount} more driver${emptyCount !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ── Section 3: F1 Bingo ───────────────────────────────────────────────────────

function BingoSection() {
  const [tiles, setTiles] = useState<string[]>(() => shuffleTiles())
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [completedLines, setCompletedLines] = useState<number[][]>([])
  const [showBingo, setShowBingo] = useState(false)
  const [bingoSeen, setBingoSeen] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    try {
      const raw = localStorage.getItem(LS_BINGO_KEY)
      if (raw) {
        const saved: number[] = JSON.parse(raw)
        if (Array.isArray(saved)) {
          const s = new Set<number>(saved)
          setChecked(s)
          const lines = getCompletedLines(s)
          setCompletedLines(lines)
          if (lines.length > 0) setBingoSeen(true)
        }
      }
    } catch { /* ignore */ }
  }, [])

  function toggleTile(idx: number) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      const lines = getCompletedLines(next)
      setCompletedLines(lines)
      if (lines.length > completedLines.length && !bingoSeen) {
        setShowBingo(true); setBingoSeen(true)
        setTimeout(() => setShowBingo(false), 3500)
      }
      try { localStorage.setItem(LS_BINGO_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  function handleShuffle() {
    setTiles(shuffleTiles())
    setChecked(new Set()); setCompletedLines([]); setShowBingo(false); setBingoSeen(false)
    try { localStorage.removeItem(LS_BINGO_KEY) } catch { /* ignore */ }
  }

  function handleResetMarks() {
    setChecked(new Set()); setCompletedLines([]); setShowBingo(false); setBingoSeen(false)
    try { localStorage.removeItem(LS_BINGO_KEY) } catch { /* ignore */ }
  }

  const highlightedTiles = new Set(completedLines.flat())

  return (
    <section className="relative">
      {showBingo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(10,14,26,0.75)' }}>
          <style>{`
            @keyframes bingo-pop {
              0%   { transform: scale(0.4) rotate(-6deg); opacity: 0; }
              60%  { transform: scale(1.12) rotate(2deg); opacity: 1; }
              80%  { transform: scale(0.95) rotate(-1deg); }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes bingo-fade-out { 0%,70% { opacity:1; } 100% { opacity:0; } }
            .bingo-pop { animation: bingo-pop 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards, bingo-fade-out 3.5s ease-in-out forwards; }
            @keyframes confetti-drift { 0% { transform:translateY(0) rotate(0); opacity:1; } 100% { transform:translateY(120px) rotate(720deg); opacity:0; } }
            .c1{animation:confetti-drift 1.2s ease-in .1s forwards;}
            .c2{animation:confetti-drift 1.5s ease-in .2s forwards;}
            .c3{animation:confetti-drift 1.1s ease-in .3s forwards;}
            @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          `}</style>
          <div className="bingo-pop text-center">
            <div className="relative inline-block">
              <div className="absolute -top-8 left-1/4 c1 text-xl">🏁</div>
              <div className="absolute -top-6 right-1/4 c2 text-lg">🏎</div>
              <div className="absolute -top-10 left-1/2 c3 text-xl">⚡</div>
              <div className="px-10 py-7 rounded-sm border" style={{ background: '#111827', borderColor: '#38BDF8', boxShadow: '0 0 40px rgba(56,189,248,0.3)' }}>
                <p className="text-6xl font-black tracking-widest" style={{ color: '#38BDF8', textShadow: '0 0 20px rgba(56,189,248,0.6)' }}>BINGO!</p>
                <p className="text-sm text-[#94A3B8] mt-2 tracking-widest uppercase">Line complete — well predicted!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-[#38BDF8] rounded-full" />
          <h2 className="text-xl font-black tracking-tight text-[#F1F5F9] uppercase">F1 Race Bingo</h2>
          {completedLines.length > 0 && (
            <span className="text-xs font-black tracking-widest px-2 py-0.5 rounded-sm" style={{ color: '#38BDF8', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)' }}>
              {completedLines.length} BINGO{completedLines.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleShuffle} className="text-xs font-bold tracking-widest uppercase px-3 py-1.5 border border-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#38BDF8]/40 transition-colors rounded-sm">
            Shuffle Card 🔀
          </button>
          <button onClick={handleResetMarks} className="text-xs font-bold tracking-widest uppercase px-3 py-1.5 border border-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#38BDF8]/40 transition-colors rounded-sm">
            Reset Marks ↺
          </button>
        </div>
      </div>

      <p className="text-sm text-[#94A3B8] mb-5 ml-4 pl-3 border-l border-[#1E293B]">
        Mark tiles as events happen during the race. Complete any row, column, or diagonal to shout BINGO!
      </p>

      {/* 4×4 bingo grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {tiles.map((tile, idx) => {
          const isChecked     = checked.has(idx)
          const isHighlighted = highlightedTiles.has(idx)
          return (
            <button
              key={idx}
              onClick={() => toggleTile(idx)}
              className="relative rounded-sm border text-center transition-all select-none"
              style={{
                height: 75,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                borderColor: isHighlighted ? '#38BDF8' : isChecked ? 'rgba(56,189,248,0.4)' : '#1E293B',
                background:  isHighlighted ? 'rgba(56,189,248,0.15)' : isChecked ? 'rgba(56,189,248,0.07)' : '#111827',
                boxShadow:   isHighlighted ? '0 0 12px rgba(56,189,248,0.2)' : 'none',
                cursor: 'pointer',
              }}
            >
              {isChecked && (
                <span className="absolute top-1 right-1.5 text-[10px] font-black" style={{ color: isHighlighted ? '#38BDF8' : 'rgba(56,189,248,0.5)' }}>✓</span>
              )}
              <span
                style={{
                  fontSize: 12,
                  lineHeight: 1.2,
                  color: isHighlighted ? '#38BDF8' : isChecked ? '#F1F5F9' : '#94A3B8',
                }}
              >
                {tile}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-[#64748B] mt-4 text-center tracking-wide">
        Each player gets a different card — first to shout BINGO wins! 🏆
      </p>

      <div className="flex items-center gap-6 mt-3 justify-end">
        {[
          { bg: '#111827', border: '#1E293B', label: 'Unchecked' },
          { bg: 'rgba(56,189,248,0.07)', border: 'rgba(56,189,248,0.4)', label: 'Marked' },
          { bg: 'rgba(56,189,248,0.15)', border: '#38BDF8', label: 'Bingo line' },
        ].map(({ bg, border, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: bg, border: `1px solid ${border}` }} />
            <span className="text-[10px] text-[#94A3B8]">{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Root client component — fetches all data on mount ─────────────────────────

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1/2026'

export default function RaceDayClient() {
  const [race, setRace]               = useState<RaceInfo | null>(null)
  const [drivers, setDrivers]         = useState<DriverOption[]>([])
  const [raceStatus, setRaceStatus]   = useState<'loading' | 'live' | 'fallback' | 'error'>('loading')
  const [driverStatus, setDriverStatus] = useState<'loading' | 'live' | 'fallback' | 'error'>('loading')

  async function fetchRace() {
    setRaceStatus('loading')
    try {
      const res = await fetch(`${JOLPICA_BASE}/races.json`, { signal: AbortSignal.timeout(7000) })
      if (!res.ok) throw new Error('non-2xx')
      const json = await res.json()
      const mrData = json?.MRData ?? json?.data?.MRData
      const races: any[] = mrData?.RaceTable?.Races ?? []
      if (!races.length) throw new Error('empty')

      const now = Date.now()
      const next = races.find((r: any) => new Date(`${r.date}T${r.time ?? '12:00:00Z'}`).getTime() > now)
      if (!next) throw new Error('no upcoming race')

      setRace({
        round:       next.round,
        raceName:    next.raceName,
        circuitName: next.Circuit?.circuitName ?? 'Unknown Circuit',
        locality:    next.Circuit?.Location?.locality ?? '',
        country:     next.Circuit?.Location?.country ?? '',
        date:        next.date,
        time:        next.time ?? '12:00:00Z',
        dateTimeISO: `${next.date}T${next.time ?? '12:00:00Z'}`,
      })
      setRaceStatus('live')
    } catch {
      setRaceStatus('error')
    }
  }

  async function fetchDrivers() {
    setDriverStatus('loading')
    try {
      const res = await fetch(`${JOLPICA_BASE}/driverStandings.json`, { signal: AbortSignal.timeout(7000) })
      if (!res.ok) throw new Error('non-2xx')
      const json = await res.json()
      const mrData = json?.MRData ?? json?.data?.MRData
      const raw: any[] = mrData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []
      if (!raw.length) throw new Error('empty')

      setDrivers(raw.slice(0, 10).map((s: any) => ({
        code:   s.Driver?.code ?? s.Driver?.familyName?.slice(0, 3).toUpperCase() ?? '???',
        name:   `${s.Driver?.givenName} ${s.Driver?.familyName}`,
        team:   s.Constructors?.[0]?.name ?? 'Unknown',
        teamId: CONSTRUCTOR_ID_MAP[s.Constructors?.[0]?.constructorId ?? ''] ?? 'haas',
        points: parseFloat(s.points),
      })))
      setDriverStatus('live')
    } catch {
      setDriverStatus('error')
    }
  }

  useEffect(() => {
    fetchRace()
    fetchDrivers()
  }, [])

  return (
    <>
      <CountdownSection race={race} status={raceStatus} onRetry={fetchRace} />
      <PredictionsSection
        drivers={drivers}
        raceName={race?.raceName ?? 'next race'}
        status={driverStatus}
        onRetry={fetchDrivers}
      />
      <BingoSection />
    </>
  )
}
