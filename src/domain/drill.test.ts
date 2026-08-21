import { describe, expect, it } from 'vitest'
import {
  buildDrillReport,
  formatClock,
  gradeFromSla,
  nextStepDelayMs,
  pickDrillTarget,
  scenarioDurationMs,
  type DrillRun,
  type DrillStep,
} from './drill'
import type { Incident } from './types'

const steps: DrillStep[] = [
  { kind: 'dispatch', afterMs: 0 },
  { kind: 'advance', afterMs: 5_000, status: 'on-scene' },
  { kind: 'resolve', afterMs: 30_000 },
]

describe('scenarioDurationMs', () => {
  it('is the offset of the final beat', () => {
    expect(scenarioDurationMs(steps)).toBe(30_000)
  })

  it('is zero for an empty scenario', () => {
    expect(scenarioDurationMs([])).toBe(0)
  })
})

describe('nextStepDelayMs', () => {
  it('counts down to the next scripted beat', () => {
    expect(nextStepDelayMs(steps, 1, 4_000)).toBe(1_000)
  })

  it('reports an overdue step as due now, never as negative', () => {
    expect(nextStepDelayMs(steps, 1, 9_000)).toBe(0)
  })

  it('returns null once the scenario is exhausted', () => {
    expect(nextStepDelayMs(steps, 3, 60_000)).toBeNull()
  })
})

describe('pickDrillTarget', () => {
  const incident = (id: string, createdAt: string, status: Incident['status']): Incident =>
    ({ id, createdAt, status }) as Incident

  it('acts on the most recent unresolved incident of this run', () => {
    const target = pickDrillTarget(
      [
        incident('older', '2026-08-21T10:00:00.000Z', 'reported'),
        incident('newer', '2026-08-21T10:05:00.000Z', 'reported'),
      ],
      ['older', 'newer'],
    )
    expect(target?.id).toBe('newer')
  })

  it('ignores incidents belonging to another run', () => {
    const target = pickDrillTarget(
      [
        incident('mine', '2026-08-21T10:00:00.000Z', 'reported'),
        incident('theirs', '2026-08-21T10:09:00.000Z', 'reported'),
      ],
      ['mine'],
    )
    expect(target?.id).toBe('mine')
  })

  it('returns null when every drill incident is resolved, so epilogues no-op', () => {
    const target = pickDrillTarget(
      [incident('done', '2026-08-21T10:00:00.000Z', 'resolved')],
      ['done'],
    )
    expect(target).toBeNull()
  })
})

describe('gradeFromSla', () => {
  it('awards an A only for a clean sweep', () => {
    expect(gradeFromSla(2, 2)).toBe('A')
    expect(gradeFromSla(3, 4)).toBe('B')
    expect(gradeFromSla(1, 2)).toBe('C')
    expect(gradeFromSla(1, 4)).toBe('D')
  })

  it('grades a drill that produced nothing as D rather than a free A', () => {
    expect(gradeFromSla(0, 0)).toBe('D')
  })
})

describe('buildDrillReport', () => {
  const run: DrillRun = {
    id: 'drl-test',
    scenario: 'blockc-fire',
    startedAt: '2026-08-21T10:00:00.000Z',
    speed: 1,
    executedSteps: 3,
    incidentIds: ['inc-1'],
    done: true,
    completedAt: '2026-08-21T10:01:30.000Z',
  }

  const incident: Incident = {
    id: 'inc-1',
    title: 'Smoke in Block C',
    severity: 'P0',
    createdAt: '2026-08-21T10:00:00.000Z',
    resolvedAt: '2026-08-21T10:01:20.000Z',
    timeline: [
      { at: '2026-08-21T10:00:00.000Z', actor: 'drill', action: 'reported' },
      { at: '2026-08-21T10:00:20.000Z', actor: 'fusion', action: 'corroborated' },
      { at: '2026-08-21T10:00:32.000Z', actor: 'drill', action: 'dispatched' },
      { at: '2026-08-21T10:00:40.000Z', actor: 'drill', action: 'broadcast' },
      { at: '2026-08-21T10:01:20.000Z', actor: 'drill', action: 'resolved' },
    ],
  } as Incident

  const report = buildDrillReport(run, [incident], new Date('2026-08-21T10:02:00.000Z'))

  it('measures each milestone from the moment the report landed', () => {
    const [review] = report.incidents
    expect(review.timeToTriageMs).toBe(20_000)
    expect(review.timeToDispatchMs).toBe(32_000)
    expect(review.timeToResolveMs).toBe(80_000)
  })

  it('counts a P0 resolved inside five minutes as meeting its SLA', () => {
    expect(report.incidents[0].slaMet).toBe(true)
    expect(report.slaMet).toBe(1)
    expect(report.slaTotal).toBe(1)
    expect(report.grade).toBe('A')
  })

  it('counts the broadcasts and dispatches it actually observed', () => {
    expect(report.broadcasts).toBe(1)
    expect(report.dispatchAcks).toBe(1)
  })

  it('reports total drill duration', () => {
    expect(report.durationMs).toBe(90_000)
  })

  it('does not credit an unresolved incident with meeting its SLA', () => {
    const unresolved = { ...incident, resolvedAt: null }
    const graded = buildDrillReport(run, [unresolved], new Date('2026-08-21T10:02:00.000Z'))

    expect(graded.incidents[0].slaMet).toBe(false)
    expect(graded.grade).toBe('D')
  })
})

describe('formatClock', () => {
  it('renders mm:ss', () => {
    expect(formatClock(83_000)).toBe('01:23')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(600_000)).toBe('10:00')
  })

  it('clamps negatives instead of printing a minus sign', () => {
    expect(formatClock(-5_000)).toBe('00:00')
  })
})
