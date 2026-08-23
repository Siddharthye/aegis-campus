import type { Projection } from '@/domain/campus-projection'

/**
 * The vocabulary every layer of the campus map shares.
 *
 * The map is painted as a stack of layers, each in its own file. What they
 * have in common is a projection to place things with, and — for the ones
 * that respond to a pointer — a single channel for reporting what is under
 * it, so only one feature can ever be described at a time.
 */

/** What the inspector is currently describing. */
export interface Focus {
  title: string
  detail: string
  tone: 'good' | 'warn' | 'danger' | 'neutral'
}

/** Every layer places its features with the same projection. */
export interface LayerProps {
  plan: Projection
}

/**
 * Layers that answer the pointer.
 *
 * `describe` returns a handler rather than taking one, so a layer reads as
 * `onMouseEnter={describe({ … })}` — the description sits where the feature
 * is drawn instead of in a callback defined somewhere else.
 */
export interface FocusableLayerProps extends LayerProps {
  focus: Focus | null
  describe: (next: Focus | null) => () => void
}

/**
 * Layers whose features can be chosen as a Safe Walk destination.
 *
 * Undefined means the map is read-only, which is a different thing from a
 * destination nobody picked — so the whole prop is optional rather than the
 * handler taking a nullable value.
 */
export interface PickableLayerProps extends FocusableLayerProps {
  onPick?: (destination: string) => void
}

export const FOCUS_TONE: Record<Focus['tone'], string> = {
  good: 'border-emerald-400/40 text-emerald-300',
  warn: 'border-amber-400/40 text-amber-300',
  danger: 'border-red-500/40 text-red-300',
  neutral: 'border-ops-border text-ops-text',
}

/** Shared by the blocks and the gates: both are chosen the same way. */
export function pickHandlers(name: string, onPick?: (destination: string) => void) {
  const pickable = onPick !== undefined

  return {
    role: pickable ? ('button' as const) : undefined,
    tabIndex: pickable ? 0 : undefined,
    'aria-label': pickable ? `Walk to ${name}` : undefined,
    className: pickable ? 'cursor-pointer' : undefined,
    onClick: () => onPick?.(name),
    // A pointer can click a polygon; a keyboard needs to be told how.
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onPick?.(name)
      }
    },
  }
}
