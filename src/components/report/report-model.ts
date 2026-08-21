import type { IncidentCategory, Severity } from '@/domain/types'

/**
 * Static vocabulary for the three-tap report flow: category tiles, their
 * preselected severities, and title suggestion. Pure data + pure functions so
 * the wizard components stay presentational.
 */

/** One tap target on step 1. `defaultSeverity` follows the triage doctrine. */
export interface CategoryOption {
  category: IncidentCategory
  label: string
  hint: string
  defaultSeverity: Severity
}

/**
 * The six report categories, in tap-priority order. Fire is P0 by doctrine —
 * over-alerting on fire is cheaper than under-alerting.
 *
 * @example
 * CATEGORY_OPTIONS.find((o) => o.category === 'fire')?.defaultSeverity // => 'P0'
 */
export const CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { category: 'fire', label: 'Fire', hint: 'Smoke, flames, alarms', defaultSeverity: 'P0' },
  { category: 'medical', label: 'Medical', hint: 'Injury, collapse, illness', defaultSeverity: 'P1' },
  { category: 'harassment', label: 'Harassment', hint: 'Threats, stalking, abuse', defaultSeverity: 'P1' },
  { category: 'infrastructure', label: 'Infrastructure', hint: 'Leaks, power, damage', defaultSeverity: 'P2' },
  { category: 'security', label: 'Security', hint: 'Theft, intrusion, suspicious', defaultSeverity: 'P2' },
  { category: 'other', label: 'Other', hint: 'Anything else worth eyes', defaultSeverity: 'P3' },
] as const

const TITLE_BASE: Record<IncidentCategory, string> = {
  fire: 'Fire reported',
  medical: 'Medical emergency',
  harassment: 'Harassment reported',
  infrastructure: 'Infrastructure issue',
  security: 'Security concern',
  other: 'Incident reported',
}

/** Trims a location label to its most specific leading segments. */
const shortPlace = (label: string): string => label.split(' · ').slice(0, 2).join(' · ')

/**
 * Suggests an incident title from what the reporter has already given us, so
 * the review step is pre-filled and sending stays a single tap. A meaningful
 * description wins over the generic category phrasing.
 *
 * @example
 * suggestTitle('fire', 'Block C · Floor 3 · Stairwell', '')
 * // => "Fire reported — Block C · Floor 3"
 */
export function suggestTitle(
  category: IncidentCategory,
  locationLabel: string | null,
  description: string,
): string {
  const trimmed = description.trim().replace(/\s+/g, ' ')
  const place = locationLabel ? ` — ${shortPlace(locationLabel)}` : ''

  if (trimmed.length >= 12) {
    const firstSentence = trimmed.split(/[.!?\n]/)[0]
    const snippet = firstSentence.length > 70 ? `${firstSentence.slice(0, 67).trimEnd()}…` : firstSentence
    return `${snippet.charAt(0).toUpperCase()}${snippet.slice(1)}`.slice(0, 140)
  }

  return `${TITLE_BASE[category]}${place}`.slice(0, 140)
}
