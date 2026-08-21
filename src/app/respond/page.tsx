import { OpsShell } from '@/components/ops/OpsShell'
import { ResponderBoard } from '@/components/respond/ResponderBoard'

export const metadata = { title: 'Respond — AEGIS' }

/** The responder seat: one assignment, thumb-sized controls, a live SLA clock. */
export default function RespondPage() {
  return (
    <OpsShell
      active="/respond"
      title="My assignment"
      subtitle="Every status change is timestamped and attributed to you."
    >
      <ResponderBoard />
    </OpsShell>
  )
}
