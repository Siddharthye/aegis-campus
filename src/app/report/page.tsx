import { OpsShell } from '@/components/ops/OpsShell'
import { ReportWorkspace } from '@/components/report/ReportWorkspace'
import { SentinelTrigger } from '@/components/sentinel/SentinelTrigger'

export const metadata = { title: 'Report' }

/**
 * The reporter's seat: the floor you are standing on, and the form.
 *
 * Safe Walk lives on its own screen — it is a different workflow with a
 * different shape, and folding it in here made both feel like half a page.
 */
export default function ReportPage() {
  return (
    /* The trigger wraps the whole screen, header included. It used to wrap
       only the workspace, which left the strip carrying the instruction as the
       one place where tapping did nothing — and that strip is exactly where
       someone reads it and then taps. The plan and the form still do not arm:
       three quick taps there are someone choosing a room, not calling for
       help, which is why the copy says blank rather than anywhere. */
    <SentinelTrigger>
      <OpsShell
        title="Report an emergency"
        subtitle="Pick the room on the plan or drop a pin on the campus map. Triple-tap any blank part of the screen to arm a silent alarm instead."
        wide
      >
        <ReportWorkspace />
      </OpsShell>
    </SentinelTrigger>
  )
}
