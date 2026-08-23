'use client'

import { useState } from 'react'
import { Chip, Panel } from '@/components/ui/Panel'
import {
  MEDICAL_DISCLAIMER,
  P0_FINDINGS,
  P1_FINDINGS,
  P2_FINDINGS,
  triageMedical,
  type Bleeding,
  type Breathing,
  type Finding,
  type TriageReason,
} from '@/domain/medical-triage'
import { useOfflineQueue } from './use-offline-queue'
import type { LocatedPosition, Severity } from '@/domain/types'

/**
 * VitalPath's four questions, as a reporter answers them.
 *
 * The order is theirs and it matters: responsive, then breathing, then
 * bleeding, then how many — most decisive first, so the answer is usable even
 * if someone stops partway. Every option is a tap, because a person watching
 * someone collapse cannot type, and none of them require knowing the word for
 * a symptom.
 *
 * "I cannot tell" is offered on the questions that have it rather than being
 * inferred from a blank, because the protocol treats an unknown as risk and
 * needs to be told the difference between unknown and no.
 */

interface TriageResult {
  priority: Severity
  reasons: TriageReason[]
  reachTargetSeconds: number
  requiredSkills: string[]
  /** True when the report is held on this device, waiting for a network. */
  held?: boolean
}

const RESPONSIVE_OPTIONS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
  { value: null, label: 'Cannot tell' },
] as const

const BREATHING_OPTIONS: ReadonlyArray<{ value: Breathing; label: string }> = [
  { value: 'normal', label: 'Normally' },
  { value: 'difficult', label: 'With difficulty' },
  { value: 'gasping', label: 'Gasping' },
  { value: 'absent', label: 'Not at all' },
  { value: 'unknown', label: 'Cannot tell' },
]

const BLEEDING_OPTIONS: ReadonlyArray<{ value: Bleeding; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'minor', label: 'Minor' },
  { value: 'severe', label: 'Severe' },
  { value: 'unknown', label: 'Cannot tell' },
]

/** Every tickable finding, worst first, so the urgent ones are reached first. */
const ALL_FINDINGS: ReadonlyArray<{ value: Finding; label: string }> = [
  ...Object.entries(P0_FINDINGS),
  ...Object.entries(P1_FINDINGS),
  ...Object.entries(P2_FINDINGS),
].map(([value, label]) => ({ value: value as Finding, label }))

/** Chip carries the full severity palette; Panel only frames three tones. */
const CHIP_TONE: Record<Severity, 'danger' | 'warn' | 'accent' | 'default'> = {
  P0: 'danger',
  P1: 'warn',
  P2: 'accent',
  P3: 'default',
}

const PANEL_TONE: Record<Severity, 'danger' | 'accent' | 'default'> = {
  P0: 'danger',
  P1: 'danger',
  P2: 'accent',
  P3: 'default',
}

export function MedicalIntake({ location }: { location: LocatedPosition | null }) {
  const [responsive, setResponsive] = useState<boolean | null>(null)
  const [breathing, setBreathing] = useState<Breathing>('unknown')
  const [bleeding, setBleeding] = useState<Bleeding>('unknown')
  const [findings, setFindings] = useState<Finding[]>([])
  const [peopleAffected, setPeopleAffected] = useState(1)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<TriageResult | null>(null)
  const { queue } = useOfflineQueue()

  const toggleFinding = (finding: Finding) =>
    setFindings((current) =>
      current.includes(finding)
        ? current.filter((entry) => entry !== finding)
        : [...current, finding],
    )

  const submit = async () => {
    setSending(true)

    const report = {
      responsive,
      breathing,
      bleeding,
      findings,
      peopleAffected,
      note,
      ...(location ? { lat: location.lat, lng: location.lng } : {}),
    }

    try {
      const response = await fetch('/api/intake/medical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      })
      if (response.ok) {
        setResult((await response.json()) as TriageResult)
        return
      }
      holdLocally(report)
    } catch {
      // No network. The protocol is pure, so the answer does not need one.
      holdLocally(report)
    } finally {
      setSending(false)
    }
  }

  /**
   * Answers from the device and holds the report for delivery.
   *
   * The triage cascade is pure logic, so it gives the same priority offline
   * as the server would — which matters, because someone in a stairwell with
   * no signal still needs to know whether this is a three-minute problem.
   * The report itself goes to the offline queue rather than being lost, and
   * sends itself when the network returns.
   */
  const holdLocally = (report: Record<string, unknown>) => {
    const offline = triageMedical({
      responsive,
      breathing,
      bleeding,
      findings,
      peopleAffected,
      ageGroup: 'unknown',
    })

    queue(report, '/api/intake/medical')
    setResult({ ...offline, held: true })
  }

  if (result) {
    return (
      <Panel
        label="Medical triage"
        tone={PANEL_TONE[result.priority]}
        aside={<Chip tone={CHIP_TONE[result.priority]}>{result.priority}</Chip>}
      >
        <div className="p-4">
          <p className="rounded-md border border-sev-p0/40 bg-sev-p0/10 px-3 py-2 text-[12px] font-medium leading-relaxed text-sev-p0">
            {MEDICAL_DISCLAIMER}
          </p>

          {result.held && (
            <p className="mt-2 rounded-md border border-sev-p1/40 bg-sev-p1/10 px-3 py-2 text-[12px] leading-relaxed text-sev-p1">
              No network — this is held on your phone and sends itself the moment
              signal returns. The priority below was worked out on this device and
              will not change.
            </p>
          )}

          <p className="mt-3 text-[13px] text-ops-text">
            Someone should reach you within{' '}
            <span className="font-mono font-bold">
              {Math.round(result.reachTargetSeconds / 60)} min
            </span>
            .
          </p>

          <ul className="mt-3 flex flex-col gap-1.5 border-t border-ops-border/70 pt-3">
            {result.reasons.map((reason) => (
              <li key={reason.code} className="flex items-start gap-2 text-[12px] leading-relaxed">
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    reason.forced ? 'bg-sev-p0' : 'bg-ops-faint'
                  }`}
                />
                <span className={reason.forced ? 'text-ops-text' : 'text-ops-muted'}>
                  {reason.detail}
                </span>
              </li>
            ))}
          </ul>

          <p className="ops-label mt-3 text-ops-faint">
            Responder must be: {result.requiredSkills.join(', ')}
          </p>

          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-4 min-h-11 text-[12px] text-ops-faint underline-offset-2 transition-colors hover:text-ops-muted hover:underline"
          >
            Report another
          </button>
        </div>
      </Panel>
    )
  }

  return (
    <Panel label="Medical emergency" aside={<Chip tone="danger">4 questions</Chip>}>
      <div className="flex flex-col gap-4 p-4">
        <p className="text-[12px] leading-relaxed text-ops-muted">
          Answer what you can see. Every question can be skipped — an unknown is
          treated as urgent, never as reassurance.
        </p>

        <Question label="Do they respond to voice or touch?">
          {RESPONSIVE_OPTIONS.map((option) => (
            <Choice
              key={String(option.value)}
              active={responsive === option.value}
              onClick={() => setResponsive(option.value)}
            >
              {option.label}
            </Choice>
          ))}
        </Question>

        <Question label="Are they breathing?">
          {BREATHING_OPTIONS.map((option) => (
            <Choice
              key={option.value}
              active={breathing === option.value}
              onClick={() => setBreathing(option.value)}
            >
              {option.label}
            </Choice>
          ))}
        </Question>

        <Question label="Is there bleeding?">
          {BLEEDING_OPTIONS.map((option) => (
            <Choice
              key={option.value}
              active={bleeding === option.value}
              onClick={() => setBleeding(option.value)}
            >
              {option.label}
            </Choice>
          ))}
        </Question>

        <Question label="How many people are affected?">
          {[1, 2, 3, 5, 10].map((count) => (
            <Choice
              key={count}
              active={peopleAffected === count}
              onClick={() => setPeopleAffected(count)}
            >
              {count === 10 ? '10+' : count}
            </Choice>
          ))}
        </Question>

        <Question label="Anything else you can see?">
          {ALL_FINDINGS.map((finding) => (
            <Choice
              key={finding.value}
              active={findings.includes(finding.value)}
              onClick={() => toggleFinding(finding.value)}
            >
              {finding.label}
            </Choice>
          ))}
        </Question>

        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Anything else worth saying (optional)"
          className="min-h-11 rounded-md border border-ops-border bg-ops-bg px-3 text-[12px] text-ops-text placeholder:text-ops-faint focus:border-ops-accent/50 focus:outline-none"
        />

        <button
          type="button"
          disabled={sending}
          onClick={() => void submit()}
          className="min-h-12 rounded-full bg-sev-p0 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {sending ? 'Sending…' : 'Send medical emergency'}
        </button>
      </div>
    </Panel>
  )
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="ops-label text-ops-faint">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-full border px-3 text-[12px] transition-colors sm:min-h-9 ${
        active
          ? 'border-ops-accent/50 bg-ops-accent/15 text-ops-accent'
          : 'border-ops-border text-ops-muted hover:border-ops-accent/30 hover:text-ops-text'
      }`}
    >
      {children}
    </button>
  )
}
