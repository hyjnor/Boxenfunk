import SectionHeader from '@/components/SectionHeader'
import DuelsClient from './DuelsClient'

export interface TeamDuel {
  team: string
  teamId: string
  color: string
  driver1: { name: string; code: string; wins: number }
  driver2: { name: string; code: string; wins: number }
  total: number
  closeness: number // 1.0 = perfectly even, 0.0 = total domination
}

const TEAM_COLORS: Record<string, string> = {
  'Red Bull':        '#3671C6',
  'Red Bull Racing': '#3671C6',
  Ferrari:           '#E8002D',
  Mercedes:          '#27F4D2',
  McLaren:           '#FF8000',
  'Aston Martin':    '#229971',
  'Alpine F1 Team':  '#FF87BC',
  Alpine:            '#FF87BC',
  Williams:          '#64C4FF',
  'RB F1 Team':      '#6692FF',
  AlphaTauri:        '#6692FF',
  'Kick Sauber':     '#52E252',
  Sauber:            '#52E252',
  'Haas F1 Team':    '#B6BABD',
  Haas:              '#B6BABD',
}

const TEAM_IDS: Record<string, string> = {
  'Red Bull Racing': 'red_bull',
  Ferrari:           'ferrari',
  Mercedes:          'mercedes',
  McLaren:           'mclaren',
  'Aston Martin':    'aston_martin',
  'Alpine F1 Team':  'alpine',
  Williams:          'williams',
  'RB F1 Team':      'rb',
  'Kick Sauber':     'sauber',
  'Haas F1 Team':    'haas',
}

// 2026 fallback — approximate early-season estimates
const FALLBACK_DUELS: TeamDuel[] = [
  {
    team: 'McLaren', teamId: 'mclaren', color: '#FF8000',
    driver1: { name: 'Lando Norris',      code: 'NOR', wins: 2 },
    driver2: { name: 'Oscar Piastri',     code: 'PIA', wins: 2 },
    total: 4, closeness: 1.0,
  },
  {
    team: 'Ferrari', teamId: 'ferrari', color: '#E8002D',
    driver1: { name: 'Charles Leclerc',   code: 'LEC', wins: 3 },
    driver2: { name: 'Lewis Hamilton',    code: 'HAM', wins: 1 },
    total: 4, closeness: 0.75,
  },
  {
    team: 'Red Bull Racing', teamId: 'red_bull', color: '#3671C6',
    driver1: { name: 'Max Verstappen',    code: 'VER', wins: 3 },
    driver2: { name: 'Yuki Tsunoda',      code: 'TSU', wins: 1 },
    total: 4, closeness: 0.75,
  },
  {
    team: 'Mercedes', teamId: 'mercedes', color: '#27F4D2',
    driver1: { name: 'George Russell',    code: 'RUS', wins: 3 },
    driver2: { name: 'Kimi Antonelli',    code: 'ANT', wins: 1 },
    total: 4, closeness: 0.75,
  },
  {
    team: 'Aston Martin', teamId: 'aston_martin', color: '#229971',
    driver1: { name: 'Fernando Alonso',   code: 'ALO', wins: 2 },
    driver2: { name: 'Lance Stroll',      code: 'STR', wins: 2 },
    total: 4, closeness: 1.0,
  },
  {
    team: 'Alpine F1 Team', teamId: 'alpine', color: '#FF87BC',
    driver1: { name: 'Pierre Gasly',      code: 'GAS', wins: 2 },
    driver2: { name: 'Jack Doohan',       code: 'DOO', wins: 2 },
    total: 4, closeness: 1.0,
  },
  {
    team: 'Williams', teamId: 'williams', color: '#64C4FF',
    driver1: { name: 'Carlos Sainz',      code: 'SAI', wins: 3 },
    driver2: { name: 'Alexander Albon',   code: 'ALB', wins: 1 },
    total: 4, closeness: 0.75,
  },
  {
    team: 'RB F1 Team', teamId: 'rb', color: '#6692FF',
    driver1: { name: 'Isack Hadjar',      code: 'HAD', wins: 2 },
    driver2: { name: 'Liam Lawson',       code: 'LAW', wins: 2 },
    total: 4, closeness: 1.0,
  },
  {
    team: 'Kick Sauber', teamId: 'sauber', color: '#52E252',
    driver1: { name: 'Nico Hulkenberg',   code: 'HUL', wins: 3 },
    driver2: { name: 'Gabriel Bortoleto', code: 'BOR', wins: 1 },
    total: 4, closeness: 0.75,
  },
  {
    team: 'Haas F1 Team', teamId: 'haas', color: '#B6BABD',
    driver1: { name: 'Oliver Bearman',    code: 'BEA', wins: 3 },
    driver2: { name: 'Esteban Ocon',      code: 'OCO', wins: 1 },
    total: 4, closeness: 0.75,
  },
]

function processQualifyingData(races: any[]): TeamDuel[] {
  const acc: Record<string, Record<string, { name: string; code: string; wins: number; appearances: number }>> = {}

  for (const race of races) {
    const byTeam: Record<string, { driverId: string; name: string; code: string; pos: number }[]> = {}

    for (const r of race.QualifyingResults ?? []) {
      const team: string = r.Constructor?.name ?? 'Unknown'
      const driverId: string = r.Driver?.driverId ?? 'unknown'
      const pos = parseInt(r.position) || 99
      const name = `${r.Driver?.givenName} ${r.Driver?.familyName}`
      const code = r.Driver?.code ?? name.split(' ')[1]?.slice(0, 3).toUpperCase() ?? driverId.slice(0, 3).toUpperCase()

      if (!byTeam[team]) byTeam[team] = []
      byTeam[team].push({ driverId, name, code, pos })
    }

    for (const [team, drivers] of Object.entries(byTeam)) {
      if (drivers.length !== 2) continue
      const [winner, loser] = [...drivers].sort((a, b) => a.pos - b.pos)

      if (!acc[team]) acc[team] = {}
      for (const d of [winner, loser]) {
        if (!acc[team][d.driverId]) {
          acc[team][d.driverId] = { name: d.name, code: d.code, wins: 0, appearances: 0 }
        }
        acc[team][d.driverId].appearances++
      }
      acc[team][winner.driverId].wins++
    }
  }

  const duels: TeamDuel[] = []
  for (const [team, driversMap] of Object.entries(acc)) {
    const drivers = Object.entries(driversMap)
      .sort((a, b) => b[1].appearances - a[1].appearances)
      .slice(0, 2)
    if (drivers.length < 2) continue

    const [, d1] = drivers[0]
    const [, d2] = drivers[1]
    const total = d1.wins + d2.wins
    if (total === 0) continue

    const diff = Math.abs(d1.wins - d2.wins)
    const closeness = 1 - diff / total

    duels.push({
      team,
      teamId: TEAM_IDS[team] ?? team.toLowerCase().replace(/\s/g, '_'),
      color: TEAM_COLORS[team] ?? '#38BDF8',
      driver1: { name: d1.name, code: d1.code, wins: d1.wins },
      driver2: { name: d2.name, code: d2.code, wins: d2.wins },
      total,
      closeness,
    })
  }

  return duels.sort((a, b) => b.closeness - a.closeness)
}

async function getDuels(): Promise<{ duels: TeamDuel[]; live: boolean }> {
  try {
    const res = await fetch('https://api.jolpi.ca/ergast/f1/2026/qualifying.json?limit=500', {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) throw new Error('non-2xx')
    const json = await res.json()
    const mrData = json?.MRData ?? json?.data?.MRData
    const races = mrData?.RaceTable?.Races
    if (!races?.length) throw new Error('empty')

    const duels = processQualifyingData(races)
    if (!duels.length) throw new Error('no duels parsed')
    return { duels, live: true }
  } catch {
    return { duels: FALLBACK_DUELS.sort((a, b) => b.closeness - a.closeness), live: false }
  }
}

export default async function DuelsPage() {
  const { duels, live } = await getDuels()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <SectionHeader
          title="Teammate Duels"
          subtitle="2026 qualifying head-to-head — who outqualified their teammate more this season."
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
      <DuelsClient duels={duels} season={2026} />
    </div>
  )
}
