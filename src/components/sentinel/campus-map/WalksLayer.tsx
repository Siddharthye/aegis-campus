import type { SafeWalk } from '@/domain/safe-walk'
import type { LayerProps } from './types'

interface WalksLayerProps extends LayerProps {
  walks: readonly SafeWalk[]
}

/**
 * People currently walking, always on top.
 *
 * Top of the stack without exception: a live walk is the only thing on this
 * map that can change in the next ten seconds, and an escalated one is the
 * reason a dispatcher is looking at the screen at all.
 */
export function WalksLayer({ plan, walks }: WalksLayerProps) {
  const trails = walks.filter((walk) => walk.status === 'walking' || walk.status === 'escalated')

  return (
    <>
      {trails.map((walk) => {
        const points = walk.path.map((point) => plan.toXY(point))
        if (points.length === 0) return null

        const last = points[points.length - 1]
        const danger = walk.status === 'escalated'

        return (
          <g key={walk.id}>
            {points.length > 1 && (
              <polyline
                points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={danger ? '#ef4444' : '#a78bfa'}
                strokeWidth={2.6}
                strokeDasharray="6 4"
              />
            )}
            <circle cx={last.x} cy={last.y} r={11} fill={danger ? '#ef4444' : '#a78bfa'} fillOpacity={0.18} />
            <circle
              cx={last.x}
              cy={last.y}
              r={5}
              className={danger ? 'siren-pulse' : ''}
              fill={danger ? '#ef4444' : '#a78bfa'}
            />
          </g>
        )
      })}
    </>
  )
}
