'use client'

import { useState } from 'react'
import { describeCaseStatus, normaliseCaseToken, type CaseStatus } from '@/domain/case-token'
import type { IncidentStatus } from '@/domain/types'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { StatusBadge } from '@/components/ops/StatusBadge'
import { Chip, MiniBar, Panel, Stat } from '@/components/ui/Panel'

type LookupState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'found'; status: CaseStatus }
  | { kind: 'missing' }

/** Every stage a case passes through, in order, with what it means to a reporter. */
const CASE_STAGES: { status: IncidentStatus; label: string; blurb: string }[] = [
  { status: 'reported', label: 'Received', blurb: 'In the control room, being assessed.' },
  { status: 'triaged', label: 'Assessed', blurb: 'Prioritised; a responder is being assigned.' },
  { status: 'dispatched', label: 'Responder sent', blurb: 'Someone is on the way.' },
  { status: 'on-scene', label: 'On scene', blurb: 'A responder has arrived.' },
  { status: 'resolved', label: 'Closed', blurb: 'The case is finished.' },
]

const formatMoment = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

/**
 * VEIL case follow-up, built as a case file rather than a search box.
 *
 * The page has to be useful *before* a token is entered — someone arriving
 * here wants to know what the stages mean and what will and will not be shown
 * to them. So the lifecycle and the privacy contract are the resting state,
 * and the redeemed case replaces the lifecycle in place.
 */
export function CaseWorkspace() {
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

  const found = state.kind === 'found' ? state.status : null
  const stageIndex = found
    ? CASE_STAGES.findIndex((stage) => stage.status === found.status)
    : -1

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.62fr)]">
      {/* ── The case file ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Panel label="Case token" tone={found ? 'accent' : 'default'} spotlight>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void lookUp()
                }}
                placeholder="AEG-7K2M-QP49"
                autoComplete="off"
                spellCheck={false}
                aria-label="Case token"
                className="min-w-0 flex-1 rounded-lg border border-ops-border bg-ops-bg px-3.5 py-2.5 font-mono text-[15px] uppercase tracking-wider text-ops-text placeholder:text-ops-faint focus:border-ops-accent/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void lookUp()}
                disabled={state.kind === 'searching'}
                className="shrink-0 rounded-lg border border-ops-accent/40 bg-ops-accent/10 px-5 py-2.5 text-[13px] font-semibold text-ops-accent transition-colors hover:bg-ops-accent/20 disabled:opacity-50"
              >
                {state.kind === 'searching' ? 'Checking…' : 'Open case'}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ops-faint">
              Dashes and capitals optional. We never ask who you are — the token is the only thing
              that identifies your case, which is why it cannot be recovered if lost.
            </p>
          </div>
        </Panel>

        {state.kind === 'missing' && (
          <Panel label="No match" tone="danger">
            <p className="px-4 py-4 text-[12px] leading-relaxed text-ops-muted">
              No case matches that token. Check for a mistyped character — or, if the token is
              lost, file a new report. We genuinely cannot look it up another way.
            </p>
          </Panel>
        )}

        {found && (
          <Panel
            label={`Case · ${found.category}`}
            tone="accent"
            aside={
              <>
                <SeverityBadge severity={found.severity} compact />
                <StatusBadge status={found.status} />
              </>
            }
          >
            <div className="p-5">
              <p className="text-[15px] leading-relaxed text-ops-text">
                {describeCaseStatus(found.status)}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Stat value={found.locationLabel} label="location" />
                <Stat value={formatMoment(found.createdAt)} label="reported" />
                <Stat
                  value={found.resolvedAt ? formatMoment(found.resolvedAt) : 'Open'}
                  label="closed"
                  tone={found.resolvedAt ? 'good' : 'accent'}
                />
              </div>

              <div className="mt-4">
                <MiniBar
                  value={stageIndex + 1}
                  max={CASE_STAGES.length}
                  tone={found.status === 'resolved' ? 'good' : 'accent'}
                />
              </div>
            </div>
          </Panel>
        )}

        {/* Lifecycle: the resting state, and the progress view once redeemed. */}
        <Panel
          label={found ? 'Progress' : 'What happens to a report'}
          aside={found && <Chip tone="accent">{stageIndex + 1} of {CASE_STAGES.length}</Chip>}
        >
          <ol className="divide-y divide-ops-border/60">
            {CASE_STAGES.map((stage, index) => {
              const reached = stageIndex >= index
              const current = stageIndex === index
              const update = found?.updates.find((entry) => entry.action === stage.status)

              return (
                <li
                  key={stage.status}
                  className={`flex gap-3.5 px-4 py-3 ${current ? 'bg-ops-accent/5' : ''}`}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-1 size-2.5 shrink-0 rounded-full border-2 ${
                        current
                          ? 'siren-pulse border-ops-accent bg-ops-accent'
                          : reached
                            ? 'border-emerald-400 bg-emerald-400'
                            : 'border-ops-border bg-transparent'
                      }`}
                    />
                    {index < CASE_STAGES.length - 1 && (
                      <span
                        className={`mt-1 w-px flex-1 ${reached ? 'bg-emerald-400/40' : 'bg-ops-border'}`}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p
                        className={`text-[13px] font-medium ${reached ? 'text-ops-text' : 'text-ops-faint'}`}
                      >
                        {stage.label}
                      </p>
                      {update && (
                        <span className="ops-label text-ops-faint">{formatMoment(update.at)}</span>
                      )}
                      {current && <Chip tone="accent">Now</Chip>}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ops-muted">
                      {stage.blurb}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </Panel>
      </div>

      {/* ── The privacy contract ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Panel label="What this page can see" tone="accent">
          <ul className="divide-y divide-ops-border/60">
            {[
              ['Status and severity', true],
              ['Where it was reported', true],
              ['When each stage happened', true],
              ['The incident id', false],
              ['What you wrote', false],
              ['Responder names', false],
              ['Control-room messages', false],
            ].map(([item, shown]) => (
              <li key={item as string} className="flex items-center gap-2.5 px-4 py-2">
                <span
                  className={`ops-label w-8 shrink-0 ${shown ? 'text-emerald-400' : 'text-sev-p0'}`}
                >
                  {shown ? 'YES' : 'NO'}
                </span>
                <span className="text-[12px] text-ops-muted">{item as string}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-ops-border/70 px-4 py-3 text-[11px] leading-relaxed text-ops-faint">
            A token proves you filed something. It does not open a window into operations — which
            is why this endpoint needs no login and still gives nothing away.
          </p>
        </Panel>

        <Panel label="How the token works">
          <ol className="flex flex-col gap-2.5 px-4 py-3.5">
            {[
              ['Generated once, on your device screen', 'Never emailed, never shown again.'],
              ['Only sha256(token) is stored', 'We can verify it; we can never derive it.'],
              ['Nothing links it to you', 'Not a name, not an account, not an email.'],
              ['Lose it and the case is unreachable', 'That is the cost of real anonymity.'],
            ].map(([step, detail], index) => (
              <li key={step} className="flex gap-3">
                <span className="ops-label mt-0.5 shrink-0 text-ops-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="text-[12px] text-ops-text">{step}</p>
                  <p className="text-[11px] text-ops-faint">{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  )
}
