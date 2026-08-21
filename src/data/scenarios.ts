import type { DrillScenario } from '@/domain/drill'
import { CAMPUS_CENTRE } from './campus'

/**
 * Scripted drill scenarios. These are the demo's safety net and a real
 * product feature: campuses are required to run and measure evacuation
 * drills, and a scripted scenario is how you measure one the same way twice.
 *
 * Authoring rules, enforced by review rather than by types:
 * `afterMs` must be non-decreasing within a scenario (playback is a single
 * cursor), and every scenario must end resolved so the after-action report
 * can grade it.
 */

/** Roughly 100 metres in decimal degrees at this latitude. */
const HM = 0.0009

const blockC = { lat: CAMPUS_CENTRE.lat + 0 * HM, lng: CAMPUS_CENTRE.lng - 0.6 * HM }
const library = { lat: CAMPUS_CENTRE.lat + 0.4 * HM, lng: CAMPUS_CENTRE.lng + 0.6 * HM }

/**
 * The headline scenario: a fire in Block C reported by four people in ninety
 * seconds. Shows fusion, velocity-driven escalation, dispatch, a geofenced
 * broadcast, and resolution — the entire pipeline in one button press.
 */
const blockCFire: DrillScenario = {
  id: 'blockc-fire',
  name: 'Block C — Fire, Floor 3',
  description:
    'Four reports of smoke in the Block C east stairwell arrive within ninety seconds. Fusion collapses them into one incident, velocity escalates it to P0, fire responds, the floor is broadcast to evacuate.',
  steps: [
    {
      kind: 'report',
      afterMs: 0,
      category: 'fire',
      severity: 'P2',
      title: 'Smoke in Block C east stairwell',
      description: 'Smell of smoke and light haze on the third-floor landing of the east stairwell.',
      location: {
        lat: blockC.lat,
        lng: blockC.lng,
        label: 'Block C · Floor 3 · Stairwell',
        method: 'qr-anchor',
        confidence: 0.99,
        floor: 3,
        buildingId: 'block-c',
      },
    },
    { kind: 'fuse', afterMs: 8_000, reports: 6, confidence: 0.74 },
    { kind: 'fuse', afterMs: 16_000, reports: 14, confidence: 0.89 },
    { kind: 'advance', afterMs: 20_000, status: 'triaged' },
    { kind: 'fuse', afterMs: 26_000, reports: 21, confidence: 0.96 },
    { kind: 'dispatch', afterMs: 32_000 },
    {
      kind: 'broadcast',
      afterMs: 40_000,
      message: 'Fire alarm — Block C. Evacuate via the west stairwell. Do not use lifts.',
    },
    { kind: 'advance', afterMs: 54_000, status: 'on-scene' },
    { kind: 'resolve', afterMs: 78_000 },
  ],
}

/**
 * The quieter second scenario, for showing that the pipeline is general and
 * not a one-trick script: a single-reporter medical case with no fusion.
 */
const libraryMedical: DrillScenario = {
  id: 'library-medical',
  name: 'Central Library — Medical',
  description:
    'One reporter, one incident, no duplicates to fuse. Demonstrates the same dispatch and SLA machinery on a routine medical call.',
  steps: [
    {
      kind: 'report',
      afterMs: 0,
      category: 'medical',
      severity: 'P1',
      title: 'Student collapsed in the reading hall',
      description: 'Student collapsed between the stacks on the first floor. Conscious but disoriented.',
      location: {
        lat: library.lat,
        lng: library.lng,
        label: 'Central Library · Floor 1 · Reading hall',
        method: 'qr-anchor',
        confidence: 0.99,
        floor: 1,
        buildingId: 'library',
      },
    },
    { kind: 'advance', afterMs: 6_000, status: 'triaged' },
    { kind: 'dispatch', afterMs: 12_000 },
    { kind: 'advance', afterMs: 28_000, status: 'on-scene' },
    { kind: 'resolve', afterMs: 44_000 },
  ],
}

/** Every scenario the drill panel can run, in menu order. */
export const DRILL_SCENARIOS: readonly DrillScenario[] = [blockCFire, libraryMedical]

/**
 * Looks up a scenario by id.
 *
 * @example
 * findScenario('blockc-fire')?.name // => 'Block C — Fire, Floor 3'
 */
export function findScenario(id: string): DrillScenario | null {
  return DRILL_SCENARIOS.find((scenario) => scenario.id === id) ?? null
}
