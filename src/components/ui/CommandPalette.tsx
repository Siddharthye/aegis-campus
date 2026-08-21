'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Command, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Incident } from '@/domain/types'
import { OPEN_PALETTE_EVENT } from './Dock'

/**
 * The command palette — ⌘K / Ctrl+K anywhere, or the search tile on the dock.
 *
 * One input that reaches everything: every screen, any live incident by id or
 * title, and NEXBOT for anything phrased as a question. Selection is fully
 * keyboard-driven because the people this product imitates — dispatchers —
 * do not reach for a mouse mid-incident.
 */

interface PaletteAction {
  id: string
  title: string
  hint: string
  /** Extra strings the filter matches against, beyond the title. */
  keywords: string
  href: string
}

const PAGES: PaletteAction[] = [
  { id: 'report', title: 'Report an emergency', hint: 'Reporter', keywords: 'file incident siren', href: '/report' },
  { id: 'safe-walk', title: 'Safe Walk', hint: 'Reporter', keywords: 'walk home night escort check in', href: '/safe-walk' },
  { id: 'control', title: 'Control Room', hint: 'Dispatcher', keywords: 'queue dispatch drill broadcast', href: '/control' },
  { id: 'respond', title: 'My assignment', hint: 'Responder', keywords: 'respond eta', href: '/respond' },
  { id: 'analytics', title: 'PULSE analytics', hint: 'Admin', keywords: 'heatmap patrol sla hotspots', href: '/analytics' },
  { id: 'sightline', title: 'SIGHTLINE risk map', hint: 'Reporter', keywords: 'safe route night pattern harassment avoid risk hour', href: '/sightline' },
  { id: 'case', title: 'Check a case', hint: 'VEIL', keywords: 'token anonymous follow up', href: '/case' },
  { id: 'ai', title: 'NEXBOT console', hint: 'AI copilot', keywords: 'ai chat assistant robot', href: '/ai' },
]

/** Incidents shown when the query matches — enough to find, not to browse. */
const MAX_INCIDENT_RESULTS = 5

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelected(0)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
      if (event.key === 'Escape') close()
    }
    const onOpenEvent = () => setOpen(true)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent)
    }
  }, [close])

  // Live incidents load when the palette opens, not on every page — the
  // palette is rare, the pages are not.
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    void fetch('/api/incidents')
      .then((response) => response.json() as Promise<{ incidents: Incident[] }>)
      .then((body) => setIncidents(body.incidents))
      .catch(() => setIncidents([]))
  }, [open])

  const needle = query.trim().toLowerCase()

  const results = useMemo(() => {
    const pageMatches = PAGES.filter(
      (page) =>
        needle.length === 0 ||
        `${page.title} ${page.hint} ${page.keywords}`.toLowerCase().includes(needle),
    ).map((page) => ({ ...page, section: 'Go to' as const }))

    const incidentMatches =
      needle.length < 2
        ? []
        : incidents
            .filter((incident) =>
              `${incident.id} ${incident.title} ${incident.location.label}`
                .toLowerCase()
                .includes(needle),
            )
            .slice(0, MAX_INCIDENT_RESULTS)
            .map((incident) => ({
              id: incident.id,
              title: incident.title,
              hint: `${incident.severity} · ${incident.status}`,
              keywords: '',
              href: `/control?incident=${encodeURIComponent(incident.id)}`,
              section: 'Incidents' as const,
            }))

    const ask =
      needle.length >= 3
        ? [
            {
              id: 'ask-nexbot',
              title: `Ask NEXBOT: “${query.trim()}”`,
              hint: 'AI copilot',
              keywords: '',
              href: `/ai?q=${encodeURIComponent(query.trim())}`,
              section: 'Ask' as const,
            },
          ]
        : []

    return [...pageMatches, ...incidentMatches, ...ask]
  }, [needle, query, incidents])

  const clampedSelection = Math.min(selected, Math.max(0, results.length - 1))

  const activate = (index: number) => {
    const target = results[index]
    if (!target) return
    close()
    router.push(target.href)
  }

  const onInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((current) => Math.min(current + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      activate(clampedSelection)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] bg-ops-deep/60 backdrop-blur-sm"
          onMouseDown={close}
        >
          <motion.div
            role="dialog"
            aria-label="Command palette"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
            className="glass-chrome mx-auto mt-[16vh] w-[min(92vw,560px)] overflow-hidden rounded-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-ops-border px-4 py-3">
              <Search className="size-4 shrink-0 text-ops-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelected(0)
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Search screens, incidents, or ask NEXBOT…"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-ops-text placeholder:text-ops-faint focus:outline-none"
              />
              <kbd className="ops-label flex items-center gap-1 rounded border border-ops-border px-1.5 py-0.5 text-ops-faint">
                <Command className="size-3" /> K
              </kbd>
            </div>

            <ul className="max-h-[46vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-[12px] text-ops-muted">
                  Nothing matches. Try an incident id, a screen name, or a question.
                </li>
              )}

              {results.map((result, index) => {
                const isSelected = index === clampedSelection
                const previous = results[index - 1]
                const showSection = !previous || previous.section !== result.section

                return (
                  <li key={`${result.section}-${result.id}`}>
                    {showSection && (
                      <p className="ops-label px-3 pb-1 pt-2.5 text-ops-faint">{result.section}</p>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => setSelected(index)}
                      onClick={() => activate(index)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-ops-accent/12 text-ops-text' : 'text-ops-muted'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px]">{result.title}</span>
                      <span className="ops-label shrink-0 text-ops-faint">{result.hint}</span>
                      {isSelected && <ArrowRight className="size-3.5 shrink-0 text-ops-accent" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
