'use client'

import { useEffect, useState } from 'react'
import type { PulseSnapshot } from '@/lib/pulse-service'
import { HeatCalendar } from './HeatCalendar'

/**
 * PULSE — analytics that end in an instruction.
 *
 * The patrol plan is deliberately the first thing on the page. A hotspot chart
 * tells a safety officer something they mostly already know; "Hostel 9,
 * Tue–Thu 21:00–23:00, 3.2× baseline — recommend patrol" tells them what to do
 * on Tuesday.
 */
export function PulseDashboard() {
  const [pulse, setPulse] = useState<PulseSnapshot | null>(null)

  useEffect(() => {
    void fetch('/api/pulse')
      .then((response) => response.json() as Promise<PulseSnapshot>)
      .then(setPulse)
      .catch(() => {
        // Leaves the loading state up rather than blanking the page.
      })
  }, [])

  if (!pulse) {
    return <p className="text-[12px] text-ops-muted">Computing analytics…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-ops-accent/40 bg-ops-accent/5 p-4">
        <p className="ops-label text-ops-accent">Patrol plan — next 7 days</p>

        {pulse.patrols.length === 0 ? (
          <p className="mt-1.5 text-[12px] text-ops-muted">
            No recurring cluster yet. Recommendations appear once a building and time window repeat.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {pulse.patrols.slice(0, 4).map((patrol) => (
              <li
                key={`${patrol.buildingId}-${patrol.windowLabel}`}
                className="flex items-center gap-3 rounded-md border border-ops-border bg-ops-bg p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ops-text">{patrol.headline}</p>
                  <p className="mt-0.5 text-[11px] text-ops-muted">
                    {patrol.count} incidents · mostly {patrol.dominantCategory}
                  </p>
                </div>
                <span className="ops-label shrink-0 text-sev-p1">
                  {patrol.multiplier.toFixed(1)}×
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
          <p className="ops-label text-ops-muted">When incidents happen</p>
          <div className="mt-2.5">
            <HeatCalendar matrix={pulse.heatCalendar} />
          </div>
        </section>

        <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
          <p className="ops-label text-ops-muted">SLA scorecard</p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {pulse.sla.map((score) => (
              <li key={score.severity} className="flex items-center gap-3">
                <span className="ops-label w-6 shrink-0 text-ops-text">{score.severity}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ops-bg">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${Math.round(score.rate * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-ops-muted">
                  {score.met}/{score.total}
                </span>
              </li>
            ))}
          </ul>

          <p className="ops-label mt-4 text-ops-muted">Mean time to resolve</p>
          <ul className="mt-2 flex flex-col gap-1">
            {pulse.mttr.slice(0, 5).map((entry) => (
              <li key={entry.category} className="flex items-baseline gap-2 text-[12px]">
                <span className="text-ops-text">{entry.category}</span>
                <span className="flex-1 border-b border-dashed border-ops-border" />
                <span className="font-mono text-ops-muted">{entry.meanMinutes}m</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
        <p className="ops-label text-ops-muted">Hotspots</p>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {pulse.hotspots.slice(0, 6).map((hotspot) => (
            <li key={hotspot.buildingId} className="flex items-center gap-3 text-[12px]">
              <span className="min-w-0 flex-1 truncate text-ops-text">{hotspot.name}</span>
              <span className="text-ops-faint">{hotspot.dominantCategory}</span>
              <span className="font-mono text-ops-muted">{hotspot.count}</span>
              <TrendMark trend={hotspot.trend} />
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[11px] leading-relaxed text-ops-faint">
        Computed from {pulse.liveCount} live incident{pulse.liveCount === 1 ? '' : 's'} blended with{' '}
        {pulse.simulatedCount} rows of deterministic simulated history, so pattern detection has
        three weeks to work with on a three-day-old deployment. Drill incidents are excluded.
      </p>
    </div>
  )
}

const TREND_STYLES = {
  up: { mark: '▲', className: 'text-sev-p0' },
  down: { mark: '▼', className: 'text-emerald-400' },
  flat: { mark: '—', className: 'text-ops-faint' },
} as const

function TrendMark({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  const { mark, className } = TREND_STYLES[trend]
  return <span className={`w-3 shrink-0 text-center text-[10px] ${className}`}>{mark}</span>
}
