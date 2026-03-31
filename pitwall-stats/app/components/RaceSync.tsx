'use client'

import { useEffect } from 'react'

const LS_KEY = 'bf-race-sync'

// ─── RaceSync ─────────────────────────────────────────────────────────────────
// Invisible component — triggers /api/sync-races once per calendar day.
// Stores { synced: true, date: "YYYY-MM-DD" } in sessionStorage.
// At midnight (new date) the stale entry is ignored and sync runs again,
// picking up any races added mid-season.

export default function RaceSync() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"

    try {
      const raw = sessionStorage.getItem(LS_KEY)
      if (raw) {
        const stored = JSON.parse(raw)
        if (stored.date === today && stored.synced) return // already synced today
        // Date changed (midnight rollover) — clear stale entry and re-sync
        sessionStorage.removeItem(LS_KEY)
      }
    } catch { /* ignore */ }

    fetch('/api/sync-races')
      .then(r => r.json())
      .then(data => {
        try {
          sessionStorage.setItem(LS_KEY, JSON.stringify({ synced: true, date: today, ...data }))
        } catch { /* ignore */ }
      })
      .catch(() => { /* silent — non-critical background sync */ })
  }, [])

  return null
}
