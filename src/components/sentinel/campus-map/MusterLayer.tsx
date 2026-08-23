import { CAMPUS25_MUSTERS } from '@/data/campus25'
import type { LayerProps } from './types'

/**
 * Assembly points, marked with a tick rather than a pin.
 *
 * A pin says "something is here"; a tick says "this is where you are meant to
 * end up", which is the only reason this layer exists.
 */
export function MusterLayer({ plan }: LayerProps) {
  return (
    <>
      {CAMPUS25_MUSTERS.map((muster) => {
        const { x, y } = plan.toXY(muster.position)

        return (
          <g key={muster.id}>
            <circle
              cx={x}
              cy={y}
              r={14}
              fill="#10b981"
              fillOpacity={0.12}
              stroke="#10b981"
              strokeOpacity={0.5}
            />
            <path
              d={`M ${x - 4} ${y} l 3 3 l 5 -6`}
              fill="none"
              stroke="#34d399"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <title>{`Muster point — ${muster.name}`}</title>
          </g>
        )
      })}
    </>
  )
}
