import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const now = new Date()
    const season = now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear()

    // Step 1: Fetch Jolpica
    const jolpicaRes = await fetch(`https://api.jolpi.ca/ergast/f1/${season}/races.json`)
    const jolpicaData = await jolpicaRes.json()
    const jolpicaRaces = jolpicaData?.MRData?.RaceTable?.Races || []

    // Step 2: Fetch existing from Notion
    let existingRounds: number[] = []
    let notionError = null
    try {
      const notionRes = await fetch('https://n8n.srv1061672.hstgr.cloud/webhook/bf-get-races')
      const notionData = await notionRes.json()
      existingRounds = (notionData?.races || []).map((r: any) => r.jolpica_round)
    } catch (e: any) {
      notionError = e.message
    }

    // Step 3: Find missing
    const missingRaces = jolpicaRaces.filter((race: any) =>
      !existingRounds.includes(parseInt(race.round))
    )

    // Step 4: Create all missing races
    let created = 0
    for (const race of missingRaces) {
      const datum = race.date + 'T' + (race.time || '13:00:00Z')
      const payload = {
        name: race.raceName + ' ' + season,
        runde: parseInt(race.round),
        saison: season,
        datum: datum,
        circuit: race.Circuit.circuitName,
        jolpica_round: parseInt(race.round),
      }
      await fetch('https://n8n.srv1061672.hstgr.cloud/webhook/bf-create-race', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      created++
      await new Promise(r => setTimeout(r, 300))
    }

    return NextResponse.json({
      season,
      total: jolpicaRaces.length,
      created,
      skipped: existingRounds.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
