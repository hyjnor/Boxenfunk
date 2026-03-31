import { NextRequest, NextResponse } from 'next/server'

function getCurrentSeason(): number {
  const now = new Date()
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear()
}

export async function GET(req: NextRequest) {
  const season = req.nextUrl.searchParams.get('season') ?? String(getCurrentSeason())
  const res = await fetch(
    `https://api.jolpi.ca/ergast/f1/${season}/races.json?limit=30`,
    { next: { revalidate: 3600 } }
  )
  const data = await res.json()
  const races = data?.MRData?.RaceTable?.Races ?? []
  return NextResponse.json(races)
}
