'use client'

import { useCallback, useEffect, useState } from 'react'
import { CAMPUS_CENTRE } from '@/data/campus'
import { listBuildings } from '@/domain/campus-geometry'
import {
  CHECK_IN_INTERVAL_MS,
  MISSED_CHECK_INS_BEFORE_ESCALATION,
  missedCheckIns,
  nextCheckInDueAt,
  walkProgress,
  type SafeWalk,
} from '@/domain/safe-walk'

/** Durations offered, in minutes. Covers a walk across campus and back. */
const DURATION_OPTIONS = [5, 10, 15, 25] as const

const secondsUntil = (when: Date, now: Date) =>
  Math.max(0, Math.round((when.getTime() - now.getTime()) / 1000))

/**
 * SAFE WALK — the visible half of the dead man's switch.
 *
 * Set a destination and how long it should take, then confirm you are fine
 * when asked. Stop confirming, or overrun badly, and AEGIS raises a silent
 * alarm carrying your last known position — no further action needed from you,
 * which is the entire point.
 */
export function SafeWalkPanel() {
  const [walk, setWalk] = useState<SafeWalk | null>(null)
  const [destination, setDestination] = useState('')
  const [minutes, setMinutes] = useState<number>(10)
  const [now, setNow] = useState(() => new Date())

  const destinations = listBuildings().map((building) => building.shortName)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const currentPosition = useCallback(
    (): Promise<{ lat: number; lng: number }> =>
      new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          resolve(CAMPUS_CENTRE)
          return
        }
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
          () => resolve(CAMPUS_CENTRE),
          { timeout: 2_000, maximumAge: 30_000 },
        )
      }),
    [],
  )

  const post = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch('/api/safe-walk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) return null
    const parsed = (await response.json()) as { walk: SafeWalk }
    return parsed.walk
  }, [])

  const start = async () => {
    const origin = await currentPosition()
    const started = await post({
      action: 'start',
      destination: destination.trim() || 'my destination',
      expectedMinutes: minutes,
      origin,
    })
    if (started) setWalk(started)
  }

  const checkIn = async () => {
    if (!walk) return
    const position = await currentPosition()
    const updated = await post({ action: 'checkin', walkId: walk.id, position })
    if (updated) setWalk(updated)
  }

  const end = async (action: 'arrived' | 'cancelled') => {
    if (!walk) return
    await post({ action, walkId: walk.id })
    setWalk(null)
  }

  if (!walk) {
    return (
      <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
        <p className="ops-label text-ops-muted">Safe Walk</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ops-muted">
          Walking somewhere alone? Tell AEGIS where and how long. If you stop checking in, it
          raises a silent alarm with your last known position.
        </p>

        <input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          list="safe-walk-destinations"
          placeholder="Where are you heading?"
          className="mt-2.5 w-full rounded-md border border-ops-border bg-ops-bg px-2.5 py-2 text-[12px] text-ops-text placeholder:text-ops-faint focus:border-ops-accent/50 focus:outline-none"
        />
        <datalist id="safe-walk-destinations">
          {destinations.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="mt-2 flex gap-1.5">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMinutes(option)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
                option === minutes
                  ? 'border-ops-accent/50 bg-ops-accent/10 text-ops-accent'
                  : 'border-ops-border text-ops-muted hover:text-ops-text'
              }`}
            >
              {option} min
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void start()}
          className="mt-2.5 w-full rounded-md border border-ops-accent/40 bg-ops-accent/10 py-2.5 text-[13px] font-medium text-ops-accent transition-colors hover:bg-ops-accent/20"
        >
          Start Safe Walk
        </button>
      </section>
    )
  }

  const missed = missedCheckIns(walk, now)
  const secondsToCheckIn = secondsUntil(nextCheckInDueAt(walk), now)
  const overdueSoon = missed >= MISSED_CHECK_INS_BEFORE_ESCALATION - 1

  return (
    <section
      className={`rounded-lg border p-4 ${
        overdueSoon ? 'border-sev-p1/50 bg-sev-p1/5' : 'border-ops-accent/40 bg-ops-accent/5'
      }`}
    >
      <div className="flex items-center gap-2">
        <p className={`ops-label ${overdueSoon ? 'text-sev-p1' : 'text-ops-accent'}`}>
          Safe Walk active
        </p>
        <span className="ops-label ml-auto text-ops-faint">to {walk.destination}</span>
      </div>

      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-ops-bg">
        <div
          className="h-full origin-left bg-ops-accent transition-transform duration-1000 ease-linear"
          style={{ transform: `scaleX(${walkProgress(walk, now)})`, width: '100%' }}
        />
      </div>

      <p className="mt-2 text-[12px] text-ops-text">
        {secondsToCheckIn > 0 ? (
          <>
            Next check-in in <span className="font-mono">{secondsToCheckIn}s</span>
          </>
        ) : (
          <span className="text-sev-p1">Check-in overdue — tap below to confirm you are fine.</span>
        )}
      </p>
      <p className="mt-0.5 text-[11px] text-ops-faint">
        {missed === 0
          ? `Asked every ${CHECK_IN_INTERVAL_MS / 60_000} minutes. Two missed check-ins raise a silent alarm.`
          : `${missed} missed. ${MISSED_CHECK_INS_BEFORE_ESCALATION - missed} more raises a silent alarm.`}
      </p>

      <button
        type="button"
        onClick={() => void checkIn()}
        className="mt-2.5 w-full rounded-md border border-ops-accent/40 bg-ops-accent/10 py-3 text-[14px] font-semibold text-ops-accent transition-colors hover:bg-ops-accent/20"
      >
        I&apos;m fine
      </button>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => void end('arrived')}
          className="flex-1 rounded-md border border-emerald-400/40 py-1.5 text-[12px] text-emerald-400 transition-colors hover:bg-emerald-400/10"
        >
          I have arrived
        </button>
        <button
          type="button"
          onClick={() => void end('cancelled')}
          className="rounded-md border border-ops-border px-3 py-1.5 text-[12px] text-ops-muted transition-colors hover:text-ops-text"
        >
          Cancel
        </button>
      </div>
    </section>
  )
}
