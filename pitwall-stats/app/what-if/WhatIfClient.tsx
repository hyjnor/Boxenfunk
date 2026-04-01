'use client'

import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Race {
  round: string
  raceName: string
  circuitName: string
  locality: string
  country: string
  date: string
}

interface DriverResult {
  position: number
  driverId: string
  code: string
  name: string
  constructorId: string
  constructorName: string
  laps: number
}

interface PitStop {
  driverId: string
  lap: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEASONS = ['2025', '2024', '2023', '2022', '2021', '2020']

const TEAM_COLORS: Record<string, string> = {
  red_bull:      '#3671C6',
  ferrari:       '#E8002D',
  mercedes:      '#27F4D2',
  mclaren:       '#FF8000',
  aston_martin:  '#229971',
  alpine:        '#FF87BC',
  williams:      '#64C4FF',
  alphatauri:    '#6692FF',
  rb:            '#6692FF',
  sauber:        '#52E252',
  alfa:          '#B12039',
  haas:          '#B6BABD',
  renault:       '#FFF500',
  racing_point:  '#F596C8',
  force_india:   '#F596C8',
  toro_rosso:    '#6692FF',
}

const FLAG_EMOJI: Record<string, string> = {
  Bahrain: '🇧🇭', 'Saudi Arabia': '🇸🇦', Australia: '🇦🇺', Japan: '🇯🇵',
  China: '🇨🇳', Italy: '🇮🇹', Monaco: '🇲🇨', Canada: '🇨🇦',
  Spain: '🇪🇸', Austria: '🇦🇹', UK: '🇬🇧', Hungary: '🇭🇺', Belgium: '🇧🇪',
  Netherlands: '🇳🇱', Singapore: '🇸🇬', Mexico: '🇲🇽', Brazil: '🇧🇷',
  'United States': '🇺🇸', Qatar: '🇶🇦', Azerbaijan: '🇦🇿', 'Abu Dhabi': '🇦🇪',
  USA: '🇺🇸',
}

const BASE = 'https://api.jolpi.ca/ergast/f1'

// ── Simulation ────────────────────────────────────────────────────────────────

/** Earlier pit = fresher tyres = gains positions. Later = loses. */
function getPositionDelta(adj: number): number {
  if (adj <= -5) return -2
  if (adj <= -3) return -1
  if (adj >= 5)  return  2
  if (adj >= 3)  return  1
  return 0
}

function simulate(top10: DriverResult[], code: string, adj: number): DriverResult[] {
  const list = top10.map((d, i) => ({ ...d, position: i + 1 }))
  if (!adj) return list

  const idx = list.findIndex(d => d.code === code)
  if (idx === -1) return list

  const delta  = getPositionDelta(adj)
  const newIdx = Math.max(0, Math.min(list.length - 1, idx + delta))
  if (newIdx === idx) return list

  const sim = [...list]
  const [driver] = sim.splice(idx, 1)
  sim.splice(newIdx, 0, driver)
  return sim.map((d, i) => ({ ...d, position: i + 1 }))
}

function findPitLap(pitStops: PitStop[], driverId: string, totalLaps: number): number {
  const first = pitStops.filter(p => p.driverId === driverId).sort((a, b) => a.lap - b.lap)[0]
  return first ? first.lap : Math.max(1, Math.round(totalLaps * 0.38))
}

// ── Shared UI pieces ──────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const labels = ['Season', 'Race', 'What-If']
  return (
    <div className="flex items-center mb-10">
      {labels.map((label, i) => {
        const n     = i + 1
        const done  = n < step
        const active = n === step
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all"
                style={{
                  background: active ? '#38BDF8' : done ? '#0EA5E9' : '#1E293B',
                  color: active || done ? '#0A0E1A' : '#94A3B8',
                  border: `2px solid ${active ? '#38BDF8' : done ? '#0EA5E9' : '#1E293B'}`,
                }}
              >
                {done ? '✓' : n}
              </div>
              <span
                className="text-[10px] font-bold tracking-widest uppercase mt-1.5"
                style={{ color: active ? '#38BDF8' : done ? '#64748B' : '#1E293B' }}
              >
                {label}
              </span>
            </div>
            {i < 2 && (
              <div
                className="h-px mb-5 mx-2"
                style={{ width: 64, background: n < step ? '#0EA5E9' : '#1E293B' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase mb-6 transition-colors"
      style={{ color: '#94A3B8' }}
      onMouseEnter={e => (e.currentTarget.style.color = '#38BDF8')}
      onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
    >
      ← Back
    </button>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#38BDF8', borderTopColor: 'transparent' }} />
    </div>
  )
}

function RaceCardSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-24 rounded-sm animate-pulse" style={{ background: '#1E293B' }} />
      ))}
    </div>
  )
}

function ErrorBox({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-sm p-8 text-center">
      <p className="text-[#94A3B8] text-sm mb-4">{msg}</p>
      <button
        onClick={onRetry}
        className="px-5 py-2 text-sm font-bold tracking-wide rounded-sm"
        style={{ background: '#38BDF8', color: '#0A0E1A' }}
      >
        Retry
      </button>
    </div>
  )
}

// ── Driver result row ─────────────────────────────────────────────────────────

function DriverRow({
  driver,
  actualPos,
  highlight,
  showDelta,
}: {
  driver: DriverResult
  actualPos?: number
  highlight: boolean
  showDelta: boolean
}) {
  const color = TEAM_COLORS[driver.constructorId] ?? '#38BDF8'
  const delta = showDelta && actualPos != null ? actualPos - driver.position : 0

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-sm transition-colors"
      style={{
        background: highlight ? (showDelta ? 'rgba(56,189,248,0.1)' : `${color}12`) : 'transparent',
        border: `1px solid ${highlight ? (showDelta ? 'rgba(56,189,248,0.35)' : `${color}40`) : 'transparent'}`,
      }}
    >
      <span
        className="text-xs font-black tabular-nums w-5 text-right shrink-0"
        style={{ color: driver.position <= 3 ? '#38BDF8' : '#94A3B8' }}
      >
        {driver.position}
      </span>
      <span
        className="text-xs font-black px-1.5 py-0.5 rounded-sm shrink-0"
        style={{ color: highlight && showDelta ? '#38BDF8' : color, background: highlight && showDelta ? 'rgba(56,189,248,0.2)' : `${color}20` }}
      >
        {driver.code}
      </span>
      <span className="text-xs text-[#F1F5F9] flex-1 truncate">
        {driver.name.split(' ').slice(1).join(' ')}
      </span>
      {showDelta && delta !== 0 && (
        <span
          className="text-[10px] font-black shrink-0"
          style={{ color: delta > 0 ? '#34d399' : '#f87171' }}
        >
          {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
        </span>
      )}
    </div>
  )
}

// ── Main client component ─────────────────────────────────────────────────────

export default function WhatIfClient() {
  const [step, setStep]                 = useState<1 | 2 | 3>(1)
  const [selectedSeason, setSelectedSeason] = useState('')
  const [races, setRaces]               = useState<Race[]>([])
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)
  const [results, setResults]           = useState<DriverResult[]>([])
  const [pitStops, setPitStops]         = useState<PitStop[]>([])
  const [selectedCode, setSelectedCode] = useState('')
  const [pitAdj, setPitAdj]             = useState(0)
  const [copied, setCopied]             = useState(false)

  const [racesLoading, setRacesLoading]     = useState(false)
  const [racesError, setRacesError]         = useState(false)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [resultsError, setResultsError]     = useState(false)

  // ── Fetchers ────────────────────────────────────────────────────────────────

  async function fetchRaces(season: string) {
    setRacesLoading(true)
    setRacesError(false)
    try {
      const res  = await fetch(`${BASE}/${season}/races.json`, { signal: AbortSignal.timeout(7000) })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const raw: any[] = (json?.MRData ?? json?.data?.MRData)?.RaceTable?.Races ?? []
      if (!raw.length) throw new Error()
      setRaces(raw.map((r: any) => ({
        round:       r.round,
        raceName:    r.raceName,
        circuitName: r.Circuit?.circuitName ?? '',
        locality:    r.Circuit?.Location?.locality ?? '',
        country:     r.Circuit?.Location?.country ?? '',
        date:        r.date,
      })))
      setStep(2)
    } catch {
      setRacesError(true)
    } finally {
      setRacesLoading(false)
    }
  }

  async function fetchRaceData(season: string, round: string) {
    setResultsLoading(true)
    setResultsError(false)
    try {
      const [resR, resP] = await Promise.all([
        fetch(`${BASE}/${season}/${round}/results.json`, { signal: AbortSignal.timeout(7000) }),
        fetch(`${BASE}/${season}/${round}/pitstops.json?limit=200`, { signal: AbortSignal.timeout(7000) }),
      ])
      if (!resR.ok) throw new Error()

      const [jsonR, jsonP] = await Promise.all([
        resR.json(),
        resP.ok ? resP.json() : Promise.resolve(null),
      ])

      const mrR    = jsonR?.MRData ?? jsonR?.data?.MRData
      const rawRes: any[] = mrR?.RaceTable?.Races?.[0]?.Results ?? []
      if (!rawRes.length) throw new Error()

      setResults(rawRes.map((r: any) => ({
        position:        parseInt(r.position),
        driverId:        r.Driver?.driverId ?? '',
        code:            r.Driver?.code ?? r.Driver?.familyName?.slice(0, 3).toUpperCase() ?? '???',
        name:            `${r.Driver?.givenName} ${r.Driver?.familyName}`,
        constructorId:   r.Constructor?.constructorId ?? 'unknown',
        constructorName: r.Constructor?.name ?? 'Unknown',
        laps:            parseInt(r.laps) || 50,
      })))

      const mrP    = jsonP ? (jsonP?.MRData ?? jsonP?.data?.MRData) : null
      const rawPits: any[] = mrP?.RaceTable?.Races?.[0]?.PitStops ?? []
      setPitStops(rawPits.map((p: any) => ({
        driverId: p.driverId,
        lap:      parseInt(p.lap) || 1,
      })))

      setStep(3)
    } catch {
      setResultsError(true)
    } finally {
      setResultsLoading(false)
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSeasonSelect(season: string) {
    setSelectedSeason(season)
    setRaces([])
    setSelectedRace(null)
    setResults([])
    setPitStops([])
    setSelectedCode('')
    setPitAdj(0)
    fetchRaces(season)
  }

  function handleRaceSelect(race: Race) {
    setSelectedRace(race)
    setResults([])
    setPitStops([])
    setSelectedCode('')
    setPitAdj(0)
    fetchRaceData(selectedSeason, race.round)
  }

  function handleBack() {
    if (step === 2) { setStep(1); setRacesError(false) }
    if (step === 3) { setStep(2); setResultsError(false) }
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const top10           = results.slice(0, 10)
  const selectedDriver  = top10.find(d => d.code === selectedCode) ?? null
  const totalLaps       = top10[0]?.laps ?? 60
  const actualPitLap    = selectedDriver
    ? findPitLap(pitStops, selectedDriver.driverId, totalLaps)
    : 20
  const whatIfPitLap    = Math.max(1, Math.min(totalLaps - 1, actualPitLap + pitAdj))
  const simResults      = simulate(top10, selectedCode, pitAdj)
  const simDriver       = simResults.find(d => d.code === selectedCode) ?? null
  const posChange       = selectedDriver && simDriver
    ? selectedDriver.position - simDriver.position
    : 0

  const adjWord  = pitAdj < 0 ? 'earlier' : 'later'
  const shareText = selectedDriver && selectedRace && pitAdj !== 0
    ? `What if ${selectedDriver.name} pitted ${adjWord} (lap ${whatIfPitLap} instead of lap ${actualPitLap}) at the ${selectedRace.raceName}? They could have finished P${simDriver?.position ?? selectedDriver.position}! #Boxenfunk`
    : ''

  function handleCopy() {
    if (!shareText) return
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        input[type='range'] { -webkit-appearance: none; appearance: none; }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none; width: 16px; height: 16px;
          border-radius: 50%; background: #38BDF8; cursor: pointer;
          border: 2px solid #0A0E1A; box-shadow: 0 0 6px rgba(56,189,248,0.4);
        }
        input[type='range']::-moz-range-thumb {
          width: 16px; height: 16px; border-radius: 50%;
          background: #38BDF8; cursor: pointer;
          border: 2px solid #0A0E1A; box-shadow: 0 0 6px rgba(56,189,248,0.4);
        }
      `}</style>

      <StepIndicator step={step} />

      {/* ── STEP 1: Season ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <p className="text-sm text-[#94A3B8] mb-6 ml-4 pl-3 border-l border-[#1E293B]">
            Choose a season to replay.
          </p>
          {racesLoading ? (
            <Spinner />
          ) : racesError ? (
            <ErrorBox msg="Could not load race calendar." onRetry={() => fetchRaces(selectedSeason)} />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {SEASONS.map(season => (
                <button
                  key={season}
                  onClick={() => handleSeasonSelect(season)}
                  className="group relative flex flex-col items-center justify-center p-6 rounded-sm border overflow-hidden transition-all"
                  style={{ background: '#111827', borderColor: '#1E293B' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(56,189,248,0.5)'
                    e.currentTarget.style.background  = 'rgba(56,189,248,0.04)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#1E293B'
                    e.currentTarget.style.background  = '#111827'
                  }}
                >
                  <span className="text-2xl font-black text-[#F1F5F9] group-hover:text-[#38BDF8] transition-colors">
                    {season}
                  </span>
                  <span className="text-[10px] tracking-widest uppercase text-[#94A3B8] mt-1">Season</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Race ───────────────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <BackButton onClick={handleBack} />
          <div className="flex items-center gap-3 mb-6">
            <span
              className="text-lg font-black"
              style={{ color: '#38BDF8' }}
            >
              {selectedSeason}
            </span>
            <span style={{ color: '#1E293B' }}>·</span>
            <span className="text-sm text-[#94A3B8]">Select a race to replay</span>
          </div>

          {racesLoading ? (
            <RaceCardSkeleton />
          ) : racesError ? (
            <ErrorBox msg="Could not load races." onRetry={() => fetchRaces(selectedSeason)} />
          ) : (
            <>
              {resultsLoading && (
                <div className="mb-4 flex items-center gap-2 text-xs text-[#94A3B8]">
                  <div className="w-4 h-4 border border-t-transparent rounded-full animate-spin" style={{ borderColor: '#38BDF8', borderTopColor: 'transparent' }} />
                  Loading race data…
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {races.map(race => {
                  const flag    = FLAG_EMOJI[race.country] ?? '🏁'
                  const dateStr = new Date(race.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  return (
                    <button
                      key={race.round}
                      onClick={() => handleRaceSelect(race)}
                      disabled={resultsLoading}
                      className="group relative text-left p-4 rounded-sm border overflow-hidden transition-all"
                      style={{ background: '#111827', borderColor: '#1E293B', opacity: resultsLoading ? 0.5 : 1 }}
                      onMouseEnter={e => {
                        if (!resultsLoading) {
                          e.currentTarget.style.borderColor = 'rgba(56,189,248,0.45)'
                          e.currentTarget.style.background  = 'rgba(56,189,248,0.04)'
                        }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#1E293B'
                        e.currentTarget.style.background  = '#111827'
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#94A3B8]">R{race.round}</span>
                        <span className="text-xl">{flag}</span>
                      </div>
                      <p className="text-sm font-black text-[#F1F5F9] leading-tight mb-1 group-hover:text-[#38BDF8] transition-colors">
                        {race.raceName.replace(' Grand Prix', ' GP')}
                      </p>
                      <p className="text-[10px] text-[#94A3B8]">{dateStr}</p>
                    </button>
                  )
                })}
              </div>
              {resultsError && (
                <div className="mt-4">
                  <ErrorBox
                    msg="Could not load race results."
                    onRetry={() => selectedRace && fetchRaceData(selectedSeason, selectedRace.round)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── STEP 3: Scenario ───────────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <BackButton onClick={handleBack} />

          {resultsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-sm animate-pulse" style={{ background: '#1E293B' }} />
              ))}
            </div>
          ) : resultsError ? (
            <ErrorBox
              msg="Could not load race results."
              onRetry={() => selectedRace && fetchRaceData(selectedSeason, selectedRace.round)}
            />
          ) : (
            <>
              {/* Race header */}
              <div
                className="mb-8 p-5 rounded-sm border"
                style={{ background: '#111827', borderColor: '#1E293B', borderLeft: '4px solid #38BDF8' }}
              >
                <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-0.5">
                  {selectedSeason} · Round {selectedRace?.round}
                </p>
                <h3 className="text-xl font-black text-[#F1F5F9]">{selectedRace?.raceName}</h3>
                <p className="text-sm text-[#94A3B8] mt-0.5">
                  {selectedRace?.circuitName} — {FLAG_EMOJI[selectedRace?.country ?? ''] ?? ''} {selectedRace?.country}
                </p>
              </div>

              {/* Actual top 5 */}
              <div className="mb-8">
                <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-3">
                  Actual race result — top 5
                </p>
                <div className="bg-[#111827] border border-[#1E293B] rounded-sm p-3 space-y-1.5">
                  {top10.slice(0, 5).map(d => (
                    <DriverRow
                      key={d.code}
                      driver={d}
                      highlight={d.code === selectedCode}
                      showDelta={false}
                    />
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="mb-8 p-5 bg-[#111827] border border-[#1E293B] rounded-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-5">
                  Configure your what-if scenario
                </p>

                {/* Driver selector */}
                <div className="mb-5">
                  <label className="text-xs font-medium text-[#94A3B8] block mb-2">
                    Which driver's strategy do you want to change?
                  </label>
                  <select
                    value={selectedCode}
                    onChange={e => { setSelectedCode(e.target.value); setPitAdj(0) }}
                    className="w-full px-3 py-2.5 text-sm font-medium rounded-sm border focus:outline-none transition-colors"
                    style={{
                      background: '#0A0E1A',
                      color: '#F1F5F9',
                      borderColor: selectedCode ? 'rgba(56,189,248,0.4)' : '#1E293B',
                    }}
                  >
                    <option value="">Select a driver…</option>
                    {top10.map(d => (
                      <option key={d.code} value={d.code}>
                        P{d.position} — {d.name} ({d.constructorName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pit lap + slider */}
                {selectedCode && selectedDriver && (
                  <>
                    <div className="mb-5 grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-sm border border-[#1E293B] bg-[#0A0E1A]">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-[#94A3B8] mb-1">
                          Actual pit lap
                        </p>
                        <p className="text-xl font-black text-[#F1F5F9] tabular-nums">
                          Lap {actualPitLap}
                        </p>
                      </div>
                      <div
                        className="p-3 rounded-sm border"
                        style={{ borderColor: pitAdj !== 0 ? 'rgba(56,189,248,0.35)' : '#1E293B', background: pitAdj !== 0 ? 'rgba(56,189,248,0.05)' : '#0A0E1A' }}
                      >
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: pitAdj !== 0 ? '#38BDF8' : '#94A3B8' }}>
                          What-if pit lap
                        </p>
                        <p className="text-xl font-black tabular-nums" style={{ color: pitAdj !== 0 ? '#38BDF8' : '#1E293B' }}>
                          Lap {whatIfPitLap}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-[#94A3B8]">
                          Adjust pit stop timing
                        </label>
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-sm"
                          style={{
                            color:      pitAdj < 0 ? '#34d399' : pitAdj > 0 ? '#f87171' : '#94A3B8',
                            background: pitAdj < 0 ? 'rgba(52,211,153,0.1)' : pitAdj > 0 ? 'rgba(248,113,113,0.1)' : '#1E293B',
                          }}
                        >
                          {pitAdj === 0
                            ? 'No change'
                            : pitAdj < 0
                            ? `${Math.abs(pitAdj)} lap${Math.abs(pitAdj) > 1 ? 's' : ''} earlier`
                            : `${pitAdj} lap${pitAdj > 1 ? 's' : ''} later`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-5}
                        max={5}
                        step={1}
                        value={pitAdj}
                        onChange={e => setPitAdj(parseInt(e.target.value))}
                        className="w-full h-1.5 rounded-full cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #0EA5E9 0%, #38BDF8 ${((pitAdj + 5) / 10) * 100}%, #1E293B ${((pitAdj + 5) / 10) * 100}%, #1E293B 100%)`,
                        }}
                      />
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] text-[#94A3B8]">−5 laps (earlier)</span>
                        <span className="text-[10px] text-[#94A3B8]">0</span>
                        <span className="text-[10px] text-[#94A3B8]">+5 laps (later)</span>
                      </div>
                    </div>

                    {/* Narrative */}
                    {pitAdj !== 0 && (
                      <div
                        className="mt-5 p-4 rounded-sm border"
                        style={{ background: 'rgba(56,189,248,0.04)', borderColor: 'rgba(56,189,248,0.2)' }}
                      >
                        <p className="text-sm text-[#F1F5F9] leading-relaxed">
                          What if{' '}
                          <span className="font-black" style={{ color: '#38BDF8' }}>{selectedDriver.name}</span>
                          {' '}pitted on{' '}
                          <span className="font-black">lap {whatIfPitLap}</span>
                          {' '}instead of{' '}
                          <span className="font-black">lap {actualPitLap}</span>?
                          {posChange !== 0 && (
                            <span
                              className="ml-2 font-black"
                              style={{ color: posChange > 0 ? '#34d399' : '#f87171' }}
                            >
                              {posChange > 0 ? `↑ Gains ${posChange} position${posChange > 1 ? 's' : ''}` : `↓ Loses ${Math.abs(posChange)} position${Math.abs(posChange) > 1 ? 's' : ''}`}
                            </span>
                          )}
                          {posChange === 0 && (
                            <span className="ml-2 text-[#94A3B8] text-xs">No net position change</span>
                          )}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Prompt when nothing selected */}
                {!selectedCode && (
                  <p className="text-sm text-[#1E293B] italic">
                    Select a driver above to begin.
                  </p>
                )}
              </div>

              {/* Side-by-side comparison */}
              {selectedCode && pitAdj !== 0 && (
                <div className="mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Actual */}
                    <div className="bg-[#111827] border border-[#1E293B] rounded-sm overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-[#1E293B] bg-[#0A0E1A]">
                        <p className="text-xs font-black tracking-widest uppercase text-[#94A3B8]">
                          Actual Result
                        </p>
                      </div>
                      <div className="p-3 space-y-1">
                        {top10.slice(0, 5).map(d => (
                          <DriverRow
                            key={d.code}
                            driver={d}
                            highlight={d.code === selectedCode}
                            showDelta={false}
                          />
                        ))}
                      </div>
                    </div>

                    {/* What-If */}
                    <div
                      className="rounded-sm overflow-hidden border"
                      style={{ borderColor: 'rgba(56,189,248,0.3)', background: '#111827' }}
                    >
                      <div
                        className="px-4 py-2.5 border-b flex items-center gap-2"
                        style={{ borderColor: 'rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.06)' }}
                      >
                        <p className="text-xs font-black tracking-widest uppercase" style={{ color: '#38BDF8' }}>
                          What-If Result
                        </p>
                        {posChange !== 0 && (
                          <span
                            className="text-[10px] font-black px-1.5 py-0.5 rounded-sm ml-auto"
                            style={{
                              color:      posChange > 0 ? '#34d399' : '#f87171',
                              background: posChange > 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                            }}
                          >
                            {posChange > 0 ? `↑${posChange}` : `↓${Math.abs(posChange)}`}
                          </span>
                        )}
                      </div>
                      <div className="p-3 space-y-1">
                        {simResults.slice(0, 5).map(d => {
                          const actualPos = top10.find(r => r.code === d.code)?.position ?? d.position
                          return (
                            <DriverRow
                              key={d.code}
                              driver={d}
                              actualPos={actualPos}
                              highlight={d.code === selectedCode}
                              showDelta={true}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-[#1E293B] mt-3 text-right italic">
                    Simplified simulation — earlier stops = fresher tyres = position gains; later = tyre degradation = position loss.
                  </p>
                </div>
              )}

              {/* Prompt: driver selected, no adjustment yet */}
              {selectedCode && pitAdj === 0 && (
                <div
                  className="mb-8 p-6 rounded-sm border text-center"
                  style={{ background: '#111827', borderColor: '#1E293B' }}
                >
                  <p className="text-sm text-[#94A3B8]">
                    Move the slider to adjust the pit stop timing and see a simulated result.
                  </p>
                </div>
              )}

              {/* Share */}
              {selectedCode && pitAdj !== 0 && (
                <div className="p-5 bg-[#111827] border border-[#1E293B] rounded-sm">
                  <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-3">
                    Share your scenario
                  </p>
                  <div
                    className="rounded-sm px-4 py-3 mb-3 border"
                    style={{ background: '#0A0E1A', borderColor: '#1E293B' }}
                  >
                    <p className="text-sm text-[#F1F5F9] leading-relaxed">{shareText}</p>
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
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
