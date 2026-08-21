'use client'

import { useEffect, useState } from 'react'
import type { ArrivalEstimate } from '@/domain/dispatch'

/** How often a responder in the field reports position. */
const TRACK_INTERVAL_MS = 5_000

/** ~12m of drift per tick — a walking pace when geolocation is unavailable. */
const FALLBACK_STEP_DEG = 0.00011

interface TrackingOptions {
  responderId: string | null
  /** Where to drift from when the browser will not give a real fix. */
  fallbackFrom: { lat: number; lng: number } | null
  /** True only while the responder actually has somewhere to be. */
  active: boolean
}

/**
 * Streams a responder's position while they are en route, and returns the live
 * arrival estimate the server computes from it.
 *
 * Tracking runs only while `active` — a responder who is off-duty or unassigned
 * is not tracked at all. That is a deliberate limit: continuous location on
 * staff who are not responding to anything would be workplace surveillance,
 * not emergency response.
 *
 * Falls back to a synthetic walk when geolocation is denied, so the control
 * room demo never depends on a browser permission prompt.
 *
 * @example
 * const arrival = useResponderTracking({ responderId, fallbackFrom, active: true })
 * arrival?.etaMinutes // => 3, decaying as they approach
 */
export function useResponderTracking({
  responderId,
  fallbackFrom,
  active,
}: TrackingOptions): ArrivalEstimate | null {
  const [arrival, setArrival] = useState<ArrivalEstimate | null>(null)

  useEffect(() => {
    if (!responderId || !active || !fallbackFrom) {
      setArrival(null)
      return
    }

    let realFix: { lat: number; lng: number } | null = null
    const drift = { ...fallbackFrom }

    const watchId =
      typeof navigator !== 'undefined' && navigator.geolocation
        ? navigator.geolocation.watchPosition(
            (position) => {
              realFix = { lat: position.coords.latitude, lng: position.coords.longitude }
            },
            () => {
              // Denied or unavailable — the drift below takes over.
            },
            { enableHighAccuracy: true, maximumAge: 3_000 },
          )
        : null

    const send = async () => {
      if (!realFix) {
        drift.lat += (Math.random() - 0.5) * 2 * FALLBACK_STEP_DEG
        drift.lng += (Math.random() - 0.5) * 2 * FALLBACK_STEP_DEG
      }
      const point = realFix ?? drift

      try {
        const response = await fetch(`/api/responders/${encodeURIComponent(responderId)}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(point),
        })
        if (!response.ok) return
        const body = (await response.json()) as { arrival: ArrivalEstimate | null }
        setArrival(body.arrival)
      } catch {
        // A dropped position is fine; the next one is five seconds away.
      }
    }

    void send()
    const interval = setInterval(() => void send(), TRACK_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [responderId, active, fallbackFrom])

  return arrival
}
