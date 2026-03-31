import { NextRequest, NextResponse } from 'next/server'

// GET /api/my-tip?race_id=6
// Returns { tip: {...} } if user already tipped this race, { tip: null } if not.
// n8n bf-get-my-tip must: verify JWT, filter BF_Tips by user_id + race_id, return tip or null.

export async function GET(req: NextRequest) {
  const race_id    = req.nextUrl.searchParams.get('race_id') ?? ''
  const authHeader = req.headers.get('authorization') || ''

  const res = await fetch(
    `https://n8n.srv1061672.hstgr.cloud/webhook/bf-get-my-tip?race_id=${encodeURIComponent(race_id)}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json', 'Authorization': authHeader } }
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
