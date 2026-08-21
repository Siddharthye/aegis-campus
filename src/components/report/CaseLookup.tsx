'use client'

import { useState } from 'react'
import { describeCaseStatus, normaliseCaseToken, type CaseStatus } from '@/domain/case-token'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { StatusBadge } from '@/components/ops/StatusBadge'

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'found'; status: CaseStatus }
  | { kind: 'missing' }

const formatMoment = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

/**
 * Redeems a VEIL case token.
 *
 * The whole point of this screen is that it asks for nothing else: no email,
 * no login, no name. Someone who reported harassment anonymously can find out
 * whether anyone acted on it without ever telling us who they are.
 */
export function CaseLookup() {
  const [token, setToken] = useState('')
  const [state, setState] = useState<LookupState>({ kind: 'idle' })

  const lookUp = async () => {
    if (token.trim().length === 0) return
    setState({ kind: 'searching' })

    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(normaliseCaseToken(token))}`)
      if (!response.ok) {
        setState({ kind: 'missing' })
        return
      }
      const body = (await response.json()) as { case: CaseStatus }
      setState({ kind: 'found', status: body.case })
    } catch {
      setState({ kind: 'missing' })
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="rounded-lg border border-ops-border bg-ops-panel p-4">
        <label htmlFor="case-token" className="ops-label text-ops-muted">
          Case token
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="case-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void lookUp()
            }}
            placeholder="AEG-7K2M-QP49"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-md border border-ops-border bg-ops-bg px-3 py-2 font-mono text-[14px] uppercase tracking-wider text-ops-text placeholder:text-ops-faint focus:border-ops-accent/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void lookUp()}
            disabled={state.kind === 'searching'}
            className="shrink-0 rounded-md border border-ops-accent/40 bg-ops-accent/10 px-4 py-2 text-[13px] font-medium text-ops-accent transition-colors hover:bg-ops-accent/20 disabled:opacity-50"
          >
            {state.kind === 'searching' ? 'Checking…' : 'Check'}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ops-faint">
          Dashes and capitals are optional. We never ask who you are — the token is the only
          thing that identifies your case, which is why it cannot be recovered if lost.
        </p>
      </div>

      {state.kind === 'missing' && (
        <div className="rounded-lg border border-sev-p1/40 bg-sev-p1/5 p-4">
          <p className="ops-label text-sev-p1">No match</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ops-muted">
            No case matches that token. Check for a mistyped character — or, if the token is
            lost, file a new report. We genuinely cannot look it up another way.
          </p>
        </div>
      )}

      {state.kind === 'found' && <CaseCard status={state.status} />}
    </div>
  )
}

function CaseCard({ status }: { status: CaseStatus }) {
  return (
    <article className="rounded-lg border border-ops-border bg-ops-panel p-4">
      <div className="flex items-center gap-2">
        <SeverityBadge severity={status.severity} compact />
        <StatusBadge status={status.status} />
        <span className="ops-label ml-auto text-ops-faint">{status.category}</span>
      </div>

      <p className="mt-3 text-[14px] leading-relaxed text-ops-text">
        {describeCaseStatus(status.status)}
      </p>
      <p className="mt-1 text-[12px] text-ops-muted">{status.locationLabel}</p>

      <ol className="mt-4 flex flex-col gap-2 border-t border-ops-border pt-3">
        {status.updates.map((update, index) => (
          <li key={`${update.at}-${index}`} className="flex items-baseline gap-3">
            <span className="ops-label w-24 shrink-0 text-ops-faint">
              {formatMoment(update.at)}
            </span>
            <span className="text-[12px] text-ops-text">{update.action}</span>
          </li>
        ))}
      </ol>
    </article>
  )
}
