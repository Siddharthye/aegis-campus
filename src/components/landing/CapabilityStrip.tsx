const CAPABILITIES = [
  'Geofenced broadcast',
  'Risk-aware night routing',
  'Duplicate report fusion',
  'Silent panic mode',
  'Live SLA clocks',
  'Explainable triage',
  'Prank quarantine',
  'Nearest-unit dispatch',
  'Drill replay',
  'Anonymous reporting',
  'Offline-first demo',
  'Patrol forecasting',
]

/**
 * Infinite marquee of capabilities — the connective tissue between the hero
 * and the story. Pure CSS animation; the track is duplicated so the loop is
 * seamless at exactly -50%.
 */
export function CapabilityStrip() {
  const items = [...CAPABILITIES, ...CAPABILITIES]

  return (
    <div className="relative overflow-hidden border-y border-ops-border/60 bg-ops-bg/60 py-4">
      <div className="marquee-track flex w-max items-center gap-3">
        {items.map((capability, index) => (
          <span
            key={`${capability}-${index}`}
            className="ops-label flex items-center gap-3 whitespace-nowrap text-ops-faint"
          >
            {capability}
            <span className="text-ops-accent/60">·</span>
          </span>
        ))}
      </div>

      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-ops-deep to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ops-deep to-transparent" />
    </div>
  )
}
