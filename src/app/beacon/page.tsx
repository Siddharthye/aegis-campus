import { BeaconExplorer } from '@/components/beacon/BeaconExplorer'
import { OpsShell } from '@/components/ops/OpsShell'
import { listAnchorBuildings } from '@/lib/beacon-service'

export const metadata = { title: 'BEACON Anchors — AEGIS' }

/**
 * The BEACON deployment surface. Several hundred codes exist, so this is a
 * filtered registry with a selected-anchor detail rather than a wall of QR
 * images — printing is one action inside it.
 */
export default function BeaconPage() {
  return (
    <OpsShell
      title="BEACON anchors"
      subtitle="Printed codes that resolve a report to building, floor and room at 99% confidence — where GPS gives a ±30m blur and no floor at all."
      wide
    >
      <BeaconExplorer buildings={listAnchorBuildings()} />
    </OpsShell>
  )
}
