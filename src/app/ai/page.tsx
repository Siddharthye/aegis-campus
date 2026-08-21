import { AiConsole } from '@/components/nexbot/AiConsole'
import { OpsShell } from '@/components/ops/OpsShell'

export const metadata = { title: 'NEXBOT — AEGIS ops copilot' }

type PageProps = { searchParams: Promise<{ q?: string }> }

/**
 * The NEXBOT console — immersive Spline stage + chat dock (towerz layout).
 *
 * `?q=` lets the command palette hand a typed question straight here, so
 * "ask NEXBOT" from anywhere is one keystroke and one Enter.
 */
export default async function AiPage({ searchParams }: PageProps) {
  const { q } = await searchParams

  return (
    <OpsShell title="NEXBOT" immersive>
      <AiConsole initialQuestion={q} />
    </OpsShell>
  )
}
