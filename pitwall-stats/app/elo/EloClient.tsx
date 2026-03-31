'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import StatCard from '@/components/StatCard'
import HelmetAvatar, { getTeamColor } from '@/app/components/HelmetAvatar'
import type { EloDriver } from './page'

const TOP3_BG: Record<number, string> = {
  1: 'rgba(56,189,248,0.10)',
  2: 'rgba(56,189,248,0.06)',
  3: 'rgba(56,189,248,0.03)',
}

interface TooltipProps {
  active?: boolean
  payload?: { value: number; payload: EloDriver }[]
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-sm px-3 py-2 text-xs shadow-lg">
      <p className="font-black text-[#F1F5F9] mb-1">{d.name}</p>
      <p className="text-[#38BDF8] font-bold">ELO {d.elo.toLocaleString()}</p>
      <p className="text-[#94A3B8]">{d.team}</p>
    </div>
  )
}

export default function EloClient({ drivers, season = 2026 }: { drivers: EloDriver[]; season?: number }) {
  const top = drivers[0]
  const top10 = drivers.slice(0, 10)
  const avgElo = Math.round(drivers.reduce((s, d) => s + d.elo, 0) / drivers.length)

  return (
    <>
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Top Rated"
          value={top.code}
          subtitle={top.name}
          accentColor="#38BDF8"
        />
        <StatCard
          label="Highest Elo"
          value={top.elo.toLocaleString()}
          trend="up"
          trendValue={`${top.wins} wins`}
          accentColor="#38BDF8"
        />
        <StatCard
          label="Field Average"
          value={avgElo.toLocaleString()}
          subtitle={`${season} grid`}
          accentColor="#0EA5E9"
        />
        <StatCard
          label="Season"
          value={String(season)}
          subtitle={`${drivers.length} drivers rated`}
          accentColor={getTeamColor(top.team)}
        />
      </div>

      {/* Explanation */}
      <div className="bg-surface border-l-2 border-[#38BDF8] border border-muted rounded-sm px-5 py-3 mb-8 text-sm text-[#94A3B8] leading-relaxed">
        <span className="font-bold text-[#F1F5F9]">How Elo is calculated: </span>
        Ratings start at 1,300 and scale with season points (up to +550) and wins (+7 per win).
        Elo updates after each race based on finishing positions relative to pre-race expectations.
        Top-tier drivers converge toward 1,800–1,900; midfield 1,400–1,600.
      </div>

      {/* Chart + table layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-8 items-start">
        {/* Bar chart — top 10 */}
        <div className="xl:col-span-2 bg-surface border border-muted rounded-sm p-5">
          <p className="text-xs font-bold tracking-widest uppercase text-[#94A3B8] mb-4">
            Top 10 by Elo
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={top10} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <XAxis
                type="number"
                domain={[1200, 'dataMax + 20']}
                tick={{ fill: '#94A3B8', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#1E293B' }}
              />
              <YAxis
                type="category"
                dataKey="code"
                tick={{ fill: '#F1F5F9', fontSize: 11, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(56,189,248,0.05)' }} />
              <ReferenceLine x={1500} stroke="#1E293B" strokeDasharray="3 3" />
              <Bar dataKey="elo" radius={[0, 2, 2, 0]} maxBarSize={18}>
                {top10.map((d) => (
                  <Cell
                    key={d.code}
                    fill={getTeamColor(d.team)}
                    fillOpacity={0.9}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leaderboard table */}
        <div className="xl:col-span-3 bg-surface border border-muted rounded-sm overflow-hidden">
          <div className="grid grid-cols-[2.5rem_1fr_auto_auto_auto] text-xs font-bold tracking-widest uppercase text-[#94A3B8] px-4 py-3 border-b border-muted bg-[#0A0E1A]">
            <span>#</span>
            <span>Driver</span>
            <span className="text-right pr-6">Elo</span>
            <span className="text-right pr-6">Pts</span>
            <span className="text-right">Wins</span>
          </div>

          <div className="divide-y divide-muted">
            {drivers.map((d) => {
              const color = getTeamColor(d.team)
              const isTop3 = d.rank <= 3
              return (
                <div
                  key={d.code}
                  className="grid grid-cols-[2.5rem_1fr_auto_auto_auto] items-center px-4 py-3 transition-colors hover:bg-muted/40"
                  style={{
                    background: TOP3_BG[d.rank] ?? 'transparent',
                    borderLeft: isTop3 ? `3px solid ${color}` : '3px solid transparent',
                  }}
                >
                  {/* Rank */}
                  <span
                    className="text-sm font-black tabular-nums"
                    style={{ color: isTop3 ? '#38BDF8' : '#94A3B8' }}
                  >
                    {d.rank}
                  </span>

                  {/* Driver + team */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <HelmetAvatar teamName={d.team} driverCode={d.code} size={32} />
                      <span className="text-sm font-semibold text-[#F1F5F9] truncate hidden sm:block">
                        {d.name}
                      </span>
                    </div>
                    <span className="text-xs text-[#94A3B8] mt-0.5 block">{d.team}</span>
                  </div>

                  {/* Elo */}
                  <span
                    className="text-sm font-black tabular-nums text-right pr-6"
                    style={{ color: isTop3 ? '#38BDF8' : '#F1F5F9' }}
                  >
                    {d.elo.toLocaleString()}
                  </span>

                  {/* Points */}
                  <span className="text-sm font-medium text-[#94A3B8] tabular-nums text-right pr-6">
                    {d.points}
                  </span>

                  {/* Wins */}
                  <span className="text-sm font-semibold text-[#F1F5F9] tabular-nums text-right">
                    {d.wins > 0 ? (
                      <span style={{ color: '#34d399' }}>{d.wins}</span>
                    ) : (
                      <span className="text-[#1E293B]">—</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
