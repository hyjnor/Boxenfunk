import { NextRequest, NextResponse } from 'next/server'

// TODO: Create bf-user-tips n8n webhook that:
// 1. Receives ?username={username}
// 2. Queries BF_Tips in Notion filtered by username
// 3. Joins each tip with the corresponding BF_Races entry (by race_id/jolpica_round)
// 4. Returns array of tip+result objects (see TipDetail type in leaderboard/page.tsx)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const res = await fetch(
    `https://n8n.srv1061672.hstgr.cloud/webhook/bf-user-tips?username=${encodeURIComponent(username)}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } }
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
