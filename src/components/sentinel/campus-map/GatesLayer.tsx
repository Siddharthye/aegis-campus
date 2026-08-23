import { CAMPUS25_GATES } from '@/data/campus25'
import { pickHandlers, type PickableLayerProps } from './types'

/**
 * The ways in and out.
 *
 * Above the blocks because a gate is a decision and a building is a place:
 * when the two overlap on screen, the gate is the one worth clicking.
 */
export function GatesLayer({ plan, focus, describe, onPick }: PickableLayerProps) {
  const pickable = onPick !== undefined

  return (
    <>
      {CAMPUS25_GATES.map((gate) => {
        const { x, y } = plan.toXY(gate.position)

        return (
          <g
            key={gate.id}
            onMouseEnter={describe({
              title: gate.name,
              detail: pickable
                ? `Towards ${gate.towards}. Click to walk here.`
                : `Towards ${gate.towards}.`,
              tone: 'neutral',
            })}
            onMouseLeave={describe(null)}
            {...pickHandlers(gate.name, onPick)}
          >
            <rect
              x={x - 7}
              y={y - 7}
              width={14}
              height={14}
              rx={3.5}
              fill="#0a1a28"
              stroke="#a78bfa"
              strokeWidth={focus?.title === gate.name ? 2.6 : 1.6}
            />
            <rect x={x - 2.5} y={y - 2.5} width={5} height={5} rx={1} fill="#a78bfa" />
            <text
              x={x}
              y={y + 21}
              textAnchor="middle"
              style={{
                fontSize: 10,
                fill: '#7dd3fc',
                fontFamily: 'var(--font-jetbrains), monospace',
                pointerEvents: 'none',
                paintOrder: 'stroke',
                stroke: '#05070d',
                strokeWidth: 3,
                strokeLinejoin: 'round',
              }}
            >
              {gate.name}
            </text>
          </g>
        )
      })}
    </>
  )
}
