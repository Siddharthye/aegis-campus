import { CAMPUS25_BLOCKS, type BlockKind } from '@/data/campus25'
import { line, placeBlockLabels } from '@/domain/campus-projection'
import { pickHandlers, type PickableLayerProps } from './types'

/** Fill, outline and the word the legend and the inspector both use. */
export const BLOCK_STYLE: Record<BlockKind, { fill: string; stroke: string; label: string }> = {
  academic: { fill: '#1b2b45', stroke: '#a78bfa', label: 'Academic block' },
  admin: { fill: '#232a38', stroke: '#94a3b8', label: 'Administration' },
  amenity: { fill: '#16302a', stroke: '#10b981', label: 'Amenity' },
  hostel: { fill: '#2d2a17', stroke: '#eab308', label: 'Hostel' },
  utility: { fill: '#1e242e', stroke: '#64748b', label: 'Utility / parking' },
}

/**
 * The buildings, and the names on them.
 *
 * Footprints are grouped under one drop shadow so the cluster reads as raised
 * together rather than as fourteen separately floating shapes. The labels are
 * placed outside that group: a shadow under text makes it harder to read, and
 * they must never intercept a click meant for the block underneath.
 */
export function BlocksLayer({ plan, focus, describe, onPick }: PickableLayerProps) {
  const pickable = onPick !== undefined

  return (
    <>
      <g filter="url(#block-lift)">
        {CAMPUS25_BLOCKS.map((item) => {
          const style = BLOCK_STYLE[item.kind]
          const active = focus?.title === item.name

          return (
            <polygon
              key={item.id}
              points={line(item.footprint, plan)}
              fill={active ? style.stroke : style.fill}
              fillOpacity={active ? 0.35 : 1}
              stroke={style.stroke}
              strokeOpacity={active ? 1 : 0.55}
              strokeWidth={active ? 2 : 1.2}
              onMouseEnter={describe({
                title: item.name,
                detail: pickable ? `${style.label}. Click to walk here.` : style.label,
                tone: 'neutral',
              })}
              onMouseLeave={describe(null)}
              {...pickHandlers(item.name, onPick)}
            />
          )
        })}
      </g>

      {placeBlockLabels(plan).map(({ id, name, x, y }) => (
        <text
          key={`${id}-label`}
          x={x}
          y={y}
          textAnchor="middle"
          style={{
            fontSize: 10.5,
            fill: '#e2e8f0',
            fontFamily: 'var(--font-jetbrains), monospace',
            fontWeight: 700,
            pointerEvents: 'none',
            paintOrder: 'stroke',
            stroke: '#05070d',
            strokeWidth: 3,
            strokeLinejoin: 'round',
          }}
        >
          {name}
        </text>
      ))}
    </>
  )
}
