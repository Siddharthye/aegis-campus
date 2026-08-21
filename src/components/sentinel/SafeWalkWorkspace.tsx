'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listBuildings } from '@/domain/beacon'
import { CHECK_IN_INTERVAL_MS, missedCheckIns, walkProgress, type SafeWalk } from '@/domain/safe-walk'
import { SAFE_ZONES } from '@/data/safe-zones'
import { createPlanProjection, footprintPoints } from '@/components/report/plan-math'
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

  const refresh = useCallback(async () => {
    const response = await fetch('/api/safe-walk')
    if (!response.ok) return
    const body = (await response.json()) as { walks: SafeWalk[] }
    setWalks(body.walks)
  }, [])

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
              <Chip tone="good">{SAFE_ZONES.length} muster points</Chip>
              <Chip tone={active.length ? 'accent' : 'default'}>{active.length} walking</Chip>
            </>
          }
        >
          <div className="p-3">
            <RouteMap walks={walks} />
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
              <Stat value={escalated.length} label="escalated" tone={escalated.length ? 'danger' : 'default'} />
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
      </div>

      <div className="flex flex-col gap-4">
        <SafeWalkPanel />

        <Panel label="Muster points nearby" aside={<Chip tone="good">Safe</Chip>}>
          <ul className="divide-y divide-ops-border/60">
            {SAFE_ZONES.map((zone) => (
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

        <Panel label="How escalation works">
          <ol className="flex flex-col gap-2.5 px-4 py-3.5">
            {[
              ['You set a destination and an ETA', 'Nothing is shared beyond that.'],
              ['AEGIS asks you to confirm every 3 minutes', 'One tap. That is the whole interaction.'],
              ['Two missed check-ins, or a bad overrun', 'A silent alarm opens with your last position.'],
              ['The control room sees the trail', 'Ending it is their call once a human reaches you.'],
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
  )
}

function WalkStatusChip({ walk, missed }: { walk: SafeWalk; missed: number }) {
  if (walk.status === 'escalated') return <Chip tone="danger">Silent alarm raised</Chip>
  if (walk.status === 'arrived') return <Chip tone="good">Arrived</Chip>
  if (walk.status === 'cancelled') return <Chip>Cancelled</Chip>
  if (missed >= 1) return <Chip tone="warn">{missed} missed check-in</Chip>
  return <Chip tone="accent">Walking</Chip>
}

/** The campus footprint with muster points and any live breadcrumb trails. */
function RouteMap({ walks }: { walks: readonly SafeWalk[] }) {
  const buildings = useMemo(() => listBuildings(), [])
  const plan = useMemo(() => createPlanProjection(buildings, 720), [buildings])

  const trails = walks.filter((walk) => walk.status === 'walking' || walk.status === 'escalated')

  return (
    <svg
      viewBox={`0 0 ${plan.width} ${plan.height}`}
      role="img"
      aria-label="Campus map with muster points and active safe-walk routes"
      className="w-full rounded-xl border border-ops-border/70 bg-ops-bg"
    >
      {buildings.map((building) => (
        <polygon
          key={building.id}
          points={footprintPoints(building, plan)}
          className="fill-ops-lift stroke-ops-border"
          strokeWidth={0.6}
        />
      ))}

      {SAFE_ZONES.map((zone) => {
        const { x, y } = plan.toXY(zone)
        return (
          <g key={zone.id}>
            <circle cx={x} cy={y} r={11} className="fill-emerald-400/12 stroke-emerald-400/50" strokeWidth={1} />
            <circle cx={x} cy={y} r={3} className="fill-emerald-400" />
            <text
              x={x}
              y={y - 15}
              textAnchor="middle"
              style={{ fontSize: 9, fill: 'rgb(52 211 153)', fontFamily: 'var(--font-jetbrains), monospace' }}
            >
              {zone.name}
            </text>
          </g>
        )
      })}

      {trails.map((walk) => {
        const points = walk.path.map((point) => plan.toXY(point))
        if (points.length === 0) return null
        const last = points[points.length - 1]
        const danger = walk.status === 'escalated'

        return (
          <g key={walk.id}>
            {points.length > 1 && (
              <polyline
                points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                className={danger ? 'stroke-sev-p0' : 'stroke-ops-accent'}
                strokeWidth={1.6}
                strokeDasharray="4 3"
              />
            )}
            <circle
              cx={last.x}
              cy={last.y}
              r={5}
              className={danger ? 'siren-pulse fill-sev-p0' : 'fill-ops-accent'}
            />
          </g>
        )
      })}
    </svg>
  )
}
