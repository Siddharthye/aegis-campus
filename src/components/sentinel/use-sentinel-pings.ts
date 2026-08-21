'use client'

import { useEffect } from 'react'
import { CAMPUS_CENTRE } from '@/data/campus'

/** Cadence of location breadcrumbs while the decoy screen is up. */
const PING_INTERVAL_MS = 4_000

/** ~10m of drift per ping — a believable walking pace when GPS is denied. */
const FALLBACK_STEP_DEG = 0.00009

/**
 * Streams `POST /api/sentinel/ping` every ~4s while `sessionId` is set.
 * Prefers real `watchPosition` fixes; when geolocation is denied or absent it
 * random-walks from the campus centre so the control-room trail always moves —
 * the demo must never depend on a browser permission prompt.
 *
 * @example
 * useSentinelPings(phase === 'decoy' ? sessionId : null)
 */
export function useSentinelPings(sessionId: string | null): void {
  useEffect(() => {
    if (!sessionId) return

    let latestFix: { lat: number; lng: number } | null = null
    const drift = { lat: CAMPUS_CENTRE.lat, lng: CAMPUS_CENTRE.lng }

    const watchId =
      typeof navigator !== 'undefined' && navigator.geolocation
        ? navigator.geolocation.watchPosition(
            (position) => {
              latestFix = { lat: position.coords.latitude, lng: position.coords.longitude }
            },
            () => {
              // Denied or unavailable — the drift fallback below takes over.
            },
            { enableHighAccuracy: true, maximumAge: 2_000 },
          )
        : null

    const send = () => {
      if (!latestFix) {
        drift.lat += (Math.random() - 0.5) * 2 * FALLBACK_STEP_DEG
        drift.lng += (Math.random() - 0.5) * 2 * FALLBACK_STEP_DEG
      }
      const point = latestFix ?? drift
      void fetch('/api/sentinel/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, lat: point.lat, lng: point.lng }),
      }).catch(() => {
        // A dropped ping is fine — the next one is 4 seconds away.
      })
    }

    send()
    const interval = setInterval(send, PING_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [sessionId])
}
