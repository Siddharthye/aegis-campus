import { PulseDashboard } from '@/components/analytics/PulseDashboard'
import { OpsShell } from '@/components/ops/OpsShell'
import { IntegrationSlot } from '@/integrations/slots'

export const metadata = { title: 'PULSE Analytics — AEGIS' }

/** The admin seat: PULSE analytics, ending in a patrol plan rather than a chart. */
export default function AnalyticsPage() {
  return (
    <OpsShell
      title="PULSE"
      subtitle="Patterns that end in an instruction — where to patrol, and when."
    >
      <div className="flex flex-col gap-4">
        <PulseDashboard />
        <IntegrationSlot kind="analytics-panel" label="Acquired analytics" showWhenEmpty />
      </div>
    </OpsShell>
  )
}
