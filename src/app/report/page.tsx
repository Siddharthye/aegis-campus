import { OpsShell } from '@/components/ops/OpsShell'
import { ReportWorkspace } from '@/components/report/ReportWorkspace'
import { SentinelTrigger } from '@/components/sentinel/SentinelTrigger'

export const metadata = { title: 'Report — AEGIS' }

/**
 * The reporter's seat: the floor you are standing on, and the form.
 *
 * Safe Walk lives on its own screen — it is a different workflow with a
 * different shape, and folding it in here made both feel like half a page.
 */
export default function ReportPage() {
  return (
    <OpsShell
      title="Report an emergency"
      subtitle="Pick the room on the plan or drop a pin on the campus map. Triple-tap anywhere to arm a silent alarm instead."
      wide
    >
      <SentinelTrigger>
        <ReportWorkspace />
      </SentinelTrigger>
    </OpsShell>
  )
}
