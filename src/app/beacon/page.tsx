import { BeaconPrinter } from '@/components/beacon/BeaconPrinter'
import { OpsShell } from '@/components/ops/OpsShell'
import { listAnchorBuildings } from '@/lib/beacon-service'

export const metadata = { title: 'BEACON Anchors — AEGIS' }

/**
 * The BEACON deployment surface. The anchor registry is derived from campus
 * footprint data, so it is computed on the server and can never drift from
 * what the printed sheets say.
 */
export default function BeaconPage() {
  return (
    <OpsShell
      title="BEACON anchors"
      subtitle="Print these, tape them to stairwells and corridors. Scanning one locates a report to the floor."
    >
      <BeaconPrinter buildings={listAnchorBuildings()} />
    </OpsShell>
  )
}
