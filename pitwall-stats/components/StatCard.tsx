import { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  subtitle?: string
  accentColor?: string
}

export default function StatCard({
  label,
  value,
  trend,
  trendValue,
  subtitle,
  accentColor = '#38BDF8',
}: StatCardProps) {
  const trendIcon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'
  const trendColor =
    trend === 'up'
      ? 'text-emerald-400'
      : trend === 'down'
      ? 'text-red-400'
      : 'text-text-secondary'

  return (
    <div
      className="bg-surface border border-muted rounded-sm p-5 relative overflow-hidden group hover:border-primary/40 transition-colors"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top left, ${accentColor}08 0%, transparent 60%)`,
        }}
      />
      <p className="text-xs font-medium tracking-widest uppercase text-text-secondary mb-2">
        {label}
      </p>
      <p className="text-3xl font-black text-text-base tabular-nums leading-none">
        {value}
      </p>
      {(trendValue || subtitle) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && trendValue && (
            <span className={`text-xs font-semibold ${trendColor}`}>
              {trendIcon} {trendValue}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-text-secondary">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  )
}
