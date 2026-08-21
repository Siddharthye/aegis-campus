'use client'

import { useEffect, useState } from 'react'
import { Chip, MiniBar, Panel, Stat } from '@/components/ui/Panel'
import { Campus25Map } from '@/components/sentinel/Campus25Map'
import {
  MIN_DISTINCT_REPORTERS,
  MIN_PATTERN_INCIDENTS,
  PATTERN_RADIUS_M,
  RISK_WINDOW_DAYS,
  describeRoute,
  type RiskPattern,
  type RouteRisk,
} from '@/domain/risk-map'

interface RiskSnapshot {
  patterns: RiskPattern[]
  routes: RouteRisk[]
  atHour: number
  liveCount: number
  simulatedCount: number
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/**
 * SIGHTLINE's own screen — the campus seen through what has been reported.
 *
 * Safe Walk answers "which way should I go now". This answers the question
 * behind it: which places repeat, at which hours, and on whose word. The hour
 * scrubber is the point of the page — dragging from noon to midnight makes the
 * risk appear and the route ranking invert, which is the whole argument for
 * scoring by hour rather than by place alone.
 */
export function SightlineWorkspace() {
  const [hour, setHour] = useState(() => new Date().getHours())
  const [risk, setRisk] = useState<RiskSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let current = true
    setLoading(true)

    void fetch(`/api/risk?hour=${hour}`)
      .then((response) => response.json() as Promise<RiskSnapshot>)
      .then((snapshot) => {
        // A slow earlier hour must not overwrite the hour now being shown.
        if (current) setRisk(snapshot)
      })
      .catch(() => {
        if (current) setRisk(null)
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
    }
  }, [hour])

  const worst = risk?.routes[risk.routes.length - 1]

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
      <div className="flex flex-col gap-4">
        <Panel
          label="Hour of day"
          aside={<Chip tone="accent">{String(hour).padStart(2, '0')}:00</Chip>}
        >
          <div className="p-4">
            <label className="sr-only" htmlFor="sightline-hour">
              Hour of day to score routes for
            </label>
            <input
              id="sightline-hour"
              type="range"
              min={0}
              max={23}
              step={1}
              value={hour}
              onChange={(event) => setHour(Number(event.target.value))}
              className="w-full accent-ops-accent"
            />

            <div className="mt-2 flex justify-between">
              {[0, 6, 12, 18, 23].map((mark) => (
                <button
                  key={mark}
                  type="button"
                  onClick={() => setHour(mark)}
                  className="ops-label text-ops-faint transition-colors hover:text-ops-accent"
                >
                  {String(mark).padStart(2, '0')}:00
                </button>
              ))}
            </div>

            {/* A row of blocks, one per hour, lit where a pattern is active —
                so the shape of the night is visible without dragging. */}
            <HourStrip patterns={risk?.patterns ?? []} hour={hour} onPick={setHour} />

            <p className="mt-3 text-[11px] leading-relaxed text-ops-faint">
              Drag to any hour and the ranking below re-scores. Nothing about the places changes —
              only which patterns are awake.
            </p>
          </div>
        </Panel>
        <Panel
          label="Reported risk by hour"
          aside={
            <span className="flex items-center gap-2">
              {loading && <Chip>reading…</Chip>}
              <Chip tone={risk?.patterns.length ? 'warn' : 'good'}>
                {risk?.patterns.length ?? 0} patterns
              </Chip>
            </span>
          }
        >
          <div className="p-3">
            <Campus25Map walks={[]} patterns={risk?.patterns ?? []} routes={risk?.routes ?? []} />
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel spotlight>
            <div className="p-4">
              <Stat
                value={risk?.patterns.length ?? 0}
                label="patterns"
                tone={risk?.patterns.length ? 'danger' : 'good'}
              />
            </div>
          </Panel>
          <Panel spotlight>
            <div className="p-4">
              <Stat value={risk?.liveCount ?? 0} label="live reports" />
            </div>
          </Panel>
          <Panel spotlight>
            <div className="p-4">
              <Stat value={risk?.simulatedCount ?? 0} label="simulated" />
            </div>
          </Panel>
        </div>

        <Panel label="Routes at this hour" tone={worst && worst.risk >= 0.55 ? 'danger' : 'accent'}>
          {!risk ? (
            <p className="px-4 py-5 text-[12px] text-ops-muted">Reading the incident history…</p>
          ) : (
            <ul className="divide-y divide-ops-border/60">
              {risk.routes.map((entry, index) => {
                const band = describeRoute(entry)
                const tone =
                  band === 'Quiet' ? 'good' : band === 'Avoid if you can' ? 'danger' : 'warn'

                return (
                  <li
                    key={entry.route.id}
                    className={`px-4 py-3 ${index === 0 ? 'bg-emerald-400/5' : ''}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {index === 0 && <Chip tone="good">Safest</Chip>}
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
          )}
        </Panel>

        <Panel label="Patterns detected" aside={<Chip>{risk?.patterns.length ?? 0}</Chip>}>
          {!risk || risk.patterns.length === 0 ? (
            <p className="px-4 py-5 text-[12px] leading-relaxed text-ops-muted">
              Nothing meets the bar right now. Try 22:00 — the night patterns are the ones this
              campus actually has.
            </p>
          ) : (
            <ul className="divide-y divide-ops-border/60">
              {risk.patterns.map((pattern) => (
                <li key={pattern.id} className="px-4 py-3">
                  <p className="text-[12px] text-ops-text">{pattern.headline}</p>
                  <p className="ops-label mt-1 text-ops-faint">
                    {pattern.category} · {pattern.distinctReporters} distinct reporters · weight{' '}
                    {pattern.weight.toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="What counts as a pattern">
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
          </dl>
        </Panel>
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

/** One cell per hour, lit where any pattern is awake. */
function HourStrip({
  patterns,
  hour,
  onPick,
}: {
  patterns: readonly RiskPattern[]
  hour: number
  onPick: (hour: number) => void
}) {
  return (
    <div className="mt-3 flex gap-0.5">
      {HOURS.map((candidate) => {
        const weight = patterns
          .filter((pattern) => candidate >= pattern.fromHour && candidate < pattern.toHour)
          .reduce((peak, pattern) => Math.max(peak, pattern.weight), 0)

        return (
          <button
            key={candidate}
            type="button"
            title={`${String(candidate).padStart(2, '0')}:00`}
            aria-label={`Score routes for ${String(candidate).padStart(2, '0')}:00`}
            onClick={() => onPick(candidate)}
            className={`h-7 flex-1 rounded-sm transition-opacity hover:opacity-100 ${
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
  )
}
