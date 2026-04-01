'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Race2026 {
  round: string
  raceName: string
  country: string
  date: string
}

interface Driver2026 {
  position: number
  driverId: string
  code: string
  name: string
  constructorId: string
  lastPitLap: number
  totalLaps: number
}

interface LapEntry {
  driverId: string
  lap: number
  seconds: number
}

/** A detected SC or VSC phase */
interface ScEvent {
  id: string
  type: 'SC' | 'VSC'
  startLap: number
  endLap: number
}

type ScEffect = 'free' | 'lost' | 'neutral' | 'cheap' | null

interface SimDriver extends Driver2026 {
  simPosition: number
  timeDelta: number
  scEffect: ScEffect
  effectivePitLap: number
}

interface RaceCache {
  results: Driver2026[]
  hasPitData: boolean
  lapData: LapEntry[]
  scEvents: ScEvent[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE    = 'https://api.jolpi.ca/ergast/f1'
const AVG_GAP = 5

const TEAM_COLORS: Record<string, string> = {
  red_bull: '#3671C6', ferrari: '#E8002D', mercedes: '#27F4D2',
  mclaren: '#FF8000', aston_martin: '#229971', alpine: '#FF87BC',
  williams: '#64C4FF', rb: '#6692FF', sauber: '#52E252', haas: '#B6BABD',
  renault: '#FFF500', racing_point: '#F596C8', alphatauri: '#6692FF',
  alfa: '#B12039', force_india: '#F596C8',
}

const SC_META: Record<NonNullable<ScEffect>, { bg: string; border: string; text: string; label: string }> = {
  free:    { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  text: '#22C55E', label: 'Freistopp'        },
  lost:    { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: '#EF4444', label: 'Vorteil verloren' },
  neutral: { bg: 'rgba(71,85,105,0.08)', border: 'rgba(71,85,105,0.25)', text: '#64748B', label: 'Neutral'          },
  cheap:   { bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.3)',  text: '#EAB308', label: 'Günst. Stopp'    },
}

// ─── SC detection ─────────────────────────────────────────────────────────────

function parseTime(t: string): number {
  if (!t) return 0
  const parts = t.split(':')
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1])
  return parseFloat(t) || 0
}

function detectAllScEvents(lapData: LapEntry[], totalLaps: number): ScEvent[] {
  if (!lapData.length) return []

  // Baseline: median of per-lap medians between lap 4 and lap (totalLaps - 4)
  const medians: number[] = []
  for (let lap = 4; lap <= Math.max(5, totalLaps - 4); lap++) {
    const times = lapData.filter(l => l.lap === lap && l.seconds > 5).map(l => l.seconds)
    if (times.length < 3) continue
    const sorted = [...times].sort((a, b) => a - b)
    medians.push(sorted[Math.floor(sorted.length / 2)])
  }
  if (!medians.length) return []
  const sortedM = [...medians].sort((a, b) => a - b)
  const baseline = sortedM[Math.floor(sortedM.length * 0.25)] // 25th-percentile = typical fast lap

  const events: ScEvent[] = []
  let inPhase = false
  let phaseStart = 0
  let phaseType: 'SC' | 'VSC' = 'SC'

  for (let lap = 2; lap <= totalLaps; lap++) {
    const times = lapData.filter(l => l.lap === lap && l.seconds > 5).map(l => l.seconds)
    if (times.length < 4) continue

    const mean   = times.reduce((s, t) => s + t, 0) / times.length
    const stdDev = Math.sqrt(times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length)

    // SC:  mean > baseline * 1.28 AND stdDev < 3.5  (full SC – everyone bunched up)
    // VSC: mean > baseline * 1.10 AND stdDev < 5.0  (VSC – slower but more spread)
    const isScLap  = mean > baseline * 1.28 && stdDev < 3.5
    const isVscLap = !isScLap && mean > baseline * 1.10 && stdDev < 5.0

    if ((isScLap || isVscLap) && !inPhase) {
      inPhase    = true
      phaseStart = lap
      phaseType  = isScLap ? 'SC' : 'VSC'
    } else if ((isScLap || isVscLap) && inPhase) {
      // Upgrade to SC if we see a tighter lap mid-phase
      if (isScLap) phaseType = 'SC'
    } else if (!isScLap && !isVscLap && inPhase) {
      if (lap - phaseStart >= 2) { // minimum 2 laps to count
        events.push({ id: `${phaseType}-${phaseStart}`, type: phaseType, startLap: phaseStart, endLap: lap - 1 })
      }
      inPhase = false
    }
  }
  if (inPhase && totalLaps - phaseStart >= 2) {
    events.push({ id: `${phaseType}-${phaseStart}`, type: phaseType, startLap: phaseStart, endLap: totalLaps })
  }

  return events
}

// ─── Simulation ───────────────────────────────────────────────────────────────

function scEffectForPitLap(pitLap: number, scStartLap: number): { effect: ScEffect; delta: number } {
  const lapsSincePit = scStartLap - pitLap
  if (lapsSincePit < 0)      return { effect: 'free',    delta: -22 }
  if (lapsSincePit <= 3)     return { effect: 'lost',    delta: (3 - lapsSincePit) * 0.4 }
  if (lapsSincePit <= 12)    return { effect: 'neutral', delta: 0 }
  return                            { effect: 'cheap',   delta: -8 }
}

function runSimulation(
  drivers: Driver2026[],
  scEnabled: boolean,
  selectedScEvent: ScEvent | null,
  pitEnabled: boolean,
  selectedDriverId: string,
  // SC mode: pit lap = scStart + pitRelToSc
  pitRelToSc: number,
  // Standalone pit mode: ±5 laps from real pit
  pitDeltaAbs: number,
): SimDriver[] {
  const sim: SimDriver[] = drivers.map(d => ({
    ...d,
    simPosition: d.position,
    timeDelta: 0,
    scEffect: null,
    effectivePitLap: d.lastPitLap,
  }))

  const scLap = selectedScEvent?.startLap ?? 0

  // Pit toggle in SC mode: override selected driver's pit lap
  if (scEnabled && pitEnabled && selectedDriverId && selectedScEvent) {
    const d = sim.find(s => s.driverId === selectedDriverId)
    if (d) d.effectivePitLap = scLap + pitRelToSc
  }

  // SC effect on all drivers
  if (scEnabled && selectedScEvent) {
    for (const d of sim) {
      const { effect, delta } = scEffectForPitLap(d.effectivePitLap, scLap)
      d.scEffect  = effect
      d.timeDelta = delta
    }
  }

  // Standalone pit mode (SC not active)
  if (!scEnabled && pitEnabled && selectedDriverId && pitDeltaAbs !== 0) {
    const d = sim.find(s => s.driverId === selectedDriverId)
    if (d) {
      const simPit = d.lastPitLap + pitDeltaAbs
      if (pitDeltaAbs < 0) {
        const frontRunners = sim.filter(s => s.driverId !== selectedDriverId && s.lastPitLap > simPit)
        const lapsOnFresh  = frontRunners.length > 0
          ? Math.min(...frontRunners.map(o => o.lastPitLap - simPit))
          : Math.abs(pitDeltaAbs)
        d.timeDelta += -(lapsOnFresh * 0.4 - 22)
      } else {
        d.timeDelta += -(pitDeltaAbs * 0.15 - pitDeltaAbs * 0.08)
      }
    }
  }

  const withVT = sim.map((d, i) => ({ ...d, _vt: i * AVG_GAP + d.timeDelta }))
  withVT.sort((a, b) => a._vt - b._vt)
  return withVT.map((d, i) => ({ ...d, simPosition: i + 1 }))
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 rounded-full animate-spin"
        style={{ borderColor: '#38BDF8', borderTopColor: 'transparent' }} />
    </div>
  )
}

function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-sm border text-xs font-bold tracking-wide transition-all select-none"
      style={{
        background:  checked ? 'rgba(56,189,248,0.08)' : '#111827',
        borderColor: checked ? 'rgba(56,189,248,0.4)'  : '#1E293B',
        color:       checked ? '#38BDF8'                : '#94A3B8',
      }}
    >
      <span style={{
        position: 'relative', display: 'inline-block', width: 32, height: 18,
        borderRadius: 999, flexShrink: 0,
        background: checked ? '#38BDF8' : '#1E293B', transition: 'background 0.2s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%',
          background: checked ? '#0A0E1A' : '#475569', transition: 'left 0.15s',
        }} />
      </span>
      {label}
    </button>
  )
}

function Slider({ value, min, max, onChange, label, formatValue }: {
  value: number; min: number; max: number
  onChange: (v: number) => void
  label: string
  formatValue?: (v: number) => string
}) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-[#94A3B8]">{label}</label>
        <span className="text-xs font-black px-2 py-0.5 rounded-sm"
          style={{ background: '#1E293B', color: '#38BDF8', fontFamily: 'monospace' }}>
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={1} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full cursor-pointer"
        style={{ background: `linear-gradient(to right, #0EA5E9 0%, #38BDF8 ${pct}%, #1E293B ${pct}%, #1E293B 100%)` }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[#475569]">{formatValue ? formatValue(min) : min}</span>
        <span className="text-[10px] text-[#475569]">{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  )
}

function LiveDriverRow({ driver, position, timeDelta, scEffect, highlight, effectivePitLap, showPitLap }: {
  driver: Driver2026
  position: number
  timeDelta: number | null
  scEffect: ScEffect
  highlight: boolean
  effectivePitLap?: number
  showPitLap?: boolean
}) {
  const color = TEAM_COLORS[driver.constructorId] ?? '#38BDF8'
  const sc    = scEffect ? SC_META[scEffect] : null
  const posChange = timeDelta != null ? driver.position - position : 0

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-sm"
      style={{
        background: sc ? sc.bg : highlight ? `${color}12` : 'transparent',
        border: `1px solid ${sc ? sc.border : highlight ? `${color}40` : 'transparent'}`,
      }}
    >
      <span className="text-xs font-black tabular-nums w-5 text-right shrink-0"
        style={{ color: position <= 3 ? '#38BDF8' : '#94A3B8' }}>
        {position}
      </span>
      <span className="text-xs font-black px-1.5 py-0.5 rounded-sm shrink-0"
        style={{ color: highlight ? '#38BDF8' : color, background: highlight ? 'rgba(56,189,248,0.2)' : `${color}20` }}>
        {driver.code}
      </span>
      <span className="text-xs text-[#F1F5F9] flex-1 truncate">
        {driver.name.split(' ').slice(1).join(' ')}
      </span>
      {showPitLap && effectivePitLap != null && (
        <span className="text-[9px] text-[#475569] shrink-0 hidden sm:block font-mono">
          pit R{effectivePitLap}
        </span>
      )}
      {sc && (
        <span className="text-[9px] font-bold shrink-0 hidden sm:block" style={{ color: sc.text }}>
          {sc.label}
        </span>
      )}
      {timeDelta != null && timeDelta !== 0 && (
        <span className="text-[10px] font-mono shrink-0"
          style={{ color: timeDelta < 0 ? '#22C55E' : '#EF4444' }}>
          {timeDelta < 0 ? `−${Math.abs(timeDelta).toFixed(1)}s` : `+${timeDelta.toFixed(1)}s`}
        </span>
      )}
      {posChange !== 0 && (
        <span className="text-[10px] font-black shrink-0"
          style={{ color: posChange > 0 ? '#22C55E' : '#EF4444' }}>
          {posChange > 0 ? `↑${posChange}` : `↓${Math.abs(posChange)}`}
        </span>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Live2026() {
  const [races, setRaces]               = useState<Race2026[]>([])
  const [racesLoading, setRacesLoading] = useState(true)
  const [selectedRound, setSelectedRound] = useState('')
  const [dataLoading, setDataLoading]   = useState(false)

  const [drivers, setDrivers]       = useState<Driver2026[]>([])
  const [hasPitData, setHasPitData] = useState(true)
  const [scEvents, setScEvents]     = useState<ScEvent[]>([])

  // SC controls
  const [scEnabled, setScEnabled]             = useState(false)
  const [selectedScEvent, setSelectedScEvent] = useState<ScEvent | null>(null)
  const [manualEvents, setManualEvents]       = useState<ScEvent[]>([])
  const [manualLap, setManualLap]             = useState('')
  const [manualType, setManualType]           = useState<'SC' | 'VSC'>('SC')

  // Pit controls
  const [pitEnabled, setPitEnabled]       = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [pitRelToSc, setPitRelToSc]       = useState(-1)   // relative to SC when SC active
  const [pitDeltaAbs, setPitDeltaAbs]     = useState(0)    // absolute when SC not active

  const cache = useRef<Map<string, RaceCache>>(new Map())

  // Load race list
  useEffect(() => {
    const today = new Date()
    fetch(`${BASE}/2026/races.json?limit=30`, { signal: AbortSignal.timeout(7000) })
      .then(r => r.json())
      .then(data => {
        const raw: any[] = (data?.MRData ?? data?.data?.MRData)?.RaceTable?.Races ?? []
        setRaces(raw.filter(r => new Date(r.date) < today).map(r => ({
          round: r.round, raceName: r.raceName,
          country: r.Circuit?.Location?.country ?? '', date: r.date,
        })))
      })
      .catch(() => {})
      .finally(() => setRacesLoading(false))
  }, [])

  // Load race data when round changes
  useEffect(() => {
    if (!selectedRound) return
    resetToggles()

    const cached = cache.current.get(selectedRound)
    if (cached) { applyRaceData(cached); return }

    setDataLoading(true)
    setDrivers([])

    Promise.all([
      fetch(`${BASE}/2026/${selectedRound}/results.json`,         { signal: AbortSignal.timeout(8000)  }).then(r => r.json()),
      fetch(`${BASE}/2026/${selectedRound}/pitstops.json?limit=200`, { signal: AbortSignal.timeout(8000)  }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${BASE}/2026/${selectedRound}/laps.json?limit=2000`, { signal: AbortSignal.timeout(12000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([resData, pitsData, lapsData]) => {
      const mrR     = resData?.MRData ?? resData?.data?.MRData
      const rawRes: any[]  = mrR?.RaceTable?.Races?.[0]?.Results  ?? []
      const mrP     = pitsData ? (pitsData?.MRData ?? pitsData?.data?.MRData) : null
      const rawPits: any[] = mrP?.RaceTable?.Races?.[0]?.PitStops ?? []
      const mrL     = lapsData ? (lapsData?.MRData ?? lapsData?.data?.MRData) : null
      const rawLaps: any[] = mrL?.RaceTable?.Races?.[0]?.Laps     ?? []

      // Lap entries
      const lapEntries: LapEntry[] = []
      for (const lapObj of rawLaps) {
        const lapNum = parseInt(lapObj.number)
        for (const t of (lapObj.Timings ?? [])) {
          const s = parseTime(t.time)
          if (s > 0) lapEntries.push({ driverId: t.driverId, lap: lapNum, seconds: s })
        }
      }

      // Pit map
      const pitMap: Record<string, number> = {}
      for (const p of rawPits) {
        const lap = parseInt(p.lap) || 1
        if (!pitMap[p.driverId] || lap > pitMap[p.driverId]) pitMap[p.driverId] = lap
      }

      const tl = parseInt(rawRes[0]?.laps) || 60

      const results: Driver2026[] = rawRes.map((r: any) => {
        const id = r.Driver?.driverId ?? ''
        return {
          position:      parseInt(r.position),
          driverId:      id,
          code:          r.Driver?.code ?? r.Driver?.familyName?.slice(0, 3).toUpperCase() ?? '???',
          name:          `${r.Driver?.givenName ?? ''} ${r.Driver?.familyName ?? ''}`.trim(),
          constructorId: r.Constructor?.constructorId ?? 'unknown',
          lastPitLap:    pitMap[id] ?? Math.round(tl * 0.4),
          totalLaps:     tl,
        }
      })

      const detectedEvents = detectAllScEvents(lapEntries, tl)
      const entry: RaceCache = { results, hasPitData: rawPits.length > 0, lapData: lapEntries, scEvents: detectedEvents }
      cache.current.set(selectedRound, entry)
      applyRaceData(entry)
    }).catch(() => {}).finally(() => setDataLoading(false))
  }, [selectedRound])

  function resetToggles() {
    setScEnabled(false); setSelectedScEvent(null); setManualEvents([]); setManualLap('')
    setPitEnabled(false); setSelectedDriverId(''); setPitRelToSc(-1); setPitDeltaAbs(0)
  }

  const allScEvents = [...scEvents, ...manualEvents]

  function addManualEvent() {
    const lap = parseInt(manualLap)
    if (!lap || lap < 1 || lap > totalLaps) return
    const id = `manual-${manualType}-${lap}`
    if (allScEvents.find(e => e.id === id)) return
    setManualEvents(prev => [...prev, { id, type: manualType, startLap: lap, endLap: Math.min(lap + 3, totalLaps) }])
    setManualLap('')
  }

  function removeManualEvent(id: string) {
    setManualEvents(prev => prev.filter(e => e.id !== id))
    if (selectedScEvent?.id === id) setSelectedScEvent(null)
  }

  function applyRaceData(data: RaceCache) {
    setDrivers(data.results)
    setHasPitData(data.hasPitData)
    setScEvents(data.scEvents)
  }

  const totalLaps    = drivers[0]?.totalLaps ?? 60
  const active       = scEnabled || pitEnabled
  const selectedDriver = drivers.find(d => d.driverId === selectedDriverId) ?? null

  const simResults: SimDriver[] | null = active && drivers.length > 0
    ? runSimulation(drivers, scEnabled, selectedScEvent, pitEnabled, selectedDriverId, pitRelToSc, pitDeltaAbs)
    : null

  // Summary
  let summaryText = ''
  if (simResults) {
    const parts: string[] = []
    if (scEnabled && selectedScEvent) {
      parts.push(`${selectedScEvent.type} Runde ${selectedScEvent.startLap}`)
      if (pitEnabled && selectedDriver) {
        const rel = pitRelToSc
        const word = rel === 0 ? 'beim SC' : rel < 0 ? `${Math.abs(rel)} R. vor SC` : `${rel} R. nach SC`
        parts.push(`${selectedDriver.code} Stopp ${word}`)
      }
    } else if (pitEnabled && selectedDriver && pitDeltaAbs !== 0) {
      const word = pitDeltaAbs < 0 ? `${Math.abs(pitDeltaAbs)} R. früher` : `${pitDeltaAbs} R. später`
      parts.push(`${selectedDriver.code} Stopp ${word}`)
    }
    if (parts.length) {
      const movers = simResults.filter(d => d.simPosition !== d.position)
        .map(d => { const delta = d.position - d.simPosition; return `${d.code} ${delta > 0 ? `+${delta}` : delta}` })
        .slice(0, 5).join(', ')
      summaryText = `${parts.join(' + ')}: ${movers || 'Keine Positionsänderungen'}`
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1 h-8 rounded-full" style={{ background: '#EF4444' }} />
        <h2 className="text-2xl font-black tracking-tight text-[#F1F5F9] uppercase">
          2026 <span style={{ color: '#EF4444' }}>What-If Live</span>
        </h2>
        <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm border"
          style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}>
          2026
        </span>
      </div>
      <p className="text-sm text-[#94A3B8] ml-4 pl-3 border-l border-[#1E293B] mb-8">
        Simuliere SC- und VSC-Phasen und Boxenstopps für 2026er Rennen mit echten Daten.
      </p>

      {/* Race selector */}
      <div className="mb-8">
        <label className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] block mb-3">
          Rennen wählen
        </label>
        {racesLoading ? <Spinner /> : races.length === 0 ? (
          <p className="text-sm text-[#475569] italic">Noch keine gefahrenen Rennen in der 2026er Saison.</p>
        ) : (
          <select value={selectedRound} onChange={e => setSelectedRound(e.target.value)}
            className="w-full px-3 py-2.5 text-sm font-medium rounded-sm border focus:outline-none"
            style={{ background: '#111827', color: '#F1F5F9', borderColor: selectedRound ? 'rgba(239,68,68,0.4)' : '#1E293B' }}>
            <option value="">Rennen wählen…</option>
            {races.map(r => (
              <option key={r.round} value={r.round}>
                R{r.round} — {r.raceName} ({new Date(r.date).toLocaleDateString('de-CH', { day: 'numeric', month: 'short' })})
              </option>
            ))}
          </select>
        )}
      </div>

      {dataLoading && <Spinner />}

      {!dataLoading && drivers.length > 0 && (
        <>
          {/* Toggles */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Toggle checked={scEnabled} onChange={v => { setScEnabled(v); if (!v) setSelectedScEvent(null) }} label="Safety Car / VSC" />
            <Toggle
              checked={pitEnabled}
              onChange={v => { setPitEnabled(v); if (!v) { setSelectedDriverId(''); setPitRelToSc(-1); setPitDeltaAbs(0) } }}
              label="Boxenstopp anpassen"
            />
          </div>

          {/* ── SC panel ────────────────────────────────────────────────────── */}
          {scEnabled && (
            <div className="mb-6 p-5 bg-[#111827] border border-[#1E293B] rounded-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-4">
                Safety Car / VSC Events
              </p>

              {/* Detected + manual events */}
              {allScEvents.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {allScEvents.map(ev => {
                    const isSel    = selectedScEvent?.id === ev.id
                    const isSc     = ev.type === 'SC'
                    const isManual = ev.id.startsWith('manual-')
                    const accent   = isSc ? '#EF4444' : '#EAB308'
                    return (
                      <div key={ev.id} className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedScEvent(isSel ? null : ev)}
                          className="px-3 py-2 rounded-sm border text-xs font-bold transition-all"
                          style={{
                            background:  isSel ? `rgba(${isSc ? '239,68,68' : '234,179,8'},0.12)` : '#0A0E1A',
                            borderColor: isSel ? accent : '#1E293B',
                            color:       isSel ? accent : '#94A3B8',
                          }}
                        >
                          <span className="font-black">{ev.type}</span>
                          <span className="ml-1.5 font-normal">R{ev.startLap}</span>
                          {isManual && <span className="ml-1 text-[9px] opacity-50">manuell</span>}
                        </button>
                        {isManual && (
                          <button
                            onClick={() => removeManualEvent(ev.id)}
                            className="text-[10px] px-1.5 py-1 rounded-sm border transition-colors"
                            style={{ color: '#475569', borderColor: '#1E293B' }}
                            title="Entfernen"
                          >✕</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {scEvents.length === 0 && manualEvents.length === 0 && (
                <p className="text-xs text-[#EAB308] mb-3">
                  Keine SC/VSC-Daten verfügbar — bitte manuell eingeben.
                </p>
              )}

              {/* Manual input */}
              <div className="flex items-center gap-2 mt-1">
                <select
                  value={manualType}
                  onChange={e => setManualType(e.target.value as 'SC' | 'VSC')}
                  className="px-2 py-1.5 text-xs font-bold rounded-sm border focus:outline-none"
                  style={{ background: '#0A0E1A', color: '#F1F5F9', borderColor: '#1E293B', minWidth: 64 }}
                >
                  <option value="SC">SC</option>
                  <option value="VSC">VSC</option>
                </select>
                <input
                  type="number"
                  placeholder={`Runde (1–${totalLaps})`}
                  value={manualLap}
                  onChange={e => setManualLap(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addManualEvent()}
                  min={1} max={totalLaps}
                  className="flex-1 px-3 py-1.5 text-xs rounded-sm border focus:outline-none"
                  style={{ background: '#0A0E1A', color: '#F1F5F9', borderColor: '#1E293B' }}
                />
                <button
                  onClick={addManualEvent}
                  className="px-3 py-1.5 text-xs font-bold rounded-sm border transition-colors"
                  style={{ background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.3)', color: '#38BDF8' }}
                >
                  + Hinzufügen
                </button>
              </div>

              {/* Effect legend */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {(Object.entries(SC_META) as [NonNullable<ScEffect>, typeof SC_META[NonNullable<ScEffect>]][]).map(([key, meta]) => (
                  <div key={key} className="px-2 py-1.5 rounded-sm border text-[10px] font-bold"
                    style={{ background: meta.bg, borderColor: meta.border, color: meta.text }}>
                    {key === 'free'    && 'Stopp nach SC-Start'}
                    {key === 'lost'    && '0–3 Runden vor SC'}
                    {key === 'neutral' && '4–12 Runden vor SC'}
                    {key === 'cheap'   && '> 12 Runden vor SC'}
                    <span className="block font-normal opacity-80 mt-0.5">{meta.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pit panel ───────────────────────────────────────────────────── */}
          {pitEnabled && (
            <div className="mb-6 p-5 bg-[#111827] border border-[#1E293B] rounded-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-4">Boxenstopp</p>

              {!hasPitData ? (
                <p className="text-sm text-[#475569]">Keine Pit-Daten für dieses Rennen verfügbar.</p>
              ) : (
                <>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-[#94A3B8] block mb-2">Fahrer wählen</label>
                    <select value={selectedDriverId}
                      onChange={e => { setSelectedDriverId(e.target.value); setPitRelToSc(-1); setPitDeltaAbs(0) }}
                      className="w-full px-3 py-2.5 text-sm font-medium rounded-sm border focus:outline-none"
                      style={{ background: '#0A0E1A', color: '#F1F5F9', borderColor: selectedDriverId ? 'rgba(56,189,248,0.4)' : '#1E293B' }}>
                      <option value="">Fahrer wählen…</option>
                      {drivers.map(d => (
                        <option key={d.driverId} value={d.driverId}>
                          P{d.position} — {d.name} (letzter Stopp: R{d.lastPitLap})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedDriverId && scEnabled && selectedScEvent && (
                    /* SC-relative pit slider */
                    <div>
                      <Slider
                        value={pitRelToSc}
                        min={-10} max={5}
                        onChange={setPitRelToSc}
                        label={`Stopp relativ zum ${selectedScEvent.type} (R${selectedScEvent.startLap})`}
                        formatValue={v =>
                          v === 0  ? `R${selectedScEvent.startLap} (beim ${selectedScEvent.type})`
                          : v < 0  ? `R${selectedScEvent.startLap + v} (${Math.abs(v)} R. vor ${selectedScEvent.type})`
                          :          `R${selectedScEvent.startLap + v} (${v} R. nach ${selectedScEvent.type})`
                        }
                      />
                      <p className="text-[10px] text-[#475569] mt-2">
                        Stopp auf Runde {selectedScEvent.startLap + pitRelToSc} →{' '}
                        {(() => {
                          const { effect } = scEffectForPitLap(selectedScEvent.startLap + pitRelToSc, selectedScEvent.startLap)
                          return effect ? SC_META[effect].label : '—'
                        })()}
                      </p>
                    </div>
                  )}

                  {selectedDriverId && !scEnabled && (
                    /* Absolute pit delta slider */
                    <Slider
                      value={pitDeltaAbs}
                      min={-5} max={5}
                      onChange={setPitDeltaAbs}
                      label="Stopp verschieben (absolut)"
                      formatValue={v => v === 0 ? 'Kein Unterschied' : v < 0 ? `${Math.abs(v)} Runden früher` : `${v} Runden später`}
                    />
                  )}

                  {selectedDriverId && scEnabled && !selectedScEvent && (
                    <p className="text-sm text-[#EAB308]">Wähle zuerst einen SC/VSC-Event oben.</p>
                  )}

                  {!selectedDriverId && (
                    <p className="text-sm text-[#1E293B] italic">Wähle einen Fahrer um fortzufahren.</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Prompt when nothing active */}
          {!active && (
            <div className="p-8 rounded-sm border text-center" style={{ background: '#111827', borderColor: '#1E293B' }}>
              <p className="text-sm text-[#475569]">Aktiviere einen Toggle um die Simulation zu starten.</p>
            </div>
          )}

          {/* ── Results ─────────────────────────────────────────────────────── */}
          {simResults && (
            <div>
              {summaryText && (
                <div className="mb-4 px-4 py-3 rounded-sm border text-sm text-[#F1F5F9] leading-relaxed"
                  style={{ background: 'rgba(56,189,248,0.04)', borderColor: 'rgba(56,189,248,0.2)' }}>
                  {summaryText}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Real */}
                <div className="bg-[#111827] border border-[#1E293B] rounded-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#1E293B] bg-[#0A0E1A]">
                    <p className="text-xs font-black tracking-widest uppercase text-[#94A3B8]">Real</p>
                  </div>
                  <div className="p-3 space-y-1">
                    {drivers.slice(0, 10).map(d => (
                      <LiveDriverRow key={d.driverId} driver={d} position={d.position}
                        timeDelta={null} scEffect={null}
                        highlight={d.driverId === selectedDriverId}
                        effectivePitLap={d.lastPitLap} showPitLap />
                    ))}
                  </div>
                </div>

                {/* Simulated */}
                <div className="rounded-sm overflow-hidden border" style={{ borderColor: 'rgba(56,189,248,0.3)', background: '#111827' }}>
                  <div className="px-4 py-2.5 border-b flex items-center gap-2"
                    style={{ borderColor: 'rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.06)' }}>
                    <p className="text-xs font-black tracking-widest uppercase" style={{ color: '#38BDF8' }}>Simuliert</p>
                  </div>
                  <div className="p-3 space-y-1">
                    {simResults.slice(0, 10).map(d => (
                      <LiveDriverRow key={d.driverId} driver={d} position={d.simPosition}
                        timeDelta={d.timeDelta !== 0 ? d.timeDelta : null}
                        scEffect={d.scEffect}
                        highlight={d.driverId === selectedDriverId}
                        effectivePitLap={d.effectivePitLap} showPitLap />
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-[#1E293B] mt-3 text-right italic">
                Vereinfachte Simulation – basiert auf realen Pit- und Lap-Daten aus 2026.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
