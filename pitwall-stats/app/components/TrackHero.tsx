'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Race → local SVG map ─────────────────────────────────────────────────────

const TRACK_MAP: Record<string, string> = {
  'Miami Grand Prix':         '/tracks/miami.svg',
  'Canadian Grand Prix':      '/tracks/canada.svg',
  'Monaco Grand Prix':        '/tracks/monaco.svg',
  'Spanish Grand Prix':       '/tracks/spain.svg',
  'Austrian Grand Prix':      '/tracks/austria.svg',
  'British Grand Prix':       '/tracks/britain.svg',
  'Belgian Grand Prix':       '/tracks/belgium.svg',
  'Hungarian Grand Prix':     '/tracks/hungary.svg',
  'Dutch Grand Prix':         '/tracks/netherlands.svg',
  'Italian Grand Prix':       '/tracks/italy.svg',
  'Azerbaijan Grand Prix':    '/tracks/azerbaijan.svg',
  'Singapore Grand Prix':     '/tracks/singapore.svg',
  'United States Grand Prix': '/tracks/usa.svg',
  'Mexico City Grand Prix':   '/tracks/mexico.svg',
  'São Paulo Grand Prix':     '/tracks/brazil.svg',
  'Las Vegas Grand Prix':     '/tracks/lasvegas.svg',
  'Qatar Grand Prix':         '/tracks/qatar.svg',
  'Abu Dhabi Grand Prix':     '/tracks/abudhabi.svg',
  'Australian Grand Prix':    '/tracks/australia.svg',
  'Chinese Grand Prix':       '/tracks/china.svg',
  'Japanese Grand Prix':      '/tracks/japan.svg',
}

// ─── SVG helpers ─────────────────────────────────────────────────────────────

interface TrackState { pathD: string; viewBox: string }

function extractLongestPath(svgText: string): TrackState | null {
  const parser = new DOMParser()
  const doc    = parser.parseFromString(svgText, 'image/svg+xml')
  const svgEl  = doc.querySelector('svg')
  if (!svgEl) return null
  const w = svgEl.getAttribute('width') ?? '500'
  const h = svgEl.getAttribute('height') ?? '500'
  const viewBox = svgEl.getAttribute('viewBox') ?? `0 0 ${w} ${h}`
  let longestD = ''
  for (const p of Array.from(doc.querySelectorAll('path'))) {
    const d = p.getAttribute('d') ?? ''
    if (d.length > longestD.length) longestD = d
  }
  return longestD ? { pathD: longestD, viewBox } : null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRAIL_LEN = 8

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrackHero({ height = '100%' }: { height?: number | string }) {
  const [track,   setTrack]   = useState<TrackState | null>(null)
  const [carPos,  setCarPos]  = useState({ x: 0, y: 0 })
  const [trail,   setTrail]   = useState<{ x: number; y: number }[]>([])
  const [isLive,  setIsLive]  = useState(false)

  const rafRef       = useRef<number>(0)
  const progressRef  = useRef(0)
  const pathRef      = useRef<SVGPathElement | null>(null)
  const totalLenRef  = useRef(0)
  const hiddenSvgRef = useRef<SVGSVGElement | null>(null)

  // ── Fetch next race, load its SVG ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res    = await fetch('https://api.jolpi.ca/ergast/f1/2026/races.json', { signal: AbortSignal.timeout(7000) })
        const json   = await res.json()
        const mrdata = json?.data?.MRData ?? json?.MRData
        const races: any[] = mrdata?.RaceTable?.Races ?? []
        const now    = new Date()
        const next   = races.find((r: any) => {
          const raceTime = new Date(`${r.date}T${r.time ?? '00:00:00Z'}`)
          const diff = raceTime.getTime() - now.getTime()
          return diff > -2 * 3_600_000
        })
        if (!next) return
        const raceTime = new Date(`${next.date}T${next.time ?? '00:00:00Z'}`)
        const diff = raceTime.getTime() - now.getTime()
        if (diff <= 0 && diff > -2 * 3_600_000) setIsLive(true)
        const svgPath = TRACK_MAP[next.raceName]
        if (!svgPath) return
        const svgRes  = await fetch(svgPath)
        if (!svgRes.ok) return
        const parsed  = extractLongestPath(await svgRes.text())
        if (parsed) setTrack(parsed)
      } catch { /* silent — no track shown */ }
    }
    load()
  }, [])

  // ── Hidden path element for getPointAtLength ──────────────────────────────
  useEffect(() => {
    if (!track) return
    if (hiddenSvgRef.current) document.body.removeChild(hiddenSvgRef.current)
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg   = document.createElementNS(svgNS, 'svg') as SVGSVGElement
    const path  = document.createElementNS(svgNS, 'path') as SVGPathElement
    path.setAttribute('d', track.pathD)
    svg.appendChild(path)
    svg.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;visibility:hidden'
    document.body.appendChild(svg)
    hiddenSvgRef.current = svg
    pathRef.current      = path
    totalLenRef.current  = path.getTotalLength()
    progressRef.current  = 0
    return () => { if (hiddenSvgRef.current) { document.body.removeChild(hiddenSvgRef.current); hiddenSvgRef.current = null } }
  }, [track])

  // ── rAF loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!track) return
    cancelAnimationFrame(rafRef.current)
    function frame() {
      const path = pathRef.current
      if (path && totalLenRef.current > 0) {
        const speed = totalLenRef.current / 18000
        progressRef.current = (progressRef.current + speed) % totalLenRef.current
        const pt = path.getPointAtLength(progressRef.current)
        setCarPos(prev => {
          setTrail(t => [{ x: prev.x, y: prev.y }, ...t].slice(0, TRAIL_LEN))
          return { x: pt.x, y: pt.y }
        })
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [track])

  // ── Nothing loaded yet — render empty transparent container ──────────────
  if (!track) {
    return <div style={{ width: '100%', height, background: 'transparent' }} />
  }

  const [vbX, vbY, vbW, vbH] = track.viewBox.split(/[\s,]+/).map(Number)
  // Dot grid: one dot every 36 SVG units
  const dotSpacing = 36
  const gridCols   = Math.ceil(vbW / dotSpacing)
  const gridRows   = Math.ceil(vbH / dotSpacing)
  const dotR       = vbW / 700

  // Car & track proportional sizes
  const strokeW = vbW / 125   // main outline ≈ 4
  const glowW   = vbW / 28    // glow ≈ 18
  const carR    = vbW / 50    // car dot ≈ 10
  const innerR  = vbW / 120   // white centre
  const glowR   = vbW / 28    // glow ring ≈ 18

  // Trail: 8 sizes descending 8→1, mapped as fractions of carR
  const trailSizes = [8, 7, 6, 5, 4, 3, 2, 1].map(s => (s / 10) * carR)

  return (
    <div style={{ width: '100%', height, background: 'transparent', position: 'relative' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={track.viewBox}
        preserveAspectRatio="xMidYMid slice"
        style={{ display: 'block' }}
      >
        {/* Dot grid — every 36 SVG units, opacity 0.25 */}
        {Array.from({ length: gridRows }, (_, row) =>
          Array.from({ length: gridCols }, (_, col) => (
            <circle
              key={`${row}-${col}`}
              cx={vbX + (col + 0.5) * dotSpacing}
              cy={vbY + (row + 0.5) * dotSpacing}
              r={dotR}
              fill="rgba(30,41,59,0.25)"
            />
          ))
        )}

        {/* Track glow */}
        <path d={track.pathD} fill="none" stroke="#38BDF8" strokeWidth={glowW}  strokeOpacity={0.12} strokeLinecap="round" strokeLinejoin="round" />
        {/* Track outline */}
        <path d={track.pathD} fill="none" stroke="#38BDF8" strokeWidth={strokeW} strokeOpacity={0.50} strokeLinecap="round" strokeLinejoin="round" />

        {(() => {
          const carColor = isLive ? '#EF4444' : '#38BDF8'
          return <>
            {/* Trail — 8 dots */}
            {trail.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y}
                r={Math.max(dotR, trailSizes[i] ?? dotR)}
                fill={carColor}
                opacity={Math.max(0.03, 0.5 - i * 0.06)}
              />
            ))}

            {/* Glow ring */}
            <circle cx={carPos.x} cy={carPos.y} r={glowR} fill="none" stroke={carColor} strokeWidth={strokeW * 0.5} opacity={0.20} />

            {/* Car dot */}
            <circle cx={carPos.x} cy={carPos.y} r={carR}   fill={carColor} />
            <circle cx={carPos.x} cy={carPos.y} r={innerR} fill="white" opacity={0.85} />
          </>
        })()}
      </svg>
    </div>
  )
}
