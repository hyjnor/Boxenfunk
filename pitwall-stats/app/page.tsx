import Link from 'next/link'
import SectionHeader from '@/components/SectionHeader'
import TrackHero from '@/app/components/TrackHero'
import RaceInfoBadge from '@/app/components/RaceInfoBadge'

const features = [
  {
    href: '/elo',
    title: 'Elo Ratings',
    description: 'Driver performance ratings calculated from head-to-head qualifying and race results across the entire F1 grid.',
    icon: '◈',
    tag: 'RATINGS',
  },
  {
    href: '/duels',
    title: 'Teammate Duels',
    description: 'Head-to-head stats between teammates. See who dominates in qualifying, races, and points across every season.',
    icon: '⊕',
    tag: 'MATCHUPS',
  },
  {
    href: '/race-day',
    title: 'Race Day Companion',
    description: 'Live race data, strategy breakdowns, pit stop windows, and lap-by-lap analysis during Grand Prix weekends.',
    icon: '◉',
    tag: 'LIVE',
  },
  {
    href: '/what-if',
    title: 'What-If Rennmaschine',
    description: 'Replay historical F1 races and change one pit stop decision to see how the result could have changed.',
    icon: '⟁',
    tag: 'SIMULATOR',
  },
  {
    href: '/drivers',
    title: 'Driver Career Path',
    description: 'Explore every driver\'s championship history — season by season, from debut to today.',
    icon: '◎',
    tag: 'CAREERS',
  },
]

export default function Home() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section
        style={{
          position: 'relative',
          minHeight: '560px',
          overflow: 'hidden',
          background: '#0A0E1A',
        }}
      >
        {/* Track — slightly inset so it appears a bit smaller */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          <TrackHero />
        </div>

        {/* Gradient left — semi-transparent so track bleeds through behind text */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '65%',
            background: 'linear-gradient(to right, rgba(10,14,26,0.92) 25%, rgba(10,14,26,0.55) 55%, transparent 100%)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />

        {/* Fade top — blends track into navbar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '25%',
            background: 'linear-gradient(to bottom, #0A0E1A 0%, transparent 100%)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />

        {/* Fade bottom — blends track into stats strip */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '25%',
            background: 'linear-gradient(to top, #0A0E1A 0%, transparent 100%)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />

        {/* Text content — aligned with max-w-7xl sections */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ position: 'relative', zIndex: 3, paddingTop: 80, paddingBottom: 80 }}>

          {/* Full-width top row: label left, badge right */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8', animation: 'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#38BDF8', textTransform: 'uppercase' }}>
                F1 Analytics Platform
              </span>
            </div>
            <RaceInfoBadge />
          </div>

        <div style={{ maxWidth: '480px' }}>
          <h1 style={{ fontSize: 'clamp(56px, 7vw, 96px)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', textTransform: 'uppercase', color: '#F1F5F9', marginBottom: 16 }}>
            BOXEN
            <br />
            <span style={{ color: '#38BDF8' }}>FUNK</span>
          </h1>

          <p style={{ fontSize: 18, color: '#94A3B8', fontWeight: 500, marginBottom: 40, maxWidth: 340 }}>
            F1 data. No fluff.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link
              href="/elo"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#38BDF8', color: '#0A0E1A', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 2, textDecoration: 'none' }}
            >
              Explore Elo Rankings
              <span>→</span>
            </Link>
            <Link
              href="/duels"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', border: '1px solid #1E293B', color: '#F1F5F9', fontSize: 13, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 2, textDecoration: 'none' }}
            >
              View Duels
            </Link>
          </div>
        </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="border-y border-muted bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 divide-x divide-muted">
            {[
              { label: 'Drivers Rated', value: '20' },
              { label: 'Season', value: '2026' },
              { label: 'Data Points', value: '50K+' },
            ].map((stat) => (
              <div key={stat.label} className="py-5 px-6 text-center">
                <p className="text-xl font-black text-primary tabular-nums">{stat.value}</p>
                <p className="text-xs font-medium tracking-widest uppercase text-text-secondary mt-0.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <SectionHeader
          title="What's Inside"
          subtitle="Five tools built for F1 fans who want the numbers, not the noise."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="group bg-surface border border-muted rounded-sm p-6 hover:border-primary/40 transition-all hover:bg-muted/30 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary/30 transition-all" />

              <div className="flex items-start justify-between mb-6">
                <span className="text-2xl text-primary">{feature.icon}</span>
                <span className="text-xs font-bold tracking-widest text-text-secondary border border-muted px-2 py-0.5 rounded-sm">
                  {feature.tag}
                </span>
              </div>

              <h3 className="text-lg font-black tracking-tight text-text-base uppercase mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {feature.description}
              </p>

              <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Explore</span>
                <span>→</span>
              </div>

              <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-muted mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-between">
          <span className="text-xs font-black tracking-widest text-primary uppercase">BOXENFUNK</span>
          <span className="text-xs text-text-secondary">F1 data. No fluff.</span>
        </div>
      </footer>
    </div>
  )
}
