import { AlertsFeed } from '@/components/alerts/AlertsFeed'
import { OpsShell } from '@/components/ops/OpsShell'

export const metadata = { title: 'Campus alerts' }

/**
 * The receiving end of a broadcast.
 *
 * Every other screen belongs to someone doing a job. This one belongs to the
 * person the platform exists to reach: leave it open, and it shows and speaks
 * whatever the control room sends.
 */
export default function AlertsPage() {
  return (
    <OpsShell
      title="Campus alerts"
      subtitle="What the control room has told campus. Leave this open — new alerts announce themselves in the language they were written in."
    >
      <AlertsFeed />
    </OpsShell>
  )
}
