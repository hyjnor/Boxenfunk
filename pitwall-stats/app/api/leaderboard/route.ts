import { NextRequest, NextResponse } from 'next/server'

function getCurrentSeason(): number {
  const now = new Date()
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear()
}

export async function GET(req: NextRequest) {
  // Fire-and-forget: trigger tip evaluation without blocking the response
  fetch('https://n8n.srv1061672.hstgr.cloud/webhook/bf-evaluate-now', { method: 'POST' })
    .catch(() => { /* ignore */ })

  const season = req.nextUrl.searchParams.get('season') ?? String(getCurrentSeason())
  const res = await fetch(
    `https://n8n.srv1061672.hstgr.cloud/webhook/bf-leaderboard?season=${season}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } }
  )
  const data = await res.json()
  return NextResponse.json(data)
}
