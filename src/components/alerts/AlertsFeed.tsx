'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Chip, Panel } from '@/components/ui/Panel'
import { useLiveClock } from '@/components/ui/use-live-clock'
import { detectLanguage } from '@/domain/broadcast-templates'
import {
  alertsFrom,
  describeAge,
  isCurrent,
  type CampusAlert,
} from '@/domain/campus-alerts'
import type { Incident, Severity } from '@/domain/types'
import { JANSETU_LICENCE_KEY, VernacularVoiceEngine } from '@/domain/vernacular-voice'
import { useLiveEvents } from '@/hooks/use-live-events'

const BROADCAST_EVENTS = ['incident.broadcast'] as const

const SEVERITY_CHIP: Record<Severity, 'danger' | 'warn' | 'accent' | 'default'> = {
  P0: 'danger',
  P1: 'warn',
  P2: 'accent',
  P3: 'default',
}

/**
 * The other end of a broadcast — what a student actually sees.
 *
 * Every other AEGIS screen belongs to someone doing a job: reporting,
 * dispatching, analysing. This one belongs to the person the whole platform
 * exists to reach, and it does exactly two things: show what campus has been
 * told, and say it out loud.
 *
 * Speaking is the acquired JanSetu engine doing the work it was bought for.
 * An English-only alert excludes the support staff, contractors and visitors
 * most likely to be nearest the hazard, so the language comes from the
 * message itself and a new alert announces itself without being asked.
 */
export function AlertsFeed() {
  const [alerts, setAlerts] = useState<CampusAlert[]>([])
  const [reachedAt, setReachedAt] = useState<Date | null>(null)
  const [muted, setMuted] = useState(false)
  const now = useLiveClock()

  const engineRef = useRef<VernacularVoiceEngine | null>(null)
  /* The newest alert already announced, so a refresh or a reconnect does not
     read the same evacuation order out a second time. */
  const spokenRef = useRef<string | null>(null)
  /* Nothing is announced on first load: arriving at a page and being spoken
     at about an hour-old alert is alarming rather than useful. Primed when
     that first load finishes rather than when the first alert appears — on a
     quiet campus those are not the same moment, and waiting for an alert to
     prime would swallow the very first one of the day. */
  const primedRef = useRef(false)

  useEffect(() => {
    if (VernacularVoiceEngine.isAvailable()) {
      engineRef.current = new VernacularVoiceEngine({
        licenseKey: JANSETU_LICENCE_KEY,
        defaultLanguage: 'en',
      })
    }
    const engine = engineRef.current
    return () => engine?.stop()
  }, [])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/incidents')
      if (!response.ok) return
      const body = (await response.json()) as { incidents: Incident[] }
      const next = alertsFrom(body.incidents)

      if (!primedRef.current) {
        // Whatever was already there is history the reader can scroll to.
        primedRef.current = true
        spokenRef.current = next[0]?.id ?? null
      }

      setAlerts(next)
      setReachedAt(new Date())
    } catch {
      // Offline. Whatever is on screen is the last thing campus was told,
      // and the banner below says how long ago that was.
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLiveEvents(BROADCAST_EVENTS, () => {
    void refresh()
  })

  // Announce a genuinely new alert, once.
  useEffect(() => {
    const newest = alerts[0]
    if (!newest || !primedRef.current) return
    if (spokenRef.current === newest.id) return
    spokenRef.current = newest.id
    if (!muted) engineRef.current?.speak(newest.message, detectLanguage(newest.message))
  }, [alerts, muted])

  const newest = alerts[0]
  const rest = alerts.slice(1, 8)
  const stale = newest && now ? !isCurrent(newest, now) : false

  return (
    <div className="flex flex-col gap-4">
      <Panel
        label="Campus alerts"
        tone={newest && !stale ? 'danger' : 'default'}
        aside={
          <>
            <Chip tone={reachedAt ? 'good' : 'warn'}>{reachedAt ? 'Live' : 'Offline'}</Chip>
            <button
              type="button"
              onClick={() => {
                if (!muted) engineRef.current?.stop()
                setMuted((current) => !current)
              }}
              className="ops-label min-h-11 rounded-full border border-ops-border px-3 text-ops-muted transition-colors hover:text-ops-text sm:min-h-0"
            >
              {muted ? 'Sound off' : 'Sound on'}
            </button>
          </>
        }
      >
        <div className="p-4">
          {!newest ? (
            <p className="text-[13px] leading-relaxed text-ops-muted">
              Nothing has been broadcast to campus. This screen stays open and
              announces anything the control room sends — you do not need to watch it.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={SEVERITY_CHIP[newest.severity]}>{newest.severity}</Chip>
                <span className="ops-label text-ops-faint">{newest.place}</span>
                <span className="ops-label ml-auto text-ops-faint">
                  {now ? describeAge(newest.sentAt, now) : '—'}
                </span>
              </div>

              <p className="mt-3 text-[17px] font-medium leading-relaxed text-ops-text">
                {newest.message}
              </p>

              {stale && (
                <p className="mt-3 rounded-md border border-ops-border bg-ops-bg px-3 py-2 text-[11px] leading-relaxed text-ops-faint">
                  This is the last thing campus was told, but it is hours old — treat
                  it as history rather than an instruction.
                </p>
              )}

              <button
                type="button"
                onClick={() =>
                  engineRef.current?.speak(newest.message, detectLanguage(newest.message))
                }
                className="mt-4 min-h-11 rounded-full border border-ops-accent/40 bg-ops-accent/10 px-4 text-[13px] font-semibold text-ops-accent transition hover:bg-ops-accent/20"
              >
                Read it aloud again
              </button>
            </>
          )}

          {!reachedAt && (
            <p className="mt-4 rounded-md border border-sev-p1/40 bg-sev-p1/10 px-3 py-2 text-[11px] leading-relaxed text-sev-p1">
              No connection. Anything above is what campus was last told; new alerts
              will not arrive until signal returns.
            </p>
          )}
        </div>
      </Panel>

      {rest.length > 0 && (
        <Panel label="Earlier today" aside={<Chip>{rest.length}</Chip>}>
          <ul className="divide-y divide-ops-border/60">
            {rest.map((alert) => (
              <li key={alert.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={SEVERITY_CHIP[alert.severity]}>{alert.severity}</Chip>
                  <span className="ops-label text-ops-faint">{alert.place}</span>
                  <span className="ops-label ml-auto text-ops-faint">
                    {now ? describeAge(alert.sentAt, now) : '—'}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ops-muted">{alert.message}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
