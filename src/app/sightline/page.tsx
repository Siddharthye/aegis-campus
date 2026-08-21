import { OpsShell } from '@/components/ops/OpsShell'
import { SightlineWorkspace } from '@/components/sightline/SightlineWorkspace'

export const metadata = { title: 'SIGHTLINE — AEGIS' }

/**
 * SIGHTLINE's own screen.
 *
 * Safe Walk asks which way to go right now, and owns the map. This page
 * shows the evidence underneath that answer — which places repeat, at which
 * hours, and on how many separate people's word — because a routing
 * suggestion nobody can interrogate is one nobody should follow.
 */
export default function SightlinePage() {
  return (
    <OpsShell
      title="SIGHTLINE"
      subtitle="Where incidents repeat, at which hours, and on whose word — the evidence behind the route Safe Walk recommends."
      wide
    >
      <SightlineWorkspace />
    </OpsShell>
  )
}
