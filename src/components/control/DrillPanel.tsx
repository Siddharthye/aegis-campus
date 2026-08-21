'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatClock, type DrillReport, type DrillRun } from '@/domain/drill'
import { AfterActionReport } from './AfterActionReport'

/** How often the client advances the drill clock. See DECISIONS.md. */
const TICK_INTERVAL_MS = 1000

interface ScenarioSummary {
  id: string
  name: string
  description: string
  stepCount: number
}

interface DrillCatalogue {
  scenarios: ScenarioSummary[]
  active: DrillRun | null
}

/**
 * DRILL MODE — runs a scripted campus emergency through the real pipeline.
 *
 * The tick loop lives on the client because a 90-second server-side timer
 * cannot survive a serverless function timeout. `POST /api/drill/tick` is
 * idempotent, so a missed or duplicated tick is harmless.
 */
export function DrillPanel({ onPipelineChange }: { onPipelineChange: () => void }) {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [run, setRun] = useState<DrillRun | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [report, setReport] = useState<DrillReport | null>(null)
  const [speed, setSpeed] = useState(1)

  // Held in a ref so the interval closure always sees the latest callback
  // without being torn down and rebuilt on every parent render.
  const notifyRef = useRef(onPipelineChange)
  notifyRef.current = onPipelineChange

  useEffect(() => {
    void fetch('/api/drill')
      .then((response) => response.json() as Promise<DrillCatalogue>)
      .then((catalogue) => {
        setScenarios(catalogue.scenarios)
        setRun(catalogue.active)
      })
      .catch(() => {
        // The panel is optional chrome; a failed catalogue load must not take
        // the control room down with it.
      })
  }, [])

  const loadReport = useCallback(async (drillId: string) => {
    const response = await fetch(`/api/drill/${drillId}/report`)
    if (!response.ok) return
    const body = (await response.json()) as { report: DrillReport }
    setReport(body.report)
  }, [])

  useEffect(() => {
    if (!run || run.done) return

    const interval = setInterval(async () => {
      const response = await fetch('/api/drill/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drillId: run.id }),
      })
      if (!response.ok) return

      const tick = (await response.json()) as {
        run: DrillRun
        executed: number
        elapsedMs: number
        durationMs: number
      }

      setRun(tick.run)
      setElapsedMs(tick.elapsedMs)
      setDurationMs(tick.durationMs)
      if (tick.executed > 0) notifyRef.current()
      if (tick.run.done) void loadReport(tick.run.id)
    }, TICK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [run, loadReport])

  const start = async (scenarioId: string) => {
    setReport(null)
    setElapsedMs(0)
    const response = await fetch('/api/drill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: scenarioId, speed }),
    })
    if (!response.ok) return
    const body = (await response.json()) as { run: DrillRun }
    setRun(body.run)
  }

  const reset = async () => {
    await fetch('/api/drill', { method: 'DELETE' })
    setRun(null)
    setReport(null)
    setElapsedMs(0)
    onPipelineChange()
  }

  const progress = durationMs > 0 ? Math.min(1, elapsedMs / durationMs) : 0
  const isRunning = run !== null && !run.done

  return (
    <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
      <div className="flex items-center gap-2">
        <p className="ops-label text-ops-muted">Drill mode</p>
        {isRunning && (
          <span className="ops-label ml-auto flex items-center gap-1.5 text-sev-p1">
            <span className="siren-pulse size-1.5 rounded-full bg-current" />
            {formatClock(elapsedMs)} / {formatClock(durationMs)}
          </span>
        )}
        {!isRunning && (
          <label className="ml-auto flex items-center gap-1.5">
            <span className="ops-label text-ops-faint">Speed</span>
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              className="rounded border border-ops-border bg-ops-bg px-1.5 py-0.5 font-mono text-[11px] text-ops-text focus:border-ops-accent/50 focus:outline-none"
            >
              {[1, 2, 4].map((option) => (
                <option key={option} value={option}>
                  {option}×
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {isRunning && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-ops-bg">
          <div
            className="h-full origin-left bg-ops-accent transition-transform duration-1000 ease-linear"
            style={{ transform: `scaleX(${progress})`, width: '100%' }}
          />
        </div>
      )}

      {!isRunning && (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {scenarios.map((scenario) => (
            <li key={scenario.id}>
              <button
                type="button"
                onClick={() => void start(scenario.id)}
                className="w-full rounded-md border border-ops-border bg-ops-bg p-2.5 text-left transition-colors hover:border-ops-accent/40 hover:bg-ops-lift"
              >
                <p className="text-[12px] font-medium text-ops-text">{scenario.name}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ops-muted">
                  {scenario.description}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {report && <AfterActionReport report={report} />}

      {run && (
        <button
          type="button"
          onClick={() => void reset()}
          className="mt-2.5 text-[11px] text-ops-faint underline-offset-2 transition-colors hover:text-ops-muted hover:underline"
        >
          Clear drill and its incidents
        </button>
      )}
    </section>
  )
}
