/**
 * Gradients and filters the layers above refer to by id.
 *
 * Kept in one place because they are shared: the ground wash and the water
 * fill are used by the base layers, the drop shadow by the blocks, and the
 * blur by the risk blooms. Defining them where they are used would mean
 * defining some of them more than once.
 */
export function MapDefs() {
  return (
    <defs>
      {/* Ground wash — keeps the campus from reading as a flat cut-out. */}
      <radialGradient id="campus-ground" cx="50%" cy="45%" r="70%">
        <stop offset="0%" stopColor="#101a2c" />
        <stop offset="100%" stopColor="#0a0e17" />
      </radialGradient>

      <linearGradient id="water" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stopColor="#12345c" />
        <stop offset="100%" stopColor="#0d243f" />
      </linearGradient>

      {/* Buildings get a soft drop so the cluster reads as raised. */}
      <filter id="block-lift" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#05070d" floodOpacity="0.75" />
      </filter>

      <filter id="risk-blur" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="14" />
      </filter>
    </defs>
  )
}
