import { CaseLookup } from '@/components/report/CaseLookup'
import { OpsShell } from '@/components/ops/OpsShell'

export const metadata = { title: 'Check a case — AEGIS' }

/**
 * VEIL case follow-up. Reporting anonymously should not mean reporting into a
 * void: a one-way token lets someone check whether anyone acted on what they
 * reported, without ever telling us who they are.
 */
export default function CasePage() {
  return (
    <OpsShell
      active="/report"
      title="Check a case"
      subtitle="Enter the token you were given when you reported. No account, no name."
    >
      <CaseLookup />
    </OpsShell>
  )
}
