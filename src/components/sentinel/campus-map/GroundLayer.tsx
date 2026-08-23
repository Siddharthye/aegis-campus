import { CAMPUS25_TERRAIN } from '@/data/campus25'
import { centroid, line } from '@/domain/campus-projection'
import type { LayerProps } from './types'

/**
 * What the campus sits on: the ground wash, the pond, the green.
 *
 * Bottom of the stack, and deliberately quiet. Scenery that competes with a
 * route is scenery that hurts, so the fills are dark and the labels are set
 * with a stroke behind them rather than a brighter colour.
 */
export function GroundLayer({ plan }: LayerProps) {
  return (
    <>
      <rect width={plan.width} height={plan.height} fill="url(#campus-ground)" />

      {CAMPUS25_TERRAIN.map((item) => {
        const centre = centroid(item.outline, plan)
        const water = item.kind === 'water'

        return (
          <g key={item.id}>
            <polygon
              points={line(item.outline, plan)}
              fill={water ? 'url(#water)' : '#14301f'}
              stroke={water ? '#3b82f6' : '#22c55e'}
              strokeOpacity={0.35}
              strokeWidth={1.2}
            />
            <text
              x={centre.x}
              y={centre.y}
              textAnchor="middle"
              style={{
                fontSize: 11,
                fill: water ? '#7dd3fc' : '#86efac',
                fontFamily: 'var(--font-inter), sans-serif',
                letterSpacing: '0.02em',
                pointerEvents: 'none',
                paintOrder: 'stroke',
                stroke: '#05070d',
                strokeWidth: 3,
                strokeLinejoin: 'round',
              }}
            >
              {item.name}
            </text>
          </g>
        )
      })}
    </>
  )
}
