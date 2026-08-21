import { DrillBrief } from '@/components/control/DrillBrief'

export const metadata = { title: 'Drill After-Action Report — AEGIS' }

type PageProps = { params: Promise<{ id: string }> }

/**
 * Printable after-action report for one drill.
 *
 * Deliberately a thin shell: the report is fetched client-side through the
 * public API rather than read from the store here, because page rendering and
 * route handlers are separate serverless functions and do not share in-memory
 * state. See `DrillBrief`.
 */
export default async function DrillBriefPage({ params }: PageProps) {
  const { id } = await params

  return (
    <main className="print-sheet mx-auto max-w-3xl px-6 py-10">
      <DrillBrief drillId={id} />
    </main>
  )
}
