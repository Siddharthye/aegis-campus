import { CAMPUS25_LANDMARKS } from '@/data/campus25'
import type { LayerProps } from './types'

/**
 * The things off campus that tell you which way you are facing.
 *
 * Held at 80% opacity and in grey: they are orientation, not destinations,
 * and anything that looks tappable here would be a lie.
 */
export function LandmarksLayer({ plan }: LayerProps) {
  return (
    <>
      {CAMPUS25_LANDMARKS.map((mark) => {
        const { x, y } = plan.toXY(mark.position)

        return (
          <g key={mark.id} opacity={0.8}>
            <circle cx={x} cy={y} r={2.5} fill="#64748b" />
            <text
              x={x}
              y={y - 8}
              textAnchor="middle"
              style={{
                fontSize: 10,
                fill: '#94a3b8',
                fontFamily: 'var(--font-inter), sans-serif',
                paintOrder: 'stroke',
                stroke: '#0a0e17',
                strokeWidth: 3,
                strokeLinejoin: 'round',
              }}
            >
              {mark.name}
            </text>
          </g>
        )
      })}
    </>
  )
}
