'use client'

import { useState } from 'react'
import type { Incident, IncidentCategory, LocatedPosition, Severity } from '@/domain/types'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { LocationStep } from './LocationStep'
import { CATEGORY_OPTIONS, suggestTitle } from './report-model'

type Step = 'category' | 'location' | 'review'

/**
 * The three-tap report: category, location, send.
 *
 * Three taps is the design constraint, not a slogan — someone reporting a fire
 * is not going to fill in a form. Everything optional (description, anonymity)
 * is offered on the last step and pre-filled, so the fast path stays three
 * taps and the thorough path is still available.
 */
export function ReportWizard() {
  const [step, setStep] = useState<Step>('category')
  const [category, setCategory] = useState<IncidentCategory | null>(null)
  const [severity, setSeverity] = useState<Severity>('P2')
  const [location, setLocation] = useState<LocatedPosition | null>(null)
  const [description, setDescription] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [wantsCaseToken, setWantsCaseToken] = useState(true)
  const [submitted, setSubmitted] = useState<Incident | null>(null)
  const [caseToken, setCaseToken] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const chooseCategory = (option: (typeof CATEGORY_OPTIONS)[number]) => {
    setCategory(option.category)
    setSeverity(option.defaultSeverity)
    setStep('location')
  }

  const submit = async () => {
    if (!category || !location) return

    setSending(true)
    try {
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          severity,
          title: suggestTitle(category, location.label, description),
          description: description.trim() || 'No further detail given by the reporter.',
          location,
          reporterId: anonymous ? null : 'student-2214',
          wantsCaseToken,
        }),
      })
      if (!response.ok) return

      const body = (await response.json()) as { incident: Incident; caseToken: string | null }
      setSubmitted(body.incident)
      setCaseToken(body.caseToken)
    } finally {
      setSending(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/5 p-5 text-center">
        <p className="ops-label text-emerald-400">Report received</p>
        <p className="mt-2 text-[14px] text-ops-text">{submitted.title}</p>
        <p className="mt-1 text-[12px] text-ops-muted">
          {submitted.location.label} · the control room has it now.
        </p>
        <p className="mt-2 font-mono text-[11px] text-ops-faint">{submitted.id}</p>

        {caseToken && (
          <div className="mt-4 rounded-lg border border-ops-accent/40 bg-ops-bg p-4">
            <p className="ops-label text-ops-accent">Your case token</p>
            <p className="mt-1.5 font-mono text-2xl font-bold tracking-widest text-ops-text">
              {caseToken}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-ops-muted">
              Write this down now — it is shown once and we cannot recover it. Check your
              case any time at <span className="font-mono text-ops-accent">/case</span>, with
              no account and without identifying yourself.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setSubmitted(null)
            setCaseToken(null)
            setStep('category')
            setCategory(null)
            setLocation(null)
            setDescription('')
          }}
          className="mt-4 rounded-md border border-ops-border px-3 py-1.5 text-[12px] text-ops-muted transition-colors hover:text-ops-text"
        >
          File another report
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator step={step} />

      {step === 'category' && (
        <div className="grid grid-cols-2 gap-2">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.category}
              type="button"
              onClick={() => chooseCategory(option)}
              className="rounded-lg border border-ops-border bg-ops-panel p-4 text-left transition-colors hover:border-ops-accent/40 hover:bg-ops-lift"
            >
              <p className="text-[14px] font-semibold text-ops-text">{option.label}</p>
              <p className="mt-0.5 text-[11px] text-ops-muted">{option.hint}</p>
              <span className="mt-2 inline-block">
                <SeverityBadge severity={option.defaultSeverity} compact />
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 'location' && (
        <>
          <LocationStep location={location} onChange={setLocation} />
          <div className="flex gap-2">
            <BackButton onClick={() => setStep('category')} />
            <button
              type="button"
              disabled={!location}
              onClick={() => setStep('review')}
              className="flex-1 rounded-md border border-ops-accent/40 bg-ops-accent/10 px-3 py-2.5 text-[13px] font-medium text-ops-accent transition-colors hover:bg-ops-accent/20 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </>
      )}

      {step === 'review' && category && location && (
        <>
          <div className="rounded-lg border border-ops-border bg-ops-panel p-4">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={severity} />
              <span className="ops-label ml-auto text-ops-faint">{category}</span>
            </div>
            <p className="mt-2 text-[14px] font-medium text-ops-text">
              {suggestTitle(category, location.label, description)}
            </p>
            <p className="mt-1 text-[12px] text-ops-muted">
              {location.label} · {Math.round(location.confidence * 100)}% confidence
            </p>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Anything that helps the responder (optional)"
              className="mt-3 w-full resize-none rounded-md border border-ops-border bg-ops-bg px-2.5 py-2 text-[12px] text-ops-text placeholder:text-ops-faint focus:border-ops-accent/50 focus:outline-none"
            />

            <label className="mt-2 flex items-center gap-2 text-[12px] text-ops-muted">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(event) => setAnonymous(event.target.checked)}
                className="accent-ops-accent"
              />
              Report anonymously
            </label>

            <label className="mt-1.5 flex items-start gap-2 text-[12px] text-ops-muted">
              <input
                type="checkbox"
                checked={wantsCaseToken}
                onChange={(event) => setWantsCaseToken(event.target.checked)}
                className="mt-0.5 accent-ops-accent"
              />
              <span>
                Give me a case token to follow this up
                <span className="mt-0.5 block text-[11px] text-ops-faint">
                  Shown once. Works without an account, even when reporting anonymously.
                </span>
              </span>
            </label>
          </div>

          <div className="flex gap-2">
            <BackButton onClick={() => setStep('location')} />
            <button
              type="button"
              disabled={sending}
              onClick={() => void submit()}
              className="flex-1 rounded-md bg-sev-p0 px-3 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const STEP_LABELS: Record<Step, string> = {
  category: 'What is happening',
  location: 'Where',
  review: 'Send',
}

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = ['category', 'location', 'review']
  const activeIndex = steps.indexOf(step)

  return (
    <div className="flex items-center gap-2">
      {steps.map((name, index) => (
        <div key={name} className="flex flex-1 flex-col gap-1">
          <span
            className={`h-0.5 rounded-full ${index <= activeIndex ? 'bg-ops-accent' : 'bg-ops-border'}`}
          />
          <span
            className={`ops-label ${index === activeIndex ? 'text-ops-accent' : 'text-ops-faint'}`}
          >
            {STEP_LABELS[name]}
          </span>
        </div>
      ))}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-ops-border px-4 py-2.5 text-[13px] text-ops-muted transition-colors hover:text-ops-text"
    >
      Back
    </button>
  )
}
