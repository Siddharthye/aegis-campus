'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CHECK_IN_INTERVAL_MS,
  missedCheckIns,
  walkProgress,
  type SafeWalk,
} from '@/domain/safe-walk'
import { CAMPUS25_GATES, CAMPUS25_MUSTERS } from '@/data/campus25'
import { describeRoute, type RiskPattern, type RouteRisk } from '@/domain/risk-map'
import { Campus25Map } from './Campus25Map'
import { Chip, MiniBar, Panel, Stat } from '@/components/ui/Panel'
import { SafeWalkPanel } from './SafeWalkPanel'

/**
 * Safe Walk's own screen — route-centric, not form-centric.
 *
 * The question this workflow answers is spatial ("where am I, where am I
 * going, what is between us"), so the campus plan is the primary surface and
 * the controls sit beside it. That is why it is not folded into Report, whose
 * question is descriptive.
 */
export function SafeWalkWorkspace() {
  const [walks, setWalks] = useState<SafeWalk[]>([])
  const [now, setNow] = useState(() => new Date())
  const [risk, setRisk] = useState<{
    patterns: RiskPattern[]
    routes: RouteRisk[]
  } | null>(null)
  const [pickedDestination, setPickedDestination] = useState('')
  // Derived from the ticking clock rather than read during rendering: the
  // server runs in UTC and the reader is in IST, so an hour computed while
  // rendering disagrees with itself across hydration.
  const [hour, setHour] = useState<number | null>(null)
  useEffect(() => setHour(now.getHours()), [now])

  const refresh = useCallback(async () => {
    const response = await fetch('/api/safe-walk')
    if (!response.ok) return
    const body = (await response.json()) as { walks: SafeWalk[] }
    setWalks(body.walks)
  }, [])

  // Risk is re-scored per hour, not per second — patterns are hour-banded.
  useEffect(() => {
    if (hour === null) return

    void fetch(`/api/risk?hour=${hour}`)
      .then(
        (response) =>
          response.json() as Promise<{
            patterns: RiskPattern[]
            routes: RouteRisk[]
          }>,
      )
      .then(setRisk)
      .catch(() => setRisk(null))
  }, [hour])

  useEffect(() => {
    void refresh()
    const poll = setInterval(() => void refresh(), 10_000)
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => {
      clearInterval(poll)
      clearInterval(clock)
    }
  }, [refresh])

  const active = walks.filter((walk) => walk.status === 'walking')
  const escalated = walks.filter((walk) => walk.status === 'escalated')
  const completed = walks.filter((walk) => walk.status === 'arrived')

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
      <div className="flex flex-col gap-4">
        <Panel
          label="Campus route map"
          aside={
            <>
              <Chip tone="good">{CAMPUS25_MUSTERS.length} muster points</Chip>
              <Chip tone={active.length ? 'accent' : 'default'}>{active.length} walking</Chip>
            </>
          }
        >
          <div className="p-3">
            <Campus25Map
              walks={walks}
              patterns={risk?.patterns ?? []}
              routes={risk?.routes ?? []}
              onPickDestination={setPickedDestination}
            />
          </div>
        </Panel>

        <div className="grid gap-4 sm:grid-cols-4">
          <Panel spotlight>
            <div className="p-4">
              <Stat value={active.length} label="active walks" tone="accent" />
            </div>
          </Panel>
          <Panel spotlight>
            <div className="p-4">
              <Stat
                value={escalated.length}
                label="escalated"
                tone={escalated.length ? 'danger' : 'default'}
              />
            </div>
          </Panel>
          <Panel spotlight>
            <div className="p-4">
              <Stat value={completed.length} label="arrived safely" tone="good" />
            </div>
          </Panel>
          <Panel spotlight>
            <div className="p-4">
              <Stat value={`${CHECK_IN_INTERVAL_MS / 60_000}m`} label="check-in interval" />
            </div>
          </Panel>
        </div>

        <Panel label="Walk activity" aside={<Chip>{walks.length} total</Chip>}>
          {walks.length === 0 ? (
            <p className="px-4 py-6 text-[12px] leading-relaxed text-ops-muted">
              No walks yet. Starting one tells AEGIS where you are heading and how long it should
              take — miss two check-ins and it raises a silent alarm with your last known position,
              without you having to do anything.
            </p>
          ) : (
            <ul className="divide-y divide-ops-border/60">
              {walks.slice(0, 6).map((walk) => {
                const missed = missedCheckIns(walk, now)
                return (
                  <li key={walk.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-ops-text">
                        → {walk.destination}
                      </span>
                      <WalkStatusChip walk={walk} missed={missed} />
                      <span className="ops-label ml-auto text-ops-faint">
                        {walk.path.length} fixes · {walk.expectedMinutes}m planned
                      </span>
                    </div>
                    {walk.status === 'walking' && (
                      <div className="mt-2">
                        <MiniBar
                          value={walkProgress(walk, now) * 100}
                          max={100}
                          tone={missed >= 1 ? 'danger' : 'accent'}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel label="Muster points nearby" aside={<Chip tone="good">Safe</Chip>}>
            <ul className="divide-y divide-ops-border/60">
              {CAMPUS25_MUSTERS.map((zone) => (
                <li key={zone.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-ops-text">{zone.name}</p>
                    <p className="truncate text-[11px] text-ops-muted">{zone.landmark}</p>
                  </div>
                  <span className="ops-label shrink-0 text-ops-faint">
                    {zone.capacity.toLocaleString('en-IN')}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel label="Gates" aside={<Chip>{CAMPUS25_GATES.length}</Chip>}>
            <ul className="divide-y divide-ops-border/60">
              {CAMPUS25_GATES.map((gate) => (
                <li key={gate.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-ops-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-ops-text">{gate.name}</p>
                    <p className="truncate text-[11px] text-ops-muted">{gate.towards}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel label="How escalation works">
            <ol className="flex flex-col gap-2.5 px-4 py-3.5">
              {[
                ['You set a destination and an ETA', 'Nothing is shared beyond that.'],
                [
                  'AEGIS asks you to confirm every 3 minutes',
                  'One tap. That is the whole interaction.',
                ],
                [
                  'Two missed check-ins, or a bad overrun',
                  'A silent alarm opens with your last position.',
                ],
                [
                  'The control room sees the trail',
                  'Ending it is their call once a human reaches you.',
                ],
              ].map(([step, detail], index) => (
                <li key={step} className="flex gap-3">
                  <span className="ops-label mt-0.5 shrink-0 text-ops-accent">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="text-[12px] text-ops-text">{step}</p>
                    <p className="text-[11px] text-ops-faint">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SafeWalkPanel presetDestination={pickedDestination} />

        <Panel
          label="Which way to walk"
          tone={risk && risk.routes[0] && risk.routes[0].risk >= 0.55 ? 'danger' : 'accent'}
          aside={
            <Chip tone="accent">{hour === null ? '—' : `${String(hour).padStart(2, '0')}:00`}</Chip>
          }
        >
          {!risk ? (
            <p className="px-4 py-5 text-[12px] text-ops-muted">Reading the incident history…</p>
          ) : (
            <>
              <ul className="divide-y divide-ops-border/60">
                {risk.routes.map((entry, index) => {
                  const band = describeRoute(entry)
                  const tone =
                    band === 'Quiet' ? 'good' : band === 'Some reports' ? 'warn' : 'danger'
                  return (
                    <li
                      key={entry.route.id}
                      className={`px-4 py-3 ${index === 0 ? 'bg-emerald-400/5' : ''}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {index === 0 && <Chip tone="good">Take this one</Chip>}
                        <span className="text-[13px] font-medium text-ops-text">
                          {entry.route.name}
                        </span>
                        <span className="ml-auto">
                          <Chip tone={tone}>{band}</Chip>
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-ops-muted">
                        {entry.reason}
                      </p>
                      <div className="mt-2">
                        <MiniBar
                          value={entry.risk * 100}
                          max={100}
                          tone={tone === 'good' ? 'good' : tone === 'warn' ? 'accent' : 'danger'}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="border-t border-ops-border/70 px-4 py-2.5 text-[11px] leading-relaxed text-ops-faint">
                Ranked from what has actually been reported near each route at this hour. Every
                route is listed — the shorter way is never hidden, because that choice is yours.
              </p>
            </>
          )}
        </Panel>

        <Panel
          label="SIGHTLINE · repeat patterns"
          aside={
            <Chip tone={risk?.patterns.length ? 'warn' : 'good'}>{risk?.patterns.length ?? 0}</Chip>
          }
        >
          {!risk || risk.patterns.length === 0 ? (
            <p className="px-4 py-5 text-[12px] leading-relaxed text-ops-muted">
              No repeat patterns detected. A pattern needs at least three reports from two different
              people in the same place and hour band.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-ops-border/60">
                {risk.patterns.map((pattern) => (
                  <li key={pattern.id} className="px-4 py-2.5">
                    <p className="text-[12px] text-ops-text">{pattern.headline}</p>
                    <p className="ops-label mt-1 text-ops-faint">
                      {pattern.category} · {pattern.distinctReporters} distinct reporters
                    </p>
                  </li>
                ))}
              </ul>
              <p className="border-t border-ops-border/70 px-4 py-2.5 text-[11px] leading-relaxed text-ops-faint">
                You could not know this on your own — each of these reports went to the control room
                separately. A pattern needs different people, so one account cannot reroute the
                campus.
              </p>
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}

function WalkStatusChip({ walk, missed }: { walk: SafeWalk; missed: number }) {
  if (walk.status === 'escalated') return <Chip tone="danger">Silent alarm raised</Chip>
  if (walk.status === 'arrived') return <Chip tone="good">Arrived</Chip>
  if (walk.status === 'cancelled') return <Chip>Cancelled</Chip>
  if (missed >= 1) return <Chip tone="warn">{missed} missed check-in</Chip>
  return <Chip tone="accent">Walking</Chip>
}
