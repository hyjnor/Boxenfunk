'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import HelmetAvatar from '@/app/components/HelmetAvatar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Driver {
  driverId: string
  code: string
  givenName: string
  familyName: string
  nationality: string
  dateOfBirth: string
  permanentNumber?: string
}

interface DriverCard extends Driver {
  team: string
  teamColor: string
  position: number
  points: number
}

interface CareerSeason {
  year: number
  team: string
  position: number
  points: number
  wins: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAREER_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

const TEAM_COLORS: Record<string, string> = {
  red_bull: '#3671C6',
  ferrari: '#E8002D',
  mercedes: '#27F4D2',
  mclaren: '#FF8000',
  aston_martin: '#229971',
  alpine: '#FF87BC',
  williams: '#64C4FF',
  haas: '#B6BABD',
  rb: '#6692FF',
  kick_sauber: '#52E252',
  sauber: '#52E252',
}

const NATIONALITY_FLAGS: Record<string, string> = {
  British: '🇬🇧',
  Dutch: '🇳🇱',
  Monegasque: '🇲🇨',
  Spanish: '🇪🇸',
  Australian: '🇦🇺',
  German: '🇩🇪',
  Mexican: '🇲🇽',
  Finnish: '🇫🇮',
  French: '🇫🇷',
  Canadian: '🇨🇦',
  Thai: '🇹🇭',
  Danish: '🇩🇰',
  Italian: '🇮🇹',
  Chinese: '🇨🇳',
  American: '🇺🇸',
  Argentine: '🇦🇷',
  Brazilian: '🇧🇷',
  'New Zealander': '🇳🇿',
  Japanese: '🇯🇵',
  Azerbaijani: '🇦🇿',
  Swedish: '🇸🇪',
  Swiss: '🇨🇭',
}

function nationalityFlag(nationality: string | undefined): string {
  return nationality ? (NATIONALITY_FLAGS[nationality] ?? '🏁') : '🏁'
}

function teamColor(constructorId: string): string {
  return TEAM_COLORS[constructorId.toLowerCase()] ?? '#38BDF8'
}

function shortTeam(name: string): string {
  return name.replace('Formula One Team', '').replace('F1 Team', '').trim()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0 }
          100% { background-position: 400px 0 }
        }
        .shimmer {
          background: linear-gradient(90deg, #1E293B 25%, #263348 50%, #1E293B 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s infinite;
        }
      `}</style>
      <div className={`shimmer rounded-sm ${className}`} />
    </>
  )
}

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid #1E293B',
          borderTop: '3px solid #38BDF8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p className="text-xs text-[#64748B]">Loading career data across seasons…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: CareerSeason }>
}

function CareerTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      style={{
        background: '#111827',
        border: '1px solid #1E293B',
        borderRadius: 4,
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      <p style={{ color: '#94A3B8', marginBottom: 4 }}>{d.year}</p>
      <p style={{ color: '#F1F5F9', fontWeight: 700 }}>P{d.position}</p>
      <p style={{ color: '#94A3B8' }}>{shortTeam(d.team)}</p>
      <p style={{ color: '#38BDF8' }}>
        {d.points} pts{d.wins > 0 ? ` · ${d.wins}W` : ''}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DriversClient() {
  const [drivers, setDrivers] = useState<DriverCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<DriverCard | null>(null)
  const [career, setCareer] = useState<CareerSeason[]>([])
  const [careerLoading, setCareerLoading] = useState(false)
  const [careerError, setCareerError] = useState('')

  // ── Fetch 2026 driver grid ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [driversRes, standingsRes] = await Promise.all([
          fetch('https://api.jolpi.ca/ergast/f1/2026/drivers.json', {
            signal: AbortSignal.timeout(7000),
          }),
          fetch('https://api.jolpi.ca/ergast/f1/2026/driverStandings.json', {
            signal: AbortSignal.timeout(7000),
          }),
        ])

        const driversJson = await driversRes.json()
        const standingsJson = await standingsRes.json()

        const driversMRData = driversJson?.data?.MRData ?? driversJson?.MRData
        const standingsMRData = standingsJson?.data?.MRData ?? standingsJson?.MRData

        const rawDrivers: Driver[] = driversMRData?.DriverTable?.Drivers ?? []
        const rawStandings =
          standingsMRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []

        const standingsMap = new Map<
          string,
          { position: number; points: number; team: string; teamColor: string }
        >()
        const seenIds = new Set<string>()
        for (const s of rawStandings) {
          const id = s.Driver?.driverId
          if (!id || seenIds.has(id)) continue
          seenIds.add(id)
          const constructorId = s.Constructors?.[0]?.constructorId ?? ''
          standingsMap.set(id, {
            position: parseInt(s.position) || 99,
            points: parseFloat(s.points) || 0,
            team: s.Constructors?.[0]?.name ?? 'Unknown',
            teamColor: teamColor(constructorId),
          })
        }

        const cards: DriverCard[] = rawDrivers.map((d) => {
          const standings = standingsMap.get(d.driverId)
          return {
            ...d,
            team: standings?.team ?? 'Unknown',
            teamColor: standings?.teamColor ?? '#38BDF8',
            position: standings?.position ?? 99,
            points: standings?.points ?? 0,
          }
        })

        cards.sort((a, b) => a.position - b.position)
        if (cards.length === 0) throw new Error('No drivers found')
        setDrivers(cards)
      } catch {
        setDrivers(FALLBACK_DRIVERS)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Fetch career by scanning each season in parallel ────────────────────────
  useEffect(() => {
    if (!selected) return
    setCareer([])
    setCareerLoading(true)
    setCareerError('')

    async function loadCareer() {
      try {
        const results = await Promise.allSettled(
          CAREER_YEARS.map((year) =>
            fetch(
              `https://api.jolpi.ca/ergast/f1/${year}/driverStandings.json?limit=30`,
              { signal: AbortSignal.timeout(10000) }
            ).then((r) => r.json())
          )
        )

        const seasons: CareerSeason[] = []

        results.forEach((result, idx) => {
          if (result.status !== 'fulfilled') return
          const json = result.value
          const mrdata = json?.data?.MRData ?? json?.MRData
          const driverStandings: any[] =
            mrdata?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []

          const entry = driverStandings.find(
            (s: any) => s.Driver?.driverId === selected!.driverId
          )
          if (!entry) return

          seasons.push({
            year: CAREER_YEARS[idx],
            team: entry.Constructors?.[0]?.name ?? 'Unknown',
            position: parseInt(entry.position) || 99,
            points: parseFloat(entry.points) || 0,
            wins: parseInt(entry.wins) || 0,
          })
        })

        seasons.sort((a, b) => a.year - b.year)
        setCareer(seasons)
      } catch {
        setCareerError('Could not load career data.')
      } finally {
        setCareerLoading(false)
      }
    }
    loadCareer()
  }, [selected])

  const filtered = drivers.filter((d) => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      (d.code ?? '').toLowerCase().includes(q) ||
      (d.team ?? '').toLowerCase().includes(q) ||
      (d.nationality ?? '').toLowerCase().includes(q) ||
      (d.givenName ?? '').toLowerCase().includes(q) ||
      (d.familyName ?? '').toLowerCase().includes(q)
    )
  })

  // Career stats (computed regardless of render branch)
  const bestPosition = career.length ? Math.min(...career.map((s) => s.position)) : null
  const totalPoints = career.reduce((acc, s) => acc + s.points, 0)
  const uniqueTeams = career.length
    ? [...new Set(career.map((s) => shortTeam(s.team)))]
    : []
  const bestYear = career.find((s) => s.position === bestPosition)?.year
  const isRookie = !careerLoading && !careerError && career.length <= 1

  // ── Career view ──────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div>
        {/* Back */}
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-colors mb-8"
        >
          <span>←</span>
          <span>All Drivers</span>
        </button>

        {/* Driver header */}
        <div className="flex items-center gap-5 mb-10">
          <HelmetAvatar teamName={selected.team} driverCode={selected.code ?? selected.familyName.slice(0, 3)} size={64} />
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#F1F5F9] uppercase">
              {selected.givenName} {selected.familyName}
            </h2>
            <p className="text-sm text-[#94A3B8] mt-0.5">
              {nationalityFlag(selected.nationality)} {selected.nationality} ·{' '}
              {shortTeam(selected.team)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-black text-[#38BDF8]">
              {selected.position < 99 ? `P${selected.position}` : '—'}
            </p>
            <p className="text-xs text-[#94A3B8] tracking-widest uppercase">2026 Standing</p>
          </div>
        </div>

        {/* Career stats cards — only when we have data */}
        {!careerLoading && career.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Seasons in F1', value: String(career.length) },
              {
                label: 'Best Finish',
                value: bestPosition ? `P${bestPosition}` : '—',
                sub: bestYear ? String(bestYear) : undefined,
              },
              { label: 'Career Points', value: Math.round(totalPoints).toLocaleString() },
              { label: 'Teams', value: uniqueTeams.join(', ') || '—' },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-[#111827] border border-[#1E293B] rounded-sm p-5"
                style={{ borderLeft: `3px solid ${selected.teamColor}` }}
              >
                <p className="text-xs font-semibold tracking-widest text-[#94A3B8] uppercase mb-1">
                  {card.label}
                </p>
                <p className="text-xl font-black text-[#F1F5F9] break-words leading-tight">
                  {card.value}
                </p>
                {card.sub && (
                  <p className="text-xs text-[#94A3B8] mt-0.5">{card.sub}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Career timeline chart */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-sm p-6 mb-8">
          <h3 className="text-sm font-bold tracking-widest text-[#94A3B8] uppercase mb-6">
            Championship Position by Season
          </h3>

          {careerLoading && <Spinner />}

          {careerError && (
            <p className="text-sm text-[#94A3B8] text-center py-8">{careerError}</p>
          )}

          {/* Rookie card */}
          {isRookie && (
            <div
              className="rounded-sm p-6 text-center"
              style={{ background: selected.teamColor + '11', border: `1px solid ${selected.teamColor}44` }}
            >
              <p className="text-2xl mb-2">🏁</p>
              <p className="text-base font-black text-[#F1F5F9] uppercase tracking-tight mb-1">
                Rookie Season 2026
              </p>
              <p className="text-sm text-[#94A3B8] mb-4">
                {selected.givenName} {selected.familyName} is in their first full F1 season.
              </p>
              <div className="flex justify-center gap-8">
                <div>
                  <p className="text-xs tracking-widest text-[#64748B] uppercase mb-0.5">Position</p>
                  <p className="text-xl font-black" style={{ color: selected.teamColor }}>
                    {selected.position < 99 ? `P${selected.position}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs tracking-widest text-[#64748B] uppercase mb-0.5">Points</p>
                  <p className="text-xl font-black" style={{ color: selected.teamColor }}>
                    {selected.points}
                  </p>
                </div>
                <div>
                  <p className="text-xs tracking-widest text-[#64748B] uppercase mb-0.5">Team</p>
                  <p className="text-xl font-black" style={{ color: selected.teamColor }}>
                    {shortTeam(selected.team)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Chart — only for drivers with 2+ seasons */}
          {!careerLoading && !careerError && career.length >= 2 && (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={career} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  axisLine={{ stroke: '#1E293B' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[20, 1]}
                  reversed
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  axisLine={{ stroke: '#1E293B' }}
                  tickLine={false}
                  tickFormatter={(v) => `P${v}`}
                  width={36}
                />
                <Tooltip content={<CareerTooltip />} />
                <Line
                  type="monotone"
                  dataKey="position"
                  stroke={selected.teamColor}
                  strokeWidth={2}
                  dot={(props: any) => {
                    const isBest = props.payload.position === bestPosition
                    return (
                      <circle
                        key={props.key}
                        cx={props.cx}
                        cy={props.cy}
                        r={isBest ? 6 : 3}
                        fill={isBest ? '#FFD700' : selected.teamColor}
                        stroke={isBest ? '#FFD700' : selected.teamColor}
                        strokeWidth={isBest ? 2 : 1}
                      />
                    )
                  }}
                  activeDot={{ r: 5, fill: '#38BDF8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* No data at all */}
          {!careerLoading && !careerError && career.length === 0 && (
            <p className="text-sm text-[#64748B] text-center py-8">
              No career history found — this may be a rookie driver
            </p>
          )}
        </div>

        {/* Season history table — hide for rookies */}
        {!careerLoading && career.length >= 2 && (
          <div className="bg-[#111827] border border-[#1E293B] rounded-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1E293B]">
              <h3 className="text-sm font-bold tracking-widest text-[#94A3B8] uppercase">
                Season History
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  {['Year', 'Team', 'Position', 'Points'].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-semibold tracking-widest text-[#64748B] uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...career].reverse().map((s) => (
                  <tr
                    key={s.year}
                    className="border-b border-[#1E293B] last:border-0 hover:bg-[#1E293B]/40 transition-colors"
                  >
                    <td className="px-6 py-3 font-bold text-[#F1F5F9]">{s.year}</td>
                    <td className="px-6 py-3 text-[#94A3B8]">{shortTeam(s.team)}</td>
                    <td className="px-6 py-3">
                      <span
                        className="font-black"
                        style={{
                          color: s.position === bestPosition ? '#FFD700' : '#F1F5F9',
                        }}
                      >
                        P{s.position}
                        {s.position === bestPosition && (
                          <span
                            className="ml-1.5 text-xs font-medium"
                            style={{ color: '#FFD700' }}
                          >
                            ★ Best
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-[#94A3B8] tabular-nums">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── Driver grid view ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* Search */}
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search by name, team, or nationality…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-96 bg-[#111827] border border-[#1E293B] rounded-sm px-4 py-2.5 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/60 transition-colors"
        />
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-sm p-6 text-center text-sm text-[#94A3B8]">
          {error}
        </div>
      )}

      {/* Driver grid */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((driver) => (
              <button
                key={driver.driverId}
                onClick={() => setSelected(driver)}
                className="text-left bg-[#111827] border border-[#1E293B] rounded-sm p-4 hover:border-[#38BDF8]/40 hover:bg-[#1E293B]/40 transition-all group relative overflow-hidden"
                style={{ borderLeft: `3px solid ${driver.teamColor}` }}
              >
                <div className="flex items-center gap-3">
                  <HelmetAvatar teamName={driver.team} driverCode={driver.code ?? driver.familyName.slice(0, 3)} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-[#F1F5F9] uppercase tracking-tight truncate group-hover:text-[#38BDF8] transition-colors text-sm">
                      {driver.givenName} {driver.familyName}
                    </p>
                    <p className="text-xs text-[#94A3B8] truncate mt-0.5">
                      {nationalityFlag(driver.nationality)} {driver.nationality}
                    </p>
                    <p className="text-xs text-[#64748B] truncate mt-0.5">
                      {shortTeam(driver.team)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {driver.position < 99 ? (
                      <>
                        <p className="text-base font-black text-[#F1F5F9]">P{driver.position}</p>
                        <p className="text-xs text-[#64748B] tabular-nums">{driver.points} pts</p>
                      </>
                    ) : (
                      <p className="text-xs text-[#64748B]">—</p>
                    )}
                  </div>
                </div>
                <div
                  className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `linear-gradient(to right, transparent, ${driver.teamColor}44, transparent)`,
                  }}
                />
              </button>
            ))}
          </div>

          {filtered.length === 0 && search && (
            <p className="text-center text-sm text-[#64748B] py-16">
              No drivers match &quot;{search}&quot;
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Fallback data ─────────────────────────────────────────────────────────────

const FALLBACK_DRIVERS: DriverCard[] = [
  { driverId: 'max_verstappen', code: 'VER', givenName: 'Max', familyName: 'Verstappen', nationality: 'Dutch', dateOfBirth: '1997-09-30', team: 'Red Bull Racing', teamColor: '#3671C6', position: 1, points: 0 },
  { driverId: 'norris', code: 'NOR', givenName: 'Lando', familyName: 'Norris', nationality: 'British', dateOfBirth: '1999-11-13', team: 'McLaren', teamColor: '#FF8000', position: 2, points: 0 },
  { driverId: 'leclerc', code: 'LEC', givenName: 'Charles', familyName: 'Leclerc', nationality: 'Monegasque', dateOfBirth: '1997-10-16', team: 'Ferrari', teamColor: '#E8002D', position: 3, points: 0 },
  { driverId: 'hamilton', code: 'HAM', givenName: 'Lewis', familyName: 'Hamilton', nationality: 'British', dateOfBirth: '1985-01-07', team: 'Ferrari', teamColor: '#E8002D', position: 4, points: 0 },
  { driverId: 'russell', code: 'RUS', givenName: 'George', familyName: 'Russell', nationality: 'British', dateOfBirth: '1998-02-15', team: 'Mercedes', teamColor: '#27F4D2', position: 5, points: 0 },
  { driverId: 'antonelli', code: 'ANT', givenName: 'Andrea Kimi', familyName: 'Antonelli', nationality: 'Italian', dateOfBirth: '2006-08-25', team: 'Mercedes', teamColor: '#27F4D2', position: 6, points: 0 },
  { driverId: 'piastri', code: 'PIA', givenName: 'Oscar', familyName: 'Piastri', nationality: 'Australian', dateOfBirth: '2001-04-06', team: 'McLaren', teamColor: '#FF8000', position: 7, points: 0 },
  { driverId: 'alonso', code: 'ALO', givenName: 'Fernando', familyName: 'Alonso', nationality: 'Spanish', dateOfBirth: '1981-07-29', team: 'Aston Martin', teamColor: '#229971', position: 8, points: 0 },
  { driverId: 'sainz', code: 'SAI', givenName: 'Carlos', familyName: 'Sainz', nationality: 'Spanish', dateOfBirth: '1994-09-01', team: 'Williams', teamColor: '#64C4FF', position: 9, points: 0 },
  { driverId: 'albon', code: 'ALB', givenName: 'Alexander', familyName: 'Albon', nationality: 'Thai', dateOfBirth: '1996-03-23', team: 'Williams', teamColor: '#64C4FF', position: 10, points: 0 },
  { driverId: 'stroll', code: 'STR', givenName: 'Lance', familyName: 'Stroll', nationality: 'Canadian', dateOfBirth: '1998-10-29', team: 'Aston Martin', teamColor: '#229971', position: 11, points: 0 },
  { driverId: 'hulkenberg', code: 'HUL', givenName: 'Nico', familyName: 'Hülkenberg', nationality: 'German', dateOfBirth: '1987-08-19', team: 'Sauber', teamColor: '#52E252', position: 12, points: 0 },
  { driverId: 'gasly', code: 'GAS', givenName: 'Pierre', familyName: 'Gasly', nationality: 'French', dateOfBirth: '1996-02-07', team: 'Alpine', teamColor: '#FF87BC', position: 13, points: 0 },
  { driverId: 'ocon', code: 'OCO', givenName: 'Esteban', familyName: 'Ocon', nationality: 'French', dateOfBirth: '1996-09-17', team: 'Haas', teamColor: '#B6BABD', position: 14, points: 0 },
  { driverId: 'tsunoda', code: 'TSU', givenName: 'Yuki', familyName: 'Tsunoda', nationality: 'Japanese', dateOfBirth: '2000-05-11', team: 'RB F1 Team', teamColor: '#6692FF', position: 15, points: 0 },
  { driverId: 'lawson', code: 'LAW', givenName: 'Liam', familyName: 'Lawson', nationality: 'New Zealander', dateOfBirth: '2002-02-11', team: 'Red Bull Racing', teamColor: '#3671C6', position: 16, points: 0 },
  { driverId: 'bearman', code: 'BEA', givenName: 'Oliver', familyName: 'Bearman', nationality: 'British', dateOfBirth: '2005-05-08', team: 'Haas', teamColor: '#B6BABD', position: 17, points: 0 },
  { driverId: 'doohan', code: 'DOO', givenName: 'Jack', familyName: 'Doohan', nationality: 'Australian', dateOfBirth: '2003-07-20', team: 'Alpine', teamColor: '#FF87BC', position: 18, points: 0 },
  { driverId: 'hadjar', code: 'HAD', givenName: 'Isack', familyName: 'Hadjar', nationality: 'French', dateOfBirth: '2004-09-28', team: 'RB F1 Team', teamColor: '#6692FF', position: 19, points: 0 },
  { driverId: 'bortoleto', code: 'BOR', givenName: 'Gabriel', familyName: 'Bortoleto', nationality: 'Brazilian', dateOfBirth: '2004-10-14', team: 'Sauber', teamColor: '#52E252', position: 20, points: 0 },
]
