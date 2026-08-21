'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SentinelSession } from '@/domain/sentinel-session'
import { useLiveEvents } from '@/hooks/use-live-events'

/** The session as the control room receives it — never carries the PIN hash. */
type VisibleSession = Omit<SentinelSession, 'pinHash'>

const SENTINEL_EVENTS = ['sentinel.armed', 'sentinel.ping', 'sentinel.disarmed'] as const

const secondsSince = (iso: string): number => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))

/**
 * The silent-alarm lane: SENTINEL sessions armed covertly from a phone whose
 * screen is showing a decoy calculator.
 *
 * Deliberately given its own lane rather than mixed into the incident queue —
 * a silent panic is not a queued work item, it is someone in trouble right now
 * with no way to speak.
 */
export function SentinelLane() {
  const [sessions, setSessions] = useState<VisibleSession[]>([])

  const refresh = useCallback(async () => {
    const response = await fetch('/api/sentinel/sessions?active=true')
    if (!response.ok) return
    const body = (await response.json()) as { sessions: VisibleSession[] }
    setSessions(body.sessions)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLiveEvents(SENTINEL_EVENTS, () => {
    void refresh()
  })

  if (sessions.length === 0) {
    return (
      <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
        <p className="ops-label text-ops-muted">Silent alarms</p>
        <p className="mt-1.5 text-[12px] text-ops-muted">
          No active SENTINEL sessions. Armed sessions appear here instantly, with a live location
          trail.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-sev-p0/40 bg-sev-p0/5 p-4">
      <p className="ops-label flex items-center gap-1.5 text-sev-p0">
        <span className="siren-pulse size-1.5 rounded-full bg-current" />
        Silent alarms · {sessions.length}
      </p>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {sessions.map((session) => {
          const latest = session.path.at(-1)

          return (
            <li
              key={session.id}
              className="rounded-md border border-sev-p0/30 bg-ops-bg p-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-ops-text">{session.label}</span>
                <span className="ops-label ml-auto text-ops-faint">
                  {secondsSince(session.lastPingAt)}s ago
                </span>
              </div>

              <p className="mt-1 font-mono text-[11px] text-ops-muted">
                {latest ? `${latest.lat.toFixed(5)}, ${latest.lng.toFixed(5)}` : 'awaiting first fix'}
                <span className="ml-1.5 text-ops-faint">
                  · {session.path.length} point{session.path.length === 1 ? '' : 's'}
                </span>
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
