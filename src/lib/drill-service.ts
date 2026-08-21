import { randomUUID } from 'node:crypto'
import { findScenario } from '@/data/scenarios'
import {
  buildDrillReport,
  nextStepDelayMs,
  pickDrillTarget,
  scenarioDurationMs,
  type DrillReport,
  type DrillRun,
  type DrillScenario,
  type DrillScenarioId,
  type DrillStep,
} from '@/domain/drill'
import type { Incident } from '@/domain/types'
import { store } from '@/store'
import {
  assignResponder,
  clearDrillIncidents,
  corroborateIncident,
  createIncident,
  getRecommendations,
  listIncidents,
  recordBroadcast,
  updateStatus,
} from './incident-service'

const DRILLS = 'drills'

/** Drill actions are attributed to this actor so the audit trail stays honest. */
const DRILL_ACTOR = 'drill'

const loadRuns = (): Promise<DrillRun[]> => store.readCollection<DrillRun>(DRILLS)

const saveRun = async (run: DrillRun): Promise<void> => {
  const runs = await loadRuns()
  const exists = runs.some((item) => item.id === run.id)
  await store.writeCollection(
    DRILLS,
    exists ? runs.map((item) => (item.id === run.id ? run : item)) : [...runs, run],
  )
}

/** Every drill run, newest first. */
export async function listDrillRuns(): Promise<DrillRun[]> {
  const runs = await loadRuns()
  return [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export async function getDrillRun(drillId: string): Promise<DrillRun | null> {
  const runs = await loadRuns()
  return runs.find((run) => run.id === drillId) ?? null
}

/** The drill still playing back, if any. Only one runs at a time. */
export async function getActiveDrill(): Promise<DrillRun | null> {
  const runs = await listDrillRuns()
  return runs.find((run) => !run.done) ?? null
}

/**
 * Starts a scenario, returning the run and the scenario it plays. The clock
 * starts immediately; nothing executes until the first tick.
 *
 * @example
 * const started = await startDrill('blockc-fire', 2)
 * started?.run.id // => 'drl-1a2b3c4d'
 */
export async function startDrill(
  scenarioId: string,
  speed: number,
): Promise<{ run: DrillRun; scenario: DrillScenario } | null> {
  const scenario = findScenario(scenarioId)
  if (!scenario) return null

  const run: DrillRun = {
    id: `drl-${randomUUID().slice(0, 8)}`,
    scenario: scenario.id as DrillScenarioId,
    startedAt: new Date().toISOString(),
    speed,
    executedSteps: 0,
    incidentIds: [],
    done: false,
    completedAt: null,
  }

  await saveRun(run)
  await store.appendEvent('drill.started', { drillId: run.id, scenario: scenario.id, speed })
  return { run, scenario }
}

/**
 * Executes one scripted step against the real incident pipeline, returning the
 * run with any newly created incident id recorded.
 *
 * Every step goes through the same service functions the consoles use, so a
 * drill incident is a real incident flagged `isDrill` rather than a parallel
 * simulation. That is what makes the after-action report trustworthy.
 */
async function executeStep(step: DrillStep, run: DrillRun): Promise<DrillRun> {
  if (step.kind === 'report') {
    const incident = await createIncident({
      category: step.category,
      severity: step.severity,
      title: step.title,
      description: step.description,
      location: step.location,
      reporterId: DRILL_ACTOR,
      isDrill: true,
    })
    return { ...run, incidentIds: [...run.incidentIds, incident.id] }
  }

  const incidents = await listIncidents()
  const target = pickDrillTarget(incidents, run.incidentIds)
  // A targetless step with every drill incident already resolved is a
  // deliberate no-op, so scenarios can end on epilogue beats.
  if (!target) return run

  switch (step.kind) {
    case 'fuse':
      await corroborateIncident(target.id, step.reports, step.confidence)
      break
    case 'dispatch': {
      const [best] = await getRecommendations(target.id)
      if (best) await assignResponder(target.id, best.responder.id, DRILL_ACTOR)
      break
    }
    case 'advance':
      await updateStatus(target.id, step.status, DRILL_ACTOR)
      break
    case 'broadcast':
      await recordBroadcast(target.id, step.message, DRILL_ACTOR)
      break
    case 'resolve':
      await updateStatus(target.id, 'resolved', DRILL_ACTOR, 'Drill scenario complete')
      break
  }

  return run
}

export interface DrillTick {
  run: DrillRun
  /** Steps executed by this tick. Zero is normal between scripted beats. */
  executed: number
  /** Milliseconds until the next step is due, or null when finished. */
  nextStepInMs: number | null
  elapsedMs: number
  durationMs: number
}

/**
 * Advances a drill to its current clock position, executing every step that
 * has come due. Idempotent by construction: the executed-step cursor only
 * moves forward, so a duplicated tick is harmless.
 *
 * Ticks are driven by the client rather than a server timer because a
 * 90-second server loop cannot survive a serverless function timeout — see
 * DECISIONS.md.
 *
 * @example
 * const tick = await tickDrill('drl-1a2b3c4d')
 * tick?.nextStepInMs // => 4200
 */
export async function tickDrill(drillId: string): Promise<DrillTick | null> {
  const existing = await getDrillRun(drillId)
  if (!existing) return null

  const scenario = findScenario(existing.scenario)
  if (!scenario) return null

  const durationMs = scenarioDurationMs(scenario.steps)
  const elapsedMs = (Date.now() - new Date(existing.startedAt).getTime()) * existing.speed

  let run = existing
  let executed = 0

  while (run.executedSteps < scenario.steps.length) {
    const step = scenario.steps[run.executedSteps]
    if (step.afterMs > elapsedMs) break

    run = await executeStep(step, run)
    run = { ...run, executedSteps: run.executedSteps + 1 }
    executed += 1
  }

  if (run.executedSteps >= scenario.steps.length && !run.done) {
    run = { ...run, done: true, completedAt: new Date().toISOString() }
    await store.appendEvent('drill.completed', { drillId: run.id, scenario: run.scenario })
  }

  if (executed > 0 || run.done !== existing.done) await saveRun(run)

  return {
    run,
    executed,
    nextStepInMs: nextStepDelayMs(scenario.steps, run.executedSteps, elapsedMs),
    elapsedMs: Math.min(elapsedMs, durationMs),
    durationMs,
  }
}

/**
 * The graded after-action report for a run, built from the timelines of the
 * incidents that run produced.
 *
 * @example
 * (await getDrillAfterAction('drl-1a2b3c4d'))?.grade // => 'A'
 */
export async function getDrillAfterAction(drillId: string): Promise<DrillReport | null> {
  const run = await getDrillRun(drillId)
  if (!run) return null

  const incidents = await listIncidents()
  const drillIncidents: Incident[] = incidents.filter((incident) =>
    run.incidentIds.includes(incident.id),
  )
  return buildDrillReport(run, drillIncidents, new Date())
}

/** Clears every drill run and the incidents they produced. */
export async function resetDrills(): Promise<void> {
  await store.writeCollection<DrillRun>(DRILLS, [])
  await clearDrillIncidents()
}
