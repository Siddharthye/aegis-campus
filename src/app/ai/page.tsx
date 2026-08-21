import { AiConsole } from '@/components/nexbot/AiConsole'
import { OpsShell } from '@/components/ops/OpsShell'

export const metadata = { title: 'NEXBOT — AEGIS ops copilot' }

type PageProps = { searchParams: Promise<{ q?: string }> }

/**
 * The NEXBOT console — the AI seat in the dock.
 *
 * `?q=` lets the command palette hand a typed question straight here, so
 * "ask NEXBOT" from anywhere is one keystroke and one Enter.
 */
export default async function AiPage({ searchParams }: PageProps) {
  const { q } = await searchParams

  return (
    <OpsShell
      title="NEXBOT"
      subtitle="The ops copilot. No model, no key — every answer is computed from the live incident store."
    >
      <AiConsole initialQuestion={q} />
    </OpsShell>
  )
}
