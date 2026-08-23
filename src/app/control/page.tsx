import { ControlRoom } from '@/components/control/ControlRoom'
import { OpsShell } from '@/components/ops/OpsShell'

export const metadata = { title: 'Control Room' }

type PageProps = { searchParams: Promise<{ incident?: string }> }

/**
 * The dispatcher seat: live queue ranked by SLA pressure, dispatch
 * recommendations with reasons, the silent-alarm lane, and drill playback.
 */
export default async function ControlPage({ searchParams }: PageProps) {
  const { incident } = await searchParams

  return (
    <OpsShell
      title="Control Room"
      subtitle="Ranked by SLA pressure — the clock decides the order, not arrival time."
    >
      <ControlRoom initialIncidentId={incident} />
    </OpsShell>
  )
}
