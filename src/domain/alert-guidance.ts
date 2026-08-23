import type { IncidentCategory, Severity } from './types'

/**
 * What to actually do about an alert.
 *
 * "Fire in B Block" tells a student something is wrong; it does not tell them
 * whether to run, where to, or what not to touch on the way. In the seconds
 * after an alarm nobody reads a policy document, so the guidance here is three
 * steps at most, written as instructions rather than advice, and specific
 * enough to act on without thinking.
 *
 * The wording is deliberately plain and non-alarming. Panic kills people in
 * evacuations, and a screen shouting at someone is a screen they stop reading.
 */

export interface AlertGuidance {
  /** The single thing to do, if they read nothing else. */
  headline: string
  steps: string[]
}

const BY_CATEGORY: Record<IncidentCategory, AlertGuidance> = {
  fire: {
    headline: 'Leave the building now',
    steps: [
      'Use the stairs — never a lift.',
      'If there is smoke, stay low where the air is clearer.',
      'Once outside, stay out. Do not go back for belongings.',
    ],
  },
  medical: {
    headline: 'Give the responders room',
    steps: [
      'Clear a path to the entrance and hold the lift if you can.',
      'Do not move the person unless they are in danger where they are.',
      'If you saw what happened, stay nearby — the medic will want to know.',
    ],
  },
  harassment: {
    headline: 'Move somewhere lit and busy',
    steps: [
      'Head for the nearest open building rather than a shortcut.',
      'Do not confront anyone. Security is already on the way.',
      'Start Safe Walk so the control room can see your route.',
    ],
  },
  security: {
    headline: 'Get inside and stay there',
    steps: [
      'Go into the nearest building and lock or block the door.',
      'Keep away from windows and stay quiet.',
      'Wait for an all-clear from the control room, not from rumour.',
    ],
  },
  infrastructure: {
    headline: 'Keep clear of the area',
    steps: [
      'Do not walk through standing water near sockets or panels.',
      'Use another route rather than stepping over cables or debris.',
      'Report anything spreading — a second report is never a waste.',
    ],
  },
  other: {
    headline: 'Follow the instruction above',
    steps: [
      'Avoid the area named in the alert.',
      'Wait for an all-clear before going back.',
      'Report anything you see that the control room may not know yet.',
    ],
  },
}

/**
 * Guidance for one alert.
 *
 * @example
 * guidanceFor('fire', 'P0').headline // => 'Leave the building now'
 */
export function guidanceFor(category: IncidentCategory, severity: Severity): AlertGuidance {
  const base = BY_CATEGORY[category] ?? BY_CATEGORY.other

  // A P2 or P3 is information, not an emergency. Telling someone to run from
  // a water leak is how they learn to ignore the alert that matters.
  if (severity === 'P2' || severity === 'P3') {
    return {
      headline: 'No action needed — keep clear',
      steps: [base.steps[0], 'Carry on as normal otherwise.'],
    }
  }

  return base
}
