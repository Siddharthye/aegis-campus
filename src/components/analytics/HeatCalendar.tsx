/** Row order: Monday first, because a safety officer plans a working week. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

/** Hours labelled on the axis. Labelling all 24 is unreadable at this size. */
const LABELLED_HOURS = [0, 6, 12, 18] as const

/**
 * Opacity ramp for a cell, relative to the busiest cell in the matrix. Using
 * opacity rather than a colour scale keeps severity colours meaning severity
 * and nothing else.
 */
function intensity(count: number, peak: number): number {
  if (count === 0) return 0
  return 0.15 + 0.85 * (count / peak)
}

/**
 * Day × hour incident density.
 *
 * The pattern this exists to make visible is the recurring one — the same
 * building, the same evenings — which a time series flattens away.
 */
export function HeatCalendar({ matrix }: { matrix: number[][] }) {
  const peak = Math.max(1, ...matrix.flat())

  return (
    <div className="flex flex-col gap-1">
      {DAY_ORDER.map((day) => (
        <div key={day} className="flex items-center gap-1">
          <span className="ops-label w-3 shrink-0 text-ops-faint">{DAY_LABELS[day]}</span>
          <div className="flex flex-1 gap-px">
            {matrix[day].map((count, hour) => (
              <div
                key={hour}
                title={`${DAY_LABELS[day]} ${String(hour).padStart(2, '0')}:00 — ${count} incident${count === 1 ? '' : 's'}`}
                className="h-3.5 flex-1 rounded-[1px] bg-ops-accent"
                style={{ opacity: intensity(count, peak) || 0.06 }}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-0.5 flex items-center gap-1">
        <span className="w-3 shrink-0" />
        <div className="relative flex-1">
          {LABELLED_HOURS.map((hour) => (
            <span
              key={hour}
              className="ops-label absolute top-0 text-ops-faint"
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              {String(hour).padStart(2, '0')}
            </span>
          ))}
          <span className="ops-label invisible">0</span>
        </div>
      </div>
    </div>
  )
}
