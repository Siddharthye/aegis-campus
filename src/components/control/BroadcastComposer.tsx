'use client'

import { useState } from 'react'
import {
  BROADCAST_LANGUAGES,
  renderAllLanguages,
  renderTemplate,
  templatesFor,
  type LanguageCode,
} from '@/domain/broadcast-templates'
import type { Incident } from '@/domain/types'

interface BroadcastComposerProps {
  incident: Incident
  /** Loads the rendered text into the broadcast box; never sends by itself. */
  onUseTemplate: (text: string) => void
}

/**
 * Pre-written broadcasts in English, Hindi and Odia.
 *
 * An English-only alert excludes the support staff, contractors and visitors
 * who are frequently closest to the hazard. Translations are authored rather
 * than generated, because a mistranslated evacuation instruction is worse than
 * no instruction at all.
 */
export function BroadcastComposer({ incident, onUseTemplate }: BroadcastComposerProps) {
  const [language, setLanguage] = useState<LanguageCode | 'all'>('all')
  const templates = templatesFor(incident.category)
  const place = incident.location.label.split(' · ')[0]

  return (
    <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="ops-label text-ops-muted">Broadcast templates</p>

        <div className="ml-auto flex gap-1">
          <LanguageChip
            active={language === 'all'}
            onClick={() => setLanguage('all')}
            label="All"
          />
          {BROADCAST_LANGUAGES.map((option) => (
            <LanguageChip
              key={option.code}
              active={language === option.code}
              onClick={() => setLanguage(option.code)}
              label={option.label}
            />
          ))}
        </div>
      </div>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {templates.slice(0, 4).map((template) => {
          const text =
            language === 'all'
              ? renderAllLanguages(template, place)
              : renderTemplate(template, language, place)

          return (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => onUseTemplate(text)}
                className="w-full rounded-md border border-ops-border bg-ops-bg p-2.5 text-left transition-colors hover:border-ops-accent/40 hover:bg-ops-lift"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-ops-text">{template.label}</span>
                  <span className="ops-label ml-auto text-ops-faint">{template.severity}</span>
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-ops-muted">
                  {text.length > 150 ? `${text.slice(0, 147)}…` : text}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="mt-2 text-[11px] text-ops-faint">
        Filled for <span className="text-ops-muted">{place}</span>. Selecting one loads it into
        the broadcast box below — a human still reads it before it goes out.
      </p>
    </section>
  )
}

function LanguageChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
        active ? 'bg-ops-accent/15 text-ops-accent' : 'text-ops-faint hover:text-ops-muted'
      }`}
    >
      {label}
    </button>
  )
}
