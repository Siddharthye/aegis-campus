import { OpsShell } from '@/components/ops/OpsShell'
import { ReportWizard } from '@/components/report/ReportWizard'
import { SentinelTrigger } from '@/components/sentinel/SentinelTrigger'

export const metadata = { title: 'Report — AEGIS' }

/**
 * The reporter seat. Three taps to file an incident — and, for anyone who
 * cannot safely be seen filing one, a triple-tap anywhere on this screen arms
 * SENTINEL and replaces it with a decoy calculator.
 */
export default function ReportPage() {
  return (
    <OpsShell
      active="/report"
      title="Report an emergency"
      subtitle="Three taps. Triple-tap anywhere on this screen to arm a silent alarm instead."
    >
      <SentinelTrigger>
        <div className="mx-auto max-w-lg">
          <ReportWizard />
        </div>
      </SentinelTrigger>
    </OpsShell>
  )
}
