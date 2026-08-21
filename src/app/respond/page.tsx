import { OpsShell } from '@/components/ops/OpsShell'
import { ResponderBoard } from '@/components/respond/ResponderBoard'

export const metadata = { title: 'Respond — AEGIS' }

/** The responder seat, as a command console: the assignment, the crew, the clock. */
export default function RespondPage() {
  return (
    <OpsShell
      title="Respond"
      subtitle="Your assignment, who else is coming, and what the SLA clock says. Every status change is timestamped and attributed to you."
      wide
    >
      <ResponderBoard />
    </OpsShell>
  )
}
