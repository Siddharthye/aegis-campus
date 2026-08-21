import { CaseWorkspace } from '@/components/report/CaseWorkspace'
import { OpsShell } from '@/components/ops/OpsShell'

export const metadata = { title: 'Check a case — AEGIS' }

/**
 * VEIL case follow-up. Useful before a token is entered — the lifecycle and
 * the privacy contract are the resting state, so someone can see what will
 * (and will not) be shown to them before they redeem anything.
 */
export default function CasePage() {
  return (
    <OpsShell
      title="Check a case"
      subtitle="Enter the token you were given when you reported. No account, no name, nothing to sign in to."
    >
      <CaseWorkspace />
    </OpsShell>
  )
}
