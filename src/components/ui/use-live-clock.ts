'use client'

import { useEffect, useState } from 'react'

/** One second. Every screen that shows a clock ticks on the same beat. */
const TICK_MS = 1000

/**
 * The clock the whole site runs on.
 *
 * Returns `null` until the component has mounted, and that is the point rather
 * than a caveat: this app is server-rendered on Vercel, which runs in UTC,
 * while the person reading it is in IST. An hour computed during rendering
 * disagrees with itself across hydration by five and a half hours, so the time
 * has to come from the reader's own device, after mount.
 *
 * Callers render a placeholder for the null case — see `formatTime`.
 *
 * @example
 * const now = useLiveClock()
 * <span>{formatTime(now)}</span> // "22:47:03", ticking
 */
export function useLiveClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const tick = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(tick)
  }, [])

  return now
}

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * `HH:MM:SS` in the reader's own timezone, or placeholder dashes before the
 * clock is known.
 *
 * @example
 * formatTime(null) // => '--:--:--'
 */
export function formatTime(now: Date | null): string {
  if (!now) return '--:--:--'
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}
