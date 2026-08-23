import { OpsShell } from '@/components/ops/OpsShell'
import { SafeWalkWorkspace } from '@/components/sentinel/SafeWalkWorkspace'

export const metadata = { title: 'Safe Walk' }

/**
 * Safe Walk's own screen. Its question is spatial — where am I going, what is
 * between us, who is watching the clock — so the map leads and the controls
 * sit beside it, unlike Report where the form leads.
 */
export default function SafeWalkPage() {
  return (
    <OpsShell
      title="Safe Walk"
      subtitle="Tell AEGIS where you are heading. Stop checking in and it raises a silent alarm with your last known position."
      wide
    >
      <SafeWalkWorkspace />
    </OpsShell>
  )
}
