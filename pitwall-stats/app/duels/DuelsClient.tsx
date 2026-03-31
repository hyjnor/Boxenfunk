'use client'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import StatCard from '@/components/StatCard'
import HelmetAvatar from '@/app/components/HelmetAvatar'
import type { TeamDuel } from './page'

// ── Mini bar chart tooltip ────────────────────────────────────────────────────
function MiniTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-sm px-2 py-1 text-xs shadow-lg">
      <span className="font-bold text-[#F1F5F9]">{payload[0].payload.name}: </span>
      <span className="text-[#38BDF8]">{payload[0].value}</span>
    </div>
  )
}

// ── Individual team duel card ─────────────────────────────────────────────────
function DuelCard({ duel }: { duel: TeamDuel }) {
  const { driver1: d1, driver2: d2, total, color, closeness } = duel
  const d1Pct = Math.round((d1.wins / total) * 100)
  const d2Pct = 100 - d1Pct
  const isDominant = closeness < 0.5
  const chartData = [
    { name: d1.code, value: d1.wins },
    { name: d2.code, value: d2.wins },
  ]

  return (
    <div
      className="bg-surface border border-muted rounded-sm overflow-hidden relative group hover:border-opacity-60 transition-all"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      {/* Subtle hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${color}0A 0%, transparent 55%)` }}
      />

      <div className="p-5 relative">
        {/* Team header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8]">
              {duel.team}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {isDominant ? (
                <span className="text-xs text-red-400 font-semibold">Dominant</span>
              ) : closeness >= 0.9 ? (
                <span className="text-xs text-emerald-400 font-semibold">Very close</span>
              ) : (
                <span className="text-xs text-yellow-400 font-semibold">Competitive</span>
              )}
              <span className="text-xs text-[#1E293B]">·</span>
              <span className="text-xs text-[#94A3B8]">{total} rounds</span>
            </div>
          </div>

          {/* Mini bar chart */}
          <div className="w-20 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <Tooltip content={<MiniTooltip />} cursor={false} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  <Cell fill={color} fillOpacity={0.9} />
                  <Cell fill="#38BDF8" fillOpacity={0.7} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Drivers */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-left flex flex-col items-start gap-1">
            <HelmetAvatar teamName={duel.team} driverCode={d1.code} size={32} />
            <p className="text-[11px] text-[#94A3B8] truncate max-w-[80px]">{d1.name.split(' ')[1]}</p>
          </div>

          <div className="text-center flex-1 px-2">
            <p className="text-lg font-black text-[#F1F5F9] tabular-nums leading-none">
              {d1.wins}
              <span className="text-[#1E293B] mx-1">–</span>
              {d2.wins}
            </p>
            <p className="text-[10px] text-[#94A3B8] font-medium mt-0.5">qualifying score</p>
          </div>

          <div className="text-right flex flex-col items-end gap-1">
            <HelmetAvatar teamName={duel.team} driverCode={d2.code} size={32} />
            <p className="text-[11px] text-[#94A3B8] truncate max-w-[80px]">{d2.name.split(' ')[1]}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-[#0A0E1A] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${d1Pct}%`,
              background: `linear-gradient(to right, ${color}, ${color}99)`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] font-bold" style={{ color }}>{d1Pct}%</span>
          <span className="text-[10px] font-bold text-[#38BDF8]">{d2Pct}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Main client component ─────────────────────────────────────────────────────
export default function DuelsClient({ duels, season = 2026 }: { duels: TeamDuel[]; season?: number }) {
  const closest = duels[0]
  const mostDominant = [...duels].sort((a, b) => a.closeness - b.closeness)[0]
  const totalRounds = duels[0]?.total ?? 24

  // Dominant driver per team for the "most dominant" stat
  const dom = mostDominant
    ? (mostDominant.driver1.wins > mostDominant.driver2.wins ? mostDominant.driver1 : mostDominant.driver2)
    : null

  // Summary bar chart data (all teams by d1 win %)
  const summaryData = duels.map((d) => ({
    team: d.team.replace(' F1 Team', '').replace(' Racing', ''),
    d1: d.driver1.wins,
    d2: d.driver2.wins,
    color: d.color,
    d1Code: d.driver1.code,
    d2Code: d.driver2.code,
  }))

  return (
    <>
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Teams Tracked"    value={duels.length} subtitle={`${season} grid`} />
        <StatCard label="Qualifying Rounds" value={totalRounds}  subtitle={`${season} season`} accentColor="#0EA5E9" />
        <StatCard
          label="Closest Battle"
          value={closest?.team.replace(' F1 Team', '').replace(' Racing', '') ?? '—'}
          subtitle={`${closest?.driver1.wins}–${closest?.driver2.wins}`}
          accentColor="#34d399"
        />
        <StatCard
          label="Most Dominant"
          value={dom?.code ?? '—'}
          subtitle={`${dom?.wins ?? 0}–${dom ? (mostDominant!.total - dom.wins) : 0} vs teammate`}
          accentColor="#f87171"
          trend={dom ? 'up' : undefined}
        />
      </div>

      {/* Summary chart */}
      <div className="bg-surface border border-muted rounded-sm p-5 mb-8">
        <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-4">
          Qualifying split — all teams (sorted by closeness)
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={summaryData} margin={{ left: 0, right: 0, top: 0, bottom: 24 }} barCategoryGap="30%">
            <XAxis
              dataKey="team"
              tick={{ fill: '#94A3B8', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#1E293B' }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const entry = summaryData.find((d) => d.team === label)
                return (
                  <div className="bg-[#111827] border border-[#1E293B] rounded-sm px-3 py-2 text-xs shadow-lg">
                    <p className="font-black text-[#F1F5F9] mb-1">{label}</p>
                    <p style={{ color: entry?.color ?? '#38BDF8' }}>
                      {entry?.d1Code}: {payload[0]?.value}
                    </p>
                    <p className="text-[#38BDF8]">
                      {entry?.d2Code}: {payload[1]?.value}
                    </p>
                  </div>
                )
              }}
              cursor={{ fill: 'rgba(56,189,248,0.04)' }}
            />
            <Bar dataKey="d1" stackId="a" isAnimationActive={false}>
              {summaryData.map((d, i) => (
                <Cell key={i} fill={d.color} fillOpacity={0.85} />
              ))}
            </Bar>
            <Bar dataKey="d2" stackId="a" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {summaryData.map((_, i) => (
                <Cell key={i} fill="#38BDF8" fillOpacity={0.55} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-6 mt-1 justify-end">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-[#38BDF8] opacity-60" />
            <span className="text-[10px] text-[#94A3B8]">Driver 2</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ background: '#FF8000', opacity: 0.85 }} />
            <span className="text-[10px] text-[#94A3B8]">Driver 1 (team color)</span>
          </div>
        </div>
      </div>

      {/* Duel cards grid — sorted by closeness (tightest first) */}
      <div className="mb-4 flex items-center gap-3">
        <div className="w-1 h-4 bg-primary rounded-full" />
        <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8]">
          Sorted by battle intensity — closest at top
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {duels.map((duel) => (
          <DuelCard key={duel.team} duel={duel} />
        ))}
      </div>
    </>
  )
}
