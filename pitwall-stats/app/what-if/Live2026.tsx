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

interface PitStop2026 {
  driverId: string
  lap: number
}

interface LapEntry {
  driverId: string
  lap: number
  seconds: number
}

type ScEffect = 'free' | 'lost' | 'neutral' | 'cheap' | null

interface SimDriver extends Driver2026 {
  simPosition: number
  timeDelta: number
  scEffect: ScEffect
}

interface RaceCache {
  results: Driver2026[]
  pitStops: PitStop2026[]
  lapData: LapEntry[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE = 'https://api.jolpi.ca/ergast/f1'
const AVG_GAP = 5 // seconds between positions as proxy

const TEAM_COLORS: Record<string, string> = {
  red_bull: '#3671C6', ferrari: '#E8002D', mercedes: '#27F4D2',
  mclaren: '#FF8000', aston_martin: '#229971', alpine: '#FF87BC',
  williams: '#64C4FF', rb: '#6692FF', sauber: '#52E252', haas: '#B6BABD',
  renault: '#FFF500', racing_point: '#F596C8', alphatauri: '#6692FF',
  alfa: '#B12039', force_india: '#F596C8',
}

const SC_META: Record<NonNullable<ScEffect>, { bg: string; border: string; text: string; label: string }> = {
  free:    { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  text: '#22C55E', label: 'Freistopp'          },
  lost:    { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: '#EF4444', label: 'Vorteil verloren'   },
  neutral: { bg: 'rgba(71,85,105,0.08)', border: 'rgba(71,85,105,0.25)', text: '#64748B', label: 'Neutral'            },
  cheap:   { bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.3)',  text: '#EAB308', label: 'Günstiger Stopp'   },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTime(t: string): number {
  if (!t) return 0
  const parts = t.split(':')
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1])
  return parseFloat(t) || 0
}

function detectScLap(lapData: LapEntry[], totalLaps: number): number | null {
  for (let lap = 2; lap <= totalLaps; lap++) {
    const times = lapData.filter(l => l.lap === lap && l.seconds > 0).map(l => l.seconds)
    if (times.length < 5) continue
    const mean = times.reduce((s, t) => s + t, 0) / times.length
    const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length
    if (Math.sqrt(variance) < 2.0) return lap
  }
  return null
}

function getLastPitLap(pitStops: PitStop2026[], driverId: string, totalLaps: number): number {
  const stops = pitStops.filter(p => p.driverId === driverId).sort((a, b) => b.lap - a.lap)
  return stops.length > 0 ? stops[0].lap : Math.round(totalLaps * 0.4)
}

function runSimulation(
  drivers: Driver2026[],
  scEnabled: boolean, scLap: number,
  pitEnabled: boolean, selectedDriverId: string, pitDelta: number,
): SimDriver[] {
  const sim: SimDriver[] = drivers.map(d => ({
    ...d,
    simPosition: d.position,
    timeDelta: 0,
    scEffect: null,
  }))

  // SC effect on all drivers
  if (scEnabled) {
    for (const d of sim) {
      const lapsSincePit = scLap - d.lastPitLap
      if (lapsSincePit < 0) {
        d.timeDelta = -22
        d.scEffect = 'free'
      } else if (lapsSincePit <= 3) {
        d.timeDelta = (3 - lapsSincePit) * 0.4
        d.scEffect = 'lost'
      } else if (lapsSincePit <= 12) {
        d.timeDelta = 0
        d.scEffect = 'neutral'
      } else {
        d.timeDelta = -8
        d.scEffect = 'cheap'
      }
    }
  }

  // Pit delta for selected driver
  if (pitEnabled && selectedDriverId && pitDelta !== 0) {
    const d = sim.find(s => s.driverId === selectedDriverId)
    if (d) {
      const simPit = d.lastPitLap + pitDelta
      if (pitDelta < 0) {
        // Undercut
        const frontRunners = sim.filter(s => s.driverId !== selectedDriverId && s.lastPitLap > simPit)
        const lapsOnFresh = frontRunners.length > 0
          ? Math.min(...frontRunners.map(o => o.lastPitLap - simPit))
          : Math.abs(pitDelta)
        const net = lapsOnFresh * 0.4 - 22
        d.timeDelta += -net
      } else {
        // Overcut
        const net = pitDelta * 0.15 - pitDelta * 0.08
        d.timeDelta += -net
      }
    }
  }

  // Sort by virtual finishing time (base gap + delta)
  const withVT = sim.map((d, i) => ({ ...d, _vt: i * AVG_GAP + d.timeDelta }))
  withVT.sort((a, b) => a._vt - b._vt)
  return withVT.map((d, i) => ({ ...d, simPosition: i + 1 }))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div
        className="w-6 h-6 border-2 rounded-full animate-spin"
        style={{ borderColor: '#38BDF8', borderTopColor: 'transparent' }}
      />
    </div>
  )
}

function Toggle({ checked, onChange, label }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-sm border text-xs font-bold tracking-wide transition-all select-none"
      style={{
        background:   checked ? 'rgba(56,189,248,0.08)' : '#111827',
        borderColor:  checked ? 'rgba(56,189,248,0.4)' : '#1E293B',
        color:        checked ? '#38BDF8' : '#94A3B8',
      }}
    >
      <span style={{
        position: 'relative', display: 'inline-block',
        width: 32, height: 18, borderRadius: 999, flexShrink: 0,
        background: checked ? '#38BDF8' : '#1E293B',
        transition: 'background 0.2s',
      }}>
        <span style={{
          position: 'absolute', top: 2,
          left: checked ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%',
          background: checked ? '#0A0E1A' : '#475569',
          transition: 'left 0.15s',
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
        <span
          className="text-xs font-black px-2 py-0.5 rounded-sm"
          style={{ background: '#1E293B', color: '#38BDF8', fontFamily: 'monospace' }}
        >
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={1} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, #0EA5E9 0%, #38BDF8 ${pct}%, #1E293B ${pct}%, #1E293B 100%)`,
        }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[#475569]">{formatValue ? formatValue(min) : min}</span>
        <span className="text-[10px] text-[#475569]">{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  )
}

function LiveDriverRow({ driver, position, timeDelta, scEffect, highlight }: {
  driver: Driver2026
  position: number
  timeDelta: number | null
  scEffect: ScEffect
  highlight: boolean
}) {
  const color  = TEAM_COLORS[driver.constructorId] ?? '#38BDF8'
  const sc     = scEffect ? SC_META[scEffect] : null
  const posChange = timeDelta != null ? driver.position - position : 0

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-sm"
      style={{
        background: sc ? sc.bg : highlight ? `${color}12` : 'transparent',
        border: `1px solid ${sc ? sc.border : highlight ? `${color}40` : 'transparent'}`,
      }}
    >
      <span
        className="text-xs font-black tabular-nums w-5 text-right shrink-0"
        style={{ color: position <= 3 ? '#38BDF8' : '#94A3B8' }}
      >
        {position}
      </span>
      <span
        className="text-xs font-black px-1.5 py-0.5 rounded-sm shrink-0"
        style={{
          color:      highlight ? '#38BDF8' : color,
          background: highlight ? 'rgba(56,189,248,0.2)' : `${color}20`,
        }}
      >
        {driver.code}
      </span>
      <span className="text-xs text-[#F1F5F9] flex-1 truncate">
        {driver.name.split(' ').slice(1).join(' ')}
      </span>

      {/* SC label */}
      {sc && (
        <span className="text-[9px] font-bold shrink-0 hidden sm:block" style={{ color: sc.text }}>
          {sc.label}
        </span>
      )}

      {/* Time delta */}
      {timeDelta != null && timeDelta !== 0 && (
        <span
          className="text-[10px] font-mono shrink-0"
          style={{ color: timeDelta < 0 ? '#22C55E' : '#EF4444' }}
        >
          {timeDelta < 0 ? `−${Math.abs(timeDelta).toFixed(1)}s` : `+${timeDelta.toFixed(1)}s`}
        </span>
      )}

      {/* Position change */}
      {posChange !== 0 && (
        <span
          className="text-[10px] font-black shrink-0"
          style={{ color: posChange > 0 ? '#22C55E' : '#EF4444' }}
        >
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

  const [drivers, setDrivers]     = useState<Driver2026[]>([])
  const [hasPitData, setHasPitData] = useState(true)
  const [detectedScLap, setDetectedScLap] = useState<number | null>(null)

  const [scEnabled, setScEnabled] = useState(false)
  const [scLap, setScLap]         = useState(0)
  const [scSliderMin, setScSliderMin] = useState(1)
  const [scSliderMax, setScSliderMax] = useState(60)

  const [pitEnabled, setPitEnabled]       = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [pitDelta, setPitDelta]           = useState(0)

  const cache = useRef<Map<string, RaceCache>>(new Map())
  const totalLaps = drivers[0]?.totalLaps ?? 60

  // Load race list (past 2026 races only)
  useEffect(() => {
    const today = new Date()
    fetch(`${BASE}/2026/races.json?limit=30`, { signal: AbortSignal.timeout(7000) })
      .then(r => r.json())
      .then(data => {
        const raw: any[] = (data?.MRData ?? data?.data?.MRData)?.RaceTable?.Races ?? []
        setRaces(
          raw
            .filter(r => new Date(r.date) < today)
            .map(r => ({
              round:    r.round,
              raceName: r.raceName,
              country:  r.Circuit?.Location?.country ?? '',
              date:     r.date,
            }))
        )
      })
      .catch(() => {})
      .finally(() => setRacesLoading(false))
  }, [])

  // Load race data when round changes
  useEffect(() => {
    if (!selectedRound) return

    // Reset toggles
    setScEnabled(false)
    setPitEnabled(false)
    setSelectedDriverId('')
    setPitDelta(0)

    const cached = cache.current.get(selectedRound)
    if (cached) {
      applyRaceData(cached)
      return
    }

    setDataLoading(true)
    setDrivers([])

    Promise.all([
      fetch(`${BASE}/2026/${selectedRound}/results.json`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
      fetch(`${BASE}/2026/${selectedRound}/pitstops.json?limit=200`, { signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${BASE}/2026/${selectedRound}/laps.json?limit=2000`, { signal: AbortSignal.timeout(12000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([resData, pitsData, lapsData]) => {
        const mrR  = resData?.MRData ?? resData?.data?.MRData
        const rawRes: any[]  = mrR?.RaceTable?.Races?.[0]?.Results ?? []

        const mrP  = pitsData ? (pitsData?.MRData ?? pitsData?.data?.MRData) : null
        const rawPits: any[] = mrP?.RaceTable?.Races?.[0]?.PitStops ?? []

        const mrL  = lapsData ? (lapsData?.MRData ?? lapsData?.data?.MRData) : null
        const rawLaps: any[] = mrL?.RaceTable?.Races?.[0]?.Laps ?? []

        const pits: PitStop2026[] = rawPits.map((p: any) => ({
          driverId: p.driverId,
          lap: parseInt(p.lap) || 1,
        }))

        const lapEntries: LapEntry[] = []
        for (const lapObj of rawLaps) {
          const lapNum = parseInt(lapObj.number)
          for (const timing of (lapObj.Timings ?? [])) {
            const s = parseTime(timing.time)
            if (s > 0) lapEntries.push({ driverId: timing.driverId, lap: lapNum, seconds: s })
          }
        }

        const results: Driver2026[] = rawRes.map((r: any) => {
          const tl = parseInt(r.laps) || 60
          const driverId = r.Driver?.driverId ?? ''
          return {
            position:      parseInt(r.position),
            driverId,
            code:          r.Driver?.code ?? r.Driver?.familyName?.slice(0, 3).toUpperCase() ?? '???',
            name:          `${r.Driver?.givenName ?? ''} ${r.Driver?.familyName ?? ''}`.trim(),
            constructorId: r.Constructor?.constructorId ?? 'unknown',
            lastPitLap:    getLastPitLap(pits, driverId, tl),
            totalLaps:     tl,
          }
        })

        const entry: RaceCache = { results, pitStops: pits, lapData: lapEntries }
        cache.current.set(selectedRound, entry)
        applyRaceData(entry)
      })
      .catch(() => {})
      .finally(() => setDataLoading(false))
  }, [selectedRound])

  function applyRaceData(data: RaceCache) {
    setDrivers(data.results)
    setHasPitData(data.pitStops.length > 0)

    const tl  = data.results[0]?.totalLaps ?? 60
    const sc  = detectScLap(data.lapData, tl)
    setDetectedScLap(sc)

    const defaultLap = sc ?? Math.round(tl / 2)
    setScLap(defaultLap)
    setScSliderMin(Math.max(1, defaultLap - 10))
    setScSliderMax(Math.min(tl - 1, defaultLap + 10))
  }

  // Simulation
  const active    = scEnabled || pitEnabled
  const simResults: SimDriver[] | null = active && drivers.length > 0
    ? runSimulation(drivers, scEnabled, scLap, pitEnabled, selectedDriverId, pitDelta)
    : null

  const selectedDriver = drivers.find(d => d.driverId === selectedDriverId) ?? null

  // Summary text
  let summaryText = ''
  if (simResults) {
    const parts: string[] = []
    if (scEnabled) parts.push(`SC Runde ${scLap}`)
    if (pitEnabled && selectedDriver && pitDelta !== 0) {
      parts.push(`${selectedDriver.code} ${Math.abs(pitDelta)} Runden ${pitDelta < 0 ? 'früher' : 'später'}`)
    }
    if (parts.length > 0) {
      const movers = simResults.filter(d => d.simPosition !== d.position)
      const desc = movers.slice(0, 4).map(d => {
        const delta = d.position - d.simPosition
        return `${d.code} ${delta > 0 ? `+${delta}` : `${delta}`}`
      }).join(', ')
      summaryText = `Mit ${parts.join(' + ')}: ${desc || 'Keine Positionsänderungen'}`
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Section header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1 h-8 rounded-full" style={{ background: '#EF4444' }} />
        <h2 className="text-2xl font-black tracking-tight text-[#F1F5F9] uppercase">
          2026{' '}
          <span style={{ color: '#EF4444' }}>What-If Live</span>
        </h2>
        <span
          className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm border"
          style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}
        >
          2026
        </span>
      </div>
      <p className="text-sm text-[#94A3B8] ml-4 pl-3 border-l border-[#1E293B] mb-8">
        Simuliere SC-Phasen und Boxenstopps für 2026er Rennen mit echten Daten.
      </p>

      {/* Race selector */}
      <div className="mb-8">
        <label className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] block mb-3">
          Rennen wählen
        </label>
        {racesLoading ? (
          <Spinner />
        ) : races.length === 0 ? (
          <p className="text-sm text-[#475569] italic">Noch keine gefahrenen Rennen in der 2026er Saison.</p>
        ) : (
          <select
            value={selectedRound}
            onChange={e => setSelectedRound(e.target.value)}
            className="w-full px-3 py-2.5 text-sm font-medium rounded-sm border focus:outline-none"
            style={{
              background:  '#111827',
              color:       '#F1F5F9',
              borderColor: selectedRound ? 'rgba(239,68,68,0.4)' : '#1E293B',
            }}
          >
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
            <Toggle checked={scEnabled} onChange={setScEnabled} label="Safety Car anpassen" />
            <Toggle
              checked={pitEnabled}
              onChange={v => {
                setPitEnabled(v)
                if (!v) { setSelectedDriverId(''); setPitDelta(0) }
              }}
              label="Boxenstopp anpassen"
            />
          </div>

          {/* SC panel */}
          {scEnabled && (
            <div className="mb-6 p-5 bg-[#111827] border border-[#1E293B] rounded-sm">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8]">Safety Car</p>
                {detectedScLap ? (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-sm font-bold"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}
                  >
                    Erkannt auf Runde {detectedScLap}
                  </span>
                ) : (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-sm font-bold"
                    style={{ background: 'rgba(234,179,8,0.12)', color: '#EAB308', border: '1px solid rgba(234,179,8,0.3)' }}
                  >
                    Kein SC erkannt – manuell setzen
                  </span>
                )}
              </div>

              <Slider
                value={scLap}
                min={scSliderMin}
                max={scSliderMax}
                onChange={setScLap}
                label="SC-Zeitpunkt"
                formatValue={v => `Runde ${v}`}
              />

              {/* SC effect legend */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.entries(SC_META) as [NonNullable<ScEffect>, typeof SC_META[NonNullable<ScEffect>]][]).map(([key, meta]) => (
                  <div key={key} className="px-2 py-1.5 rounded-sm border text-[10px] font-bold" style={{ background: meta.bg, borderColor: meta.border, color: meta.text }}>
                    {key === 'free'    && '< 0 Runden'}
                    {key === 'lost'    && '0–3 Runden'}
                    {key === 'neutral' && '4–12 Runden'}
                    {key === 'cheap'   && '> 12 Runden'}
                    <span className="block font-normal opacity-80">{meta.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pit panel */}
          {pitEnabled && (
            <div className="mb-6 p-5 bg-[#111827] border border-[#1E293B] rounded-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-4">Boxenstopp</p>

              {!hasPitData ? (
                <p className="text-sm text-[#475569]">
                  Boxenstopp-Simulation nicht verfügbar (keine Pit-Daten für dieses Rennen).
                </p>
              ) : (
                <>
                  <div className="mb-5">
                    <label className="text-xs font-medium text-[#94A3B8] block mb-2">Fahrer wählen</label>
                    <select
                      value={selectedDriverId}
                      onChange={e => { setSelectedDriverId(e.target.value); setPitDelta(0) }}
                      className="w-full px-3 py-2.5 text-sm font-medium rounded-sm border focus:outline-none"
                      style={{
                        background:  '#0A0E1A',
                        color:       '#F1F5F9',
                        borderColor: selectedDriverId ? 'rgba(56,189,248,0.4)' : '#1E293B',
                      }}
                    >
                      <option value="">Fahrer wählen…</option>
                      {drivers.map(d => (
                        <option key={d.driverId} value={d.driverId}>
                          P{d.position} — {d.name} (Stopp: Runde {d.lastPitLap})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedDriverId && (
                    <Slider
                      value={pitDelta}
                      min={-5}
                      max={5}
                      onChange={setPitDelta}
                      label="Stopp verschieben"
                      formatValue={v =>
                        v === 0 ? 'Kein Unterschied'
                        : v < 0 ? `${Math.abs(v)} Runden früher`
                        : `${v} Runden später`
                      }
                    />
                  )}

                  {!selectedDriverId && (
                    <p className="text-sm text-[#1E293B] italic">Wähle einen Fahrer um den Stopp anzupassen.</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Prompt when no toggle active */}
          {!active && (
            <div
              className="p-8 rounded-sm border text-center"
              style={{ background: '#111827', borderColor: '#1E293B' }}
            >
              <p className="text-sm text-[#475569]">
                Aktiviere einen Toggle oben um die Simulation zu starten.
              </p>
            </div>
          )}

          {/* Results */}
          {simResults && (
            <div>
              {/* Summary */}
              {summaryText && (
                <div
                  className="mb-4 px-4 py-3 rounded-sm border text-sm text-[#F1F5F9] leading-relaxed"
                  style={{ background: 'rgba(56,189,248,0.04)', borderColor: 'rgba(56,189,248,0.2)' }}
                >
                  {summaryText}
                </div>
              )}

              {/* Side-by-side table */}
              <div className="grid grid-cols-2 gap-4">

                {/* Real */}
                <div className="bg-[#111827] border border-[#1E293B] rounded-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#1E293B] bg-[#0A0E1A]">
                    <p className="text-xs font-black tracking-widest uppercase text-[#94A3B8]">Real</p>
                  </div>
                  <div className="p-3 space-y-1">
                    {drivers.slice(0, 10).map(d => (
                      <LiveDriverRow
                        key={d.driverId}
                        driver={d}
                        position={d.position}
                        timeDelta={null}
                        scEffect={null}
                        highlight={d.driverId === selectedDriverId}
                      />
                    ))}
                  </div>
                </div>

                {/* Simulated */}
                <div
                  className="rounded-sm overflow-hidden border"
                  style={{ borderColor: 'rgba(56,189,248,0.3)', background: '#111827' }}
                >
                  <div
                    className="px-4 py-2.5 border-b flex items-center gap-2"
                    style={{ borderColor: 'rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.06)' }}
                  >
                    <p className="text-xs font-black tracking-widest uppercase" style={{ color: '#38BDF8' }}>
                      Simuliert
                    </p>
                  </div>
                  <div className="p-3 space-y-1">
                    {simResults.slice(0, 10).map(d => (
                      <LiveDriverRow
                        key={d.driverId}
                        driver={d}
                        position={d.simPosition}
                        timeDelta={d.timeDelta !== 0 ? d.timeDelta : null}
                        scEffect={d.scEffect}
                        highlight={d.driverId === selectedDriverId}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-[#1E293B] mt-3 text-right italic">
                Vereinfachte Simulation – basiert auf realen Pit-Daten aus 2026.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
