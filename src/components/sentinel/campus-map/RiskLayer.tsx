import type { RiskPattern } from '@/domain/risk-map'
import type { FocusableLayerProps } from './types'

interface RiskLayerProps extends Omit<FocusableLayerProps, 'focus'> {
  patterns: readonly RiskPattern[]
}

/**
 * SIGHTLINE's reported-risk shading, under everything actionable.
 *
 * Two passes over the same circles. The blurred pass is the bloom people see;
 * the second is invisible and exists only to be pointed at, because a shape
 * with a 14px gaussian on it has no edge a pointer can find.
 */
export function RiskLayer({ plan, patterns, describe }: RiskLayerProps) {
  return (
    <>
      <g filter="url(#risk-blur)">
        {patterns.map((pattern) => {
          const { x, y } = plan.toXY(pattern.centre)
          return (
            <circle
              key={pattern.id}
              cx={x}
              cy={y}
              r={26 + pattern.weight * 26}
              fill="#ef4444"
              fillOpacity={0.1 + pattern.weight * 0.28}
            />
          )
        })}
      </g>

      {patterns.map((pattern) => {
        const { x, y } = plan.toXY(pattern.centre)
        return (
          <circle
            key={`${pattern.id}-hit`}
            cx={x}
            cy={y}
            r={26 + pattern.weight * 26}
            fill="transparent"
            className="cursor-help"
            onMouseEnter={describe({
              title: pattern.headline,
              detail: `${pattern.category} reports from ${pattern.distinctReporters} different people. One person reporting repeatedly would not appear here.`,
              tone: 'danger',
            })}
            onMouseLeave={describe(null)}
          />
        )
      })}
    </>
  )
}
