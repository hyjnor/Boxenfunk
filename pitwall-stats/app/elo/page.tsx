import SectionHeader from '@/components/SectionHeader'
import EloClient from './EloClient'

export interface EloDriver {
  rank: number
  name: string
  code: string
  team: string
  teamId: string
  elo: number
  points: number
  wins: number
}

// Fallback — reflects approximate 2026 pre-season expectations
const FALLBACK_STANDINGS = [
  { name: 'Max Verstappen',    code: 'VER', team: 'Red Bull Racing',  teamId: 'red_bull',     points: 50, wins: 2 },
  { name: 'Lando Norris',      code: 'NOR', team: 'McLaren',          teamId: 'mclaren',      points: 43, wins: 1 },
  { name: 'Charles Leclerc',   code: 'LEC', team: 'Ferrari',          teamId: 'ferrari',      points: 37, wins: 1 },
  { name: 'Oscar Piastri',     code: 'PIA', team: 'McLaren',          teamId: 'mclaren',      points: 30, wins: 0 },
  { name: 'George Russell',    code: 'RUS', team: 'Mercedes',         teamId: 'mercedes',     points: 26, wins: 0 },
  { name: 'Carlos Sainz',      code: 'SAI', team: 'Williams',         teamId: 'williams',     points: 22, wins: 0 },
  { name: 'Lewis Hamilton',    code: 'HAM', team: 'Ferrari',          teamId: 'ferrari',      points: 18, wins: 0 },
  { name: 'Fernando Alonso',   code: 'ALO', team: 'Aston Martin',     teamId: 'aston_martin', points: 14, wins: 0 },
  { name: 'Kimi Antonelli',    code: 'ANT', team: 'Mercedes',         teamId: 'mercedes',     points: 10, wins: 0 },
  { name: 'Nico Hulkenberg',   code: 'HUL', team: 'Kick Sauber',      teamId: 'sauber',       points: 8,  wins: 0 },
  { name: 'Lance Stroll',      code: 'STR', team: 'Aston Martin',     teamId: 'aston_martin', points: 6,  wins: 0 },
  { name: 'Pierre Gasly',      code: 'GAS', team: 'Alpine F1 Team',   teamId: 'alpine',       points: 4,  wins: 0 },
  { name: 'Yuki Tsunoda',      code: 'TSU', team: 'Red Bull Racing',  teamId: 'red_bull',     points: 4,  wins: 0 },
  { name: 'Alexander Albon',   code: 'ALB', team: 'Williams',         teamId: 'williams',     points: 2,  wins: 0 },
  { name: 'Oliver Bearman',    code: 'BEA', team: 'Haas F1 Team',     teamId: 'haas',         points: 2,  wins: 0 },
  { name: 'Esteban Ocon',      code: 'OCO', team: 'Haas F1 Team',     teamId: 'haas',         points: 1,  wins: 0 },
  { name: 'Jack Doohan',       code: 'DOO', team: 'Alpine F1 Team',   teamId: 'alpine',       points: 0,  wins: 0 },
  { name: 'Isack Hadjar',      code: 'HAD', team: 'RB F1 Team',       teamId: 'rb',           points: 0,  wins: 0 },
  { name: 'Liam Lawson',       code: 'LAW', team: 'RB F1 Team',       teamId: 'rb',           points: 0,  wins: 0 },
  { name: 'Gabriel Bortoleto', code: 'BOR', team: 'Kick Sauber',      teamId: 'sauber',       points: 0,  wins: 0 },
]

function computeElo(raw: { name: string; code: string; team: string; teamId: string; points: number; wins: number }[]): EloDriver[] {
  const sorted = [...raw].sort((a, b) => b.points - a.points)
  const maxPts = sorted[0]?.points || 1
  return sorted.map((d, i) => ({
    rank: i + 1,
    ...d,
    elo: Math.round(1300 + (d.points / maxPts) * 550 + d.wins * 7),
  }))
}

async function getStandings(): Promise<{ drivers: EloDriver[]; live: boolean }> {
  try {
    const res = await fetch('https://api.jolpi.ca/ergast/f1/2026/driverStandings.json', {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) throw new Error('non-2xx')
    const json = await res.json()
    // Jolpica returns MRData at root
    const mrData = json?.MRData ?? json?.data?.MRData
    const raw = mrData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings
    if (!raw?.length) throw new Error('empty')

    const seen = new Set<string>()
    const parsed = raw
      .filter((s: any) => {
        const id = s.Driver?.driverId
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
      })
      .map((s: any) => ({
        name: `${s.Driver.givenName} ${s.Driver.familyName}`,
        code: s.Driver.code ?? s.Driver.familyName.slice(0, 3).toUpperCase(),
        team: s.Constructors?.[0]?.name ?? 'Unknown',
        teamId: s.Constructors?.[0]?.constructorId ?? 'unknown',
        points: parseFloat(s.points),
        wins: parseInt(s.wins),
      }))
    return { drivers: computeElo(parsed), live: true }
  } catch {
    return { drivers: computeElo(FALLBACK_STANDINGS), live: false }
  }
}

export default async function EloPage() {
  const { drivers, live } = await getStandings()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <SectionHeader
          title="Boxenfunk Elo"
          subtitle="Driver performance ratings derived from 2026 season results — points tally, wins, and relative dominance."
          className="mb-0 flex-1"
        />
        <span
          className="mt-1 flex items-center gap-1.5 text-xs font-bold tracking-widest px-2.5 py-1 rounded-sm border shrink-0"
          style={
            live
              ? { color: '#34d399', borderColor: '#34d39940', background: '#34d39910' }
              : { color: '#94A3B8', borderColor: '#1E293B', background: '#111827' }
          }
        >
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: live ? '#34d399' : '#94A3B8' }} />
          {live ? 'LIVE DATA' : 'FALLBACK DATA'}
        </span>
      </div>
      <EloClient drivers={drivers} season={2026} />
    </div>
  )
}
