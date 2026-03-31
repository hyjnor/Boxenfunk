// Pure rendering component — no 'use client' needed, works in server and client contexts

// ─── Team color resolver ───────────────────────────────────────────────────────
// Matches by case-insensitive substring so "Haas F1 Team" matches "haas", etc.

export function getTeamColor(teamName: string): string {
  const t = (teamName ?? '').toLowerCase()
  if (t.includes('mercedes')) return '#00D2BE'
  if (t.includes('ferrari')) return '#E8002D'
  if (t.includes('red bull')) return '#3671C6'
  if (t.includes('mclaren')) return '#FF8000'
  if (t.includes('aston martin')) return '#358C75'
  if (t.includes('alpine')) return '#FF87BC'
  if (t.includes('williams')) return '#64C4FF'
  if (t.includes('rb f1') || t.includes('racing bulls')) return '#6692FF'
  if (t.includes('haas')) return '#B6BABD'
  if (t.includes('kick sauber') || t.includes('sauber') || t.includes('audi')) return '#52E252'
  if (t.includes('cadillac')) return '#A8B0C0'
  return '#38BDF8'
}

// ─── Stripe color from driver code first character ─────────────────────────────

function getStripeColor(driverCode: string): string {
  const c = ((driverCode ?? 'A')[0]).toUpperCase().charCodeAt(0)
  if (c >= 65 && c <= 73) return '#FFFFFF' // A–I
  if (c >= 74 && c <= 82) return '#FFD700' // J–R
  return '#00FFFF'                          // S–Z
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface HelmetAvatarProps {
  /** Full team name string from the API, e.g. "Red Bull Racing" */
  teamName: string
  /** Three-letter driver code, e.g. "VER" — drives stripe color */
  driverCode: string
  size?: number
}

export default function HelmetAvatar({ teamName, driverCode, size = 56 }: HelmetAvatarProps) {
  const color = getTeamColor(teamName)
  const stripe = getStripeColor(driverCode)

  // Unique clipPath id — safe to duplicate across renders with same team+code
  const uid = `hc-${(teamName + driverCode).replace(/[^a-z0-9]/gi, '').toLowerCase()}`

  // The shell path is used both for the fill and as the clip region
  const shellPath =
    'M 10 52 C 3 52 2 46 2 38 C 2 16 13 3 29 3 C 43 3 54 12 54 26 C 54 40 45 52 32 52 Z'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${driverCode} helmet`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <clipPath id={uid}>
          <path d={shellPath} />
        </clipPath>
      </defs>

      {/* Helmet shell */}
      <path d={shellPath} fill={color} />

      {/* Racing stripe — diagonal band across the shell, clipped */}
      <rect
        x="-12"
        y="21"
        width="80"
        height="9"
        fill={stripe}
        fillOpacity="0.38"
        transform="rotate(-30 28 28)"
        clipPath={`url(#${uid})`}
      />

      {/* Chin guard — subtle darker overlay at front-bottom */}
      <path
        d="M 32 52 C 42 52 50 46 54 36 L 54 42 C 52 50 44 54 34 54 L 28 54 L 28 52 Z"
        fill="#000000"
        fillOpacity="0.18"
        clipPath={`url(#${uid})`}
      />

      {/* Visor — dark lens, front-upper area, slightly angled */}
      <ellipse
        cx="39"
        cy="23"
        rx="11"
        ry="7"
        fill="#0D1117"
        transform="rotate(-20 39 23)"
      />

      {/* Visor shine — small highlight inside lens */}
      <ellipse
        cx="34"
        cy="18"
        rx="5"
        ry="2.5"
        fill="#FFFFFF"
        fillOpacity="0.25"
        transform="rotate(-20 34 18)"
      />
    </svg>
  )
}
