import { ControlRoom } from '@/components/control/ControlRoom'
import { OpsShell } from '@/components/ops/OpsShell'

export const metadata = { title: 'Control Room — AEGIS' }

/**
 * The dispatcher seat: live queue ranked by SLA pressure, dispatch
 * recommendations with reasons, the silent-alarm lane, and drill playback.
 */
export default function ControlPage() {
  return (
    <OpsShell
      active="/control"
      title="Control Room"
      subtitle="Ranked by SLA pressure — the clock decides the order, not arrival time."
    >
      <ControlRoom />
    </OpsShell>
  )
}
