'use client'

import { useEffect, useState } from 'react'
import { Chip, Panel, Stat } from '@/components/ui/Panel'
import { formatTime, useLiveClock } from '@/components/ui/use-live-clock'
import {
  MIN_DISTINCT_REPORTERS,
  MIN_PATTERN_INCIDENTS,
  PATTERN_RADIUS_M,
  RISK_WINDOW_DAYS,
  activeAtHour,
  type RiskPattern,
} from '@/domain/risk-map'

interface RiskSnapshot {
  patterns: RiskPattern[]
  liveCount: number
  simulatedCount: number
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/**
 * SIGHTLINE's own screen — the evidence, not the advice.
 *
 * Safe Walk owns the map and the recommendation: which way to walk, now. This
 * page is the working behind it — which places repeat, at which hours, on how
 * many separate people's word, and what a cluster must clear before it is
 * allowed to influence anyone's route. Deliberately no map and no route list:
 * repeating either would make this a second copy of Safe Walk rather than the
 * thing that justifies it.
 */
export function SightlineWorkspace() {
  const now = useLiveClock()
  const [risk, setRisk] = useState<RiskSnapshot | null>(null)

  const hour = now?.getHours() ?? null

  // Which patterns exist does not depend on the hour — only which of them are
  // awake does — so this loads once rather than on every tick of the clock.
  useEffect(() => {
    void fetch('/api/risk')
      .then((response) => response.json() as Promise<RiskSnapshot>)
      .then(setRisk)
      .catch(() => setRisk(null))
  }, [])

  const awake =
    hour === null ? [] : (risk?.patterns.filter((pattern) => activeAtHour(pattern, hour)) ?? [])
  const clock = formatTime(now)
  const band = hour === null ? '—' : `${String(hour).padStart(2, '0')}:00`

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Panel spotlight>
          <div className="p-4">
            <Stat value={clock} label="campus clock" tone="accent" />
          </div>
        </Panel>
        <Panel spotlight>
          <div className="p-4">
            <Stat value={awake.length} label="awake now" tone={awake.length ? 'danger' : 'good'} />
          </div>
        </Panel>
        <Panel spotlight>
          <div className="p-4">
            <Stat value={risk?.patterns.length ?? 0} label="patterns total" />
          </div>
        </Panel>
        <Panel spotlight>
          <div className="p-4">
            <Stat
              value={(risk?.liveCount ?? 0) + (risk?.simulatedCount ?? 0)}
              label="reports read"
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="flex flex-col gap-4">
          <Panel label="The shape of the day" aside={<Chip tone="accent">now {clock}</Chip>}>
            <div className="p-4">
              <DayStrip patterns={risk?.patterns ?? []} hour={hour} />
              <p className="mt-3 text-[11px] leading-relaxed text-ops-faint">
                One cell per hour, darker where a pattern is awake. The hour is read from the clock
                and nothing here is set by hand — a walker at eleven at night should not have to
                tell the page it is eleven at night.
              </p>
            </div>
          </Panel>

          <Panel
            label={awake.length ? 'Awake right now' : 'Nothing awake right now'}
            tone={awake.length ? 'danger' : undefined}
          >
            {!risk ? (
              <p className="px-4 py-5 text-[12px] text-ops-muted">Reading the incident history…</p>
            ) : awake.length === 0 ? (
              <p className="px-4 py-5 text-[12px] leading-relaxed text-ops-muted">
                No pattern covers the {band} band. The ones this campus has run in the evening
                and late at night — they are listed below with the hours they hold.
              </p>
            ) : (
              <ul className="divide-y divide-ops-border/60">
                {awake.map((pattern) => (
                  <li key={pattern.id} className="px-4 py-3">
                    <p className="text-[13px] font-medium text-ops-text">{pattern.headline}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ops-muted">
                      {pattern.distinctReporters} different people reported this, separately, to the
                      control room. None of them could have known about the others.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel label="Every pattern" aside={<Chip>{risk?.patterns.length ?? 0}</Chip>}>
            {!risk || risk.patterns.length === 0 ? (
              <p className="px-4 py-5 text-[12px] text-ops-muted">
                Nothing has cleared the bar yet.
              </p>
            ) : (
              <ul className="divide-y divide-ops-border/60">
                {risk.patterns.map((pattern) => (
                  <li key={pattern.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] text-ops-text">{pattern.headline}</span>
                      {hour !== null && activeAtHour(pattern, hour) && (
                        <Chip tone="danger">awake</Chip>
                      )}
                      <span className="ops-label ml-auto text-ops-faint">
                        weight {pattern.weight.toFixed(2)}
                      </span>
                    </div>
                    <p className="ops-label mt-1 text-ops-faint">
                      {pattern.category} · {pattern.incidentCount} reports ·{' '}
                      {pattern.distinctReporters} distinct reporters
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel label="What a cluster has to clear">
            <dl className="divide-y divide-ops-border/60">
              <Rule
                term={`${MIN_PATTERN_INCIDENTS} reports minimum`}
                detail="Two incidents in the same place is a coincidence worth nobody's detour."
              />
              <Rule
                term={`${MIN_DISTINCT_REPORTERS} different people minimum`}
                detail="One account filing repeatedly says nothing about the place. Without this rule, a single person could reroute strangers away from anywhere they disliked. Anonymous reports still count separately — anonymity must not collapse six voices into one."
              />
              <Rule
                term={`Within ${PATTERN_RADIUS_M} m and a 3-hour band`}
                detail="Reports have to be near each other in both space and time, because a place that is fine at noon and not at midnight is two different facts."
              />
              <Rule
                term={`Inside ${RISK_WINDOW_DAYS} days`}
                detail="Older reports fade linearly to nothing. A fixed light or a changed patrol route should stop counting against a path."
              />
              <Rule
                term="Drills excluded"
                detail="A rehearsed emergency is not evidence about where real ones happen. Letting the Block C fire drill reroute students around Block C every night would be an own goal."
              />
              <Rule
                term="Never called safe"
                detail="The bands are Quiet, Unlit, Some reports and Avoid if you can. Every route stays listed — the shorter way is never hidden, because that choice belongs to the person walking."
              />
            </dl>
          </Panel>

          <Panel label="Where this is used">
            <p className="px-4 py-3 text-[12px] leading-relaxed text-ops-muted">
              Safe Walk ranks tonight&rsquo;s routes against whichever of these patterns is awake,
              and draws them on the campus map. This page exists so that ranking can be checked
              rather than trusted.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Rule({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="px-4 py-2.5">
      <dt className="text-[12px] font-medium text-ops-text">{term}</dt>
      <dd className="mt-0.5 text-[11px] leading-relaxed text-ops-muted">{detail}</dd>
    </div>
  )
}

/** One cell per hour, darker where a pattern is awake, with now marked. */
function DayStrip({ patterns, hour }: { patterns: readonly RiskPattern[]; hour: number | null }) {
  return (
    <div>
      <div className="flex gap-0.5">
        {HOURS.map((candidate) => {
          const weight = patterns
            .filter((pattern) => activeAtHour(pattern, candidate))
            .reduce((peak, pattern) => Math.max(peak, pattern.weight), 0)

          return (
            <div
              key={candidate}
              title={`${String(candidate).padStart(2, '0')}:00`}
              className={`h-8 flex-1 rounded-sm ${
                candidate === hour ? 'ring-1 ring-ops-accent' : ''
              }`}
              style={{
                backgroundColor: weight > 0 ? '#ef4444' : '#1e293b',
                opacity: weight > 0 ? 0.25 + weight * 0.65 : 0.5,
              }}
            />
          )
        })}
      </div>

      <div className="mt-1.5 flex justify-between">
        {[0, 6, 12, 18, 23].map((mark) => (
          <span key={mark} className="ops-label text-ops-faint">
            {String(mark).padStart(2, '0')}:00
          </span>
        ))}
      </div>
    </div>
  )
}
