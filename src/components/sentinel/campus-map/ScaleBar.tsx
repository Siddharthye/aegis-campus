import type { LayerProps } from './types'

/** Metres the bar represents. Round, so the eye can multiply it. */
const BAR_METRES = 100

/**
 * How far is far, in the corner.
 *
 * Without it "about 200 metres" in a broadcast is a number with nothing to
 * check it against, and every distance on the map is a guess.
 */
export function ScaleBar({ plan }: LayerProps) {
  const units = BAR_METRES / plan.metresPerUnit

  return (
    <g transform={`translate(16, ${plan.height - 18})`}>
      <line x1={0} y1={0} x2={units} y2={0} stroke="#64748b" strokeWidth={2} />
      <line x1={0} y1={-4} x2={0} y2={4} stroke="#64748b" strokeWidth={2} />
      <line x1={units} y1={-4} x2={units} y2={4} stroke="#64748b" strokeWidth={2} />
      <text
        x={units / 2}
        y={-7}
        textAnchor="middle"
        style={{ fontSize: 9.5, fill: '#94a3b8', fontFamily: 'var(--font-jetbrains), monospace' }}
      >
        {BAR_METRES} m
      </text>
    </g>
  )
}
