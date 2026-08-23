'use client'

import { Footprints, MapPin, Siren, Volume2, VolumeX } from 'lucide-react'
import { SAFE_ZONES } from '@/data/safe-zones'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chip, Panel } from '@/components/ui/Panel'
import { useLiveClock } from '@/components/ui/use-live-clock'
import { guidanceFor } from '@/domain/alert-guidance'
import { detectLanguage } from '@/domain/broadcast-templates'
import { alertsFrom, describeAge, isCurrent, type CampusAlert } from '@/domain/campus-alerts'
import { planEvacuation, type EvacuationPlan } from '@/domain/evacuation'
import type { Coordinates, Incident, Severity } from '@/domain/types'
import { JANSETU_LICENCE_KEY, VernacularVoiceEngine } from '@/domain/vernacular-voice'
import { useLiveEvents } from '@/hooks/use-live-events'

const BROADCAST_EVENTS = ['incident.broadcast'] as const

const SEVERITY_CHIP: Record<Severity, 'danger' | 'warn' | 'accent' | 'default'> = {
  P0: 'danger',
  P1: 'warn',
  P2: 'accent',
  P3: 'default',
}

/** What the control room is currently dealing with, alert or not. */
interface CampusState {
  alerts: CampusAlert[]
  openIncidents: number
}

/**
 * The other end of a broadcast — what a student actually sees.
 *
 * Every other AEGIS screen belongs to someone doing a job: reporting,
 * dispatching, analysing. This one belongs to the person the whole platform
 * exists to reach, and it answers the three questions they actually have:
 * what happened, what should I do, and how do I get help.
 *
 * Telling someone "fire in B Block" and stopping there is half an instruction.
 * The guidance below the alert is the other half, and when the reader shares
 * their location it becomes a direction to walk in rather than general advice.
 *
 * Speaking is the acquired JanSetu engine doing the work it was bought for.
 * An English-only alert excludes the support staff, contractors and visitors
 * most likely to be nearest the hazard, so the language comes from the message
 * itself and a new alert announces itself without being asked.
 */
export function AlertsFeed() {
  const [campus, setCampus] = useState<CampusState>({ alerts: [], openIncidents: 0 })
  const [reachedAt, setReachedAt] = useState<Date | null>(null)
  const [muted, setMuted] = useState(false)
  const [here, setHere] = useState<Coordinates | null>(null)
  const [locating, setLocating] = useState<'idle' | 'locating' | 'denied'>('idle')
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
      const { incidents } = (await response.json()) as { incidents: Incident[] }
      const alerts = alertsFrom(incidents)

      if (!primedRef.current) {
        // Whatever was already there is history the reader can scroll to.
        primedRef.current = true
        spokenRef.current = alerts[0]?.id ?? null
      }

      setCampus({
        alerts,
        openIncidents: incidents.filter(
          (incident) => !incident.isDrill && incident.status !== 'resolved',
        ).length,
      })
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

  const { alerts, openIncidents } = campus
  const newest = alerts[0]
  const earlier = alerts.slice(1, 8)
  const stale = newest && now ? !isCurrent(newest, now) : false
  const live = Boolean(newest) && !stale

  // Announce a genuinely new alert, once.
  useEffect(() => {
    if (!newest || !primedRef.current) return
    if (spokenRef.current === newest.id) return
    spokenRef.current = newest.id
    if (!muted) engineRef.current?.speak(newest.message, detectLanguage(newest.message))
  }, [newest, muted])

  const guidance = useMemo(
    () => (newest ? guidanceFor(newest.category, newest.severity) : null),
    [newest],
  )

  /* Only worth computing once someone has actually shared where they are:
     without that, "walk north-east" is a guess with a compass bearing on it. */
  const route: EvacuationPlan | null = useMemo(
    () => (newest && here ? planEvacuation(newest.at, here) : null),
    [newest, here],
  )

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocating('denied')
      return
    }

    setLocating('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHere({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocating('idle')
      },
      () => setLocating('denied'),
      { enableHighAccuracy: true, timeout: 8_000 },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        label="Campus alerts"
        tone={live ? 'danger' : 'default'}
        spotlight
        aside={
          <>
            <Chip tone={reachedAt ? 'good' : 'warn'}>{reachedAt ? 'Live' : 'Offline'}</Chip>
            <button
              type="button"
              onClick={() => {
                if (!muted) engineRef.current?.stop()
                setMuted((current) => !current)
              }}
              aria-label={muted ? 'Turn announcements on' : 'Turn announcements off'}
              className="ops-label inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ops-border px-3 text-ops-muted transition-colors hover:text-ops-text sm:min-h-0"
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              {muted ? 'Sound off' : 'Sound on'}
            </button>
          </>
        }
      >
        <div className="p-4">
          {!newest ? (
            <QuietCampus openIncidents={openIncidents} />
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
                  This is the last thing campus was told, but it is hours old — treat it as
                  history rather than an instruction.
                </p>
              )}

              <button
                type="button"
                onClick={() =>
                  engineRef.current?.speak(newest.message, detectLanguage(newest.message))
                }
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-ops-accent/40 bg-ops-accent/10 px-4 text-[13px] font-semibold text-ops-accent transition hover:bg-ops-accent/20"
              >
                <Volume2 className="h-4 w-4" />
                Read it aloud again
              </button>
            </>
          )}

          {!reachedAt && (
            <p className="mt-4 rounded-md border border-sev-p1/40 bg-sev-p1/10 px-3 py-2 text-[11px] leading-relaxed text-sev-p1">
              No connection. Anything above is what campus was last told; new alerts will not
              arrive until signal returns.
            </p>
          )}
        </div>
      </Panel>

      {guidance && !stale && (
        <Panel label="What to do" tone="accent" spotlight>
          <div className="p-4">
            <p className="text-[15px] font-semibold text-ops-text">{guidance.headline}</p>

            <ol className="mt-3 flex flex-col gap-2">
              {guidance.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-[13px] leading-relaxed text-ops-muted">
                  <span className="ops-label mt-0.5 shrink-0 text-ops-faint">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>

            <div className="mt-4 border-t border-ops-border/60 pt-4">
              {route ? (
                <>
                  <p className="text-[13px] leading-relaxed text-ops-text">
                    <span className="font-semibold">Walk {route.direction}</span> to{' '}
                    {route.zone.name} — {route.zone.landmark}. About {route.distanceM} m, roughly{' '}
                    {route.walkMinutes} min.
                  </p>
                  {route.avoid.length > 0 && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-sev-p1">
                      Go around {route.avoid.join(', ')}.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[12px] leading-relaxed text-ops-muted">
                    Share your location and this becomes a direction to walk in — the nearest
                    assembly point that is not next to the hazard.
                  </p>
                  <button
                    type="button"
                    onClick={locate}
                    disabled={locating === 'locating'}
                    className="ops-label mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-ops-border px-4 text-ops-text transition hover:border-ops-accent/50 disabled:opacity-60"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {locating === 'locating' ? 'Locating…' : 'Where should I go?'}
                  </button>
                  {locating === 'denied' && (
                    <p className="mt-2 text-[11px] leading-relaxed text-ops-faint">
                      Location unavailable. Follow the steps above and head away from{' '}
                      {newest?.place}.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </Panel>
      )}

      {!guidance && <AssemblyPoints />}

      {earlier.length > 0 && (
        <Panel label="Earlier today" aside={<Chip>{earlier.length}</Chip>}>
          <ul className="divide-y divide-ops-border/60">
            {earlier.map((alert) => (
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

      <Panel label="If you need help now" spotlight>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <HelpLink
            href="/report"
            icon={<Siren className="h-4 w-4" />}
            title="Report something"
            detail="Two taps. Works without signal — it sends itself when you are back online."
          />
          <HelpLink
            href="/safe-walk"
            icon={<Footprints className="h-4 w-4" />}
            title="Start Safe Walk"
            detail="Shares your route with the control room until you arrive."
          />
        </div>
      </Panel>
    </div>
  )
}

/**
 * The state this screen is in almost all of the time.
 *
 * "Nothing to show" is the honest answer, but on its own it reads like a page
 * that failed to load. Saying what the control room is doing right now is what
 * makes silence trustworthy rather than ambiguous.
 */
function QuietCampus({ openIncidents }: { openIncidents: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
        <p className="text-[15px] font-medium text-ops-text">
          No active alert. Campus is operating normally.
        </p>
      </div>

      <p className="text-[13px] leading-relaxed text-ops-muted">
        {openIncidents === 0
          ? 'The control room has nothing open right now.'
          : `The control room is handling ${openIncidents} ${
              openIncidents === 1 ? 'incident' : 'incidents'
            } — none of them need anything from you.`}
      </p>

      <p className="text-[12px] leading-relaxed text-ops-faint">
        Leave this open. Anything broadcast to campus appears here and reads itself aloud in the
        language it was written in — you do not need to watch the screen.
      </p>
    </div>
  )
}

/**
 * Where to go, learned before it is needed.
 *
 * During an alert the panel above names one assembly point and the way to
 * walk to it. With nothing happening there is no hazard to route around, and
 * the useful thing is simply knowing these exist — an assembly point read for
 * the first time during an evacuation is one nobody can find.
 */
function AssemblyPoints() {
  return (
    <Panel label="Where to go if something happens" aside={<Chip>{SAFE_ZONES.length}</Chip>}>
      <ul className="divide-y divide-ops-border/60">
        {SAFE_ZONES.map((zone) => (
          <li key={zone.id} className="flex items-baseline gap-3 px-4 py-3">
            <MapPin className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-ops-faint" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ops-text">{zone.name}</p>
              <p className="text-[12px] leading-relaxed text-ops-muted">{zone.landmark}</p>
            </div>
            <span className="ops-label ml-auto shrink-0 text-ops-faint">
              {zone.capacity.toLocaleString('en-IN')} people
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-ops-border/60 px-4 py-3 text-[11px] leading-relaxed text-ops-faint">
        Spread deliberately, so no single incident can compromise every option. During an alert
        this screen names the one to head for and which way to walk.
      </p>
    </Panel>
  )
}

function HelpLink({
  href,
  icon,
  title,
  detail,
}: {
  href: string
  icon: React.ReactNode
  title: string
  detail: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1.5 rounded-lg border border-ops-border bg-ops-bg/40 p-3 transition hover:border-ops-accent/50"
    >
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ops-text">
        <span className="text-ops-accent">{icon}</span>
        {title}
      </span>
      <span className="text-[11px] leading-relaxed text-ops-muted">{detail}</span>
    </Link>
  )
}
