import { FOCUS_TONE, type Focus } from './types'

/**
 * What the pointer is currently over, in words.
 *
 * A fixed strip rather than a floating tooltip: a tooltip that follows the
 * cursor covers the very thing being pointed at, and on a map the surroundings
 * are the information.
 */
export function MapInspector({ focus, pickable }: { focus: Focus | null; pickable: boolean }) {
  if (!focus) {
    return (
      <p className="rounded-lg border border-dashed border-ops-border/60 px-3 py-2 text-[11px] leading-relaxed text-ops-faint">
        Point at a route to see why it scored the way it did, or at a red area for the reports
        behind it
        {pickable && ' — click any block or gate to walk there'}.
      </p>
    )
  }

  return (
    <div className={`rounded-lg border bg-ops-bg/40 px-3 py-2 ${FOCUS_TONE[focus.tone]}`}>
      <p className="text-[12px] font-medium">{focus.title}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-ops-muted">{focus.detail}</p>
    </div>
  )
}
