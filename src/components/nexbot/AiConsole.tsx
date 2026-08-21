'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { NexbotAvatar } from './NexbotAvatar'
import { useNexbotChat, type AssistSources } from './use-nexbot-chat'

const SUGGESTIONS = [
  'What needs attention?',
  'Any SLA breaches?',
  'Who is free right now?',
  'How do I report silently?',
  'Give me the morning brief',
]

interface LiveStats {
  openIncidents: number
  respondersAvailable: number
  responders: number
}

/**
 * The full NEXBOT console — the robot, the conversation, and the receipts.
 *
 * Every answer shows what was read and how long it took, because this
 * assistant's honest pitch is the opposite of the usual one: no model, no
 * key, no wifi needed. Measured milliseconds are more impressive than a
 * thinking spinner when the number is real.
 */
export function AiConsole({ initialQuestion }: { initialQuestion?: string }) {
  const { messages, busy, ask } = useNexbotChat()
  const [draft, setDraft] = useState('')
  const [stats, setStats] = useState<LiveStats | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const askedInitial = useRef(false)
  const router = useRouter()

  useEffect(() => {
    void fetch('/api/stats')
      .then((response) => response.json() as Promise<LiveStats>)
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  // ⌘K hands a typed question straight to this page as ?q=.
  useEffect(() => {
    if (initialQuestion && !askedInitial.current) {
      askedInitial.current = true
      void ask(initialQuestion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once for the handed-in question.
  }, [initialQuestion])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const submit = (question?: string) => {
    const text = (question ?? draft).trim()
    if (!text) return
    setDraft('')
    void ask(text)
  }

  return (
    <div className="glass-slab grid gap-0 overflow-hidden lg:grid-cols-[1fr_1.35fr]">
      {/* The robot and its honest spec sheet. */}
      <div className="relative flex flex-col items-center justify-center gap-6 border-b border-ops-border/60 px-8 py-12 lg:border-b-0 lg:border-r">
        <div aria-hidden className="aurora-blob aurora-a left-[10%] top-[15%] size-[60%] opacity-70" />

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <NexbotAvatar size={170} alert={stats !== null && stats.openIncidents > 3} />
        </motion.div>

        <div className="relative text-center">
          <p className="font-mono text-lg font-bold tracking-widest text-ops-text">NEXBOT</p>
          <p className="mt-1 text-[12px] text-ops-muted">Ops copilot · reads the live store</p>
        </div>

        <div className="relative flex flex-wrap justify-center gap-1.5">
          <SpecChip label="LOCAL ENGINE" tone="accent" />
          <SpecChip label="NO API KEY" />
          <SpecChip label="WORKS OFFLINE" />
          {stats && (
            <>
              <SpecChip label={`${stats.openIncidents} OPEN`} />
              <SpecChip label={`${stats.respondersAvailable}/${stats.responders} READY`} />
            </>
          )}
        </div>

        <p className="relative max-w-xs text-center text-[11px] leading-relaxed text-ops-faint">
          Answers are computed from the incident store in the time it takes to render. The
          receipts under each reply — what was read, how fast — are measured, not decorative.
        </p>
      </div>

      {/* The conversation. */}
      <div className="flex min-h-[540px] flex-col">
        <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-start justify-center gap-3">
              <p className="text-[13px] leading-relaxed text-ops-muted">
                Ask about open incidents, SLA clocks, responders, a category, or say
                &ldquo;brief&rdquo;. I read the live board — I never guess.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="rounded-full border border-ops-border bg-ops-lift/60 px-3 py-1.5 text-[12px] text-ops-muted transition hover:border-ops-accent/40 hover:text-ops-text"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-ops-accent text-ops-deep'
                    : 'border border-ops-border bg-ops-lift/70 text-ops-text'
                }`}
              >
                {message.pending ? (
                  <ThinkingDots />
                ) : message.role === 'bot' ? (
                  <TypewriterText text={message.text} />
                ) : (
                  message.text
                )}

                {message.navigate && !message.pending && (
                  <button
                    type="button"
                    onClick={() => router.push(message.navigate as string)}
                    className="ops-label mt-2.5 block rounded-md border border-ops-accent/40 bg-ops-accent/10 px-2.5 py-1.5 text-ops-accent transition hover:bg-ops-accent/20"
                  >
                    Open view →
                  </button>
                )}

                {message.sources && !message.pending && <SourcesReceipt sources={message.sources} />}
              </div>
            </div>
          ))}
        </div>

        <form
          className="flex gap-2 border-t border-ops-border/60 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={busy}
            placeholder="Ask about the live board…"
            className="min-w-0 flex-1 rounded-xl border border-ops-border bg-ops-bg/80 px-4 py-3 text-[13px] outline-none transition-colors focus:border-ops-accent"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-ops-accent/40 bg-ops-accent/10 text-ops-accent transition hover:bg-ops-accent/20 disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  )
}

function SpecChip({ label, tone }: { label: string; tone?: 'accent' }) {
  return (
    <span
      className={`ops-label rounded-full border px-2.5 py-1 ${
        tone === 'accent'
          ? 'border-ops-accent/40 bg-ops-accent/10 text-ops-accent'
          : 'border-ops-border text-ops-faint'
      }`}
    >
      {label}
    </span>
  )
}

/** "what was read · how fast" — the honest version of a thinking indicator. */
function SourcesReceipt({ sources }: { sources: AssistSources }) {
  return (
    <p className="ops-label mt-2 border-t border-ops-border/60 pt-1.5 text-ops-faint">
      read {sources.incidents} incidents · {sources.responders} responders · {sources.tookMs}ms
    </p>
  )
}

function ThinkingDots() {
  return (
    <span className="siren-pulse text-ops-accent" aria-label="Thinking">
      reading the board…
    </span>
  )
}

/** Reveal cadence — fast enough to feel live, slow enough to read as typing. */
const CHARS_PER_TICK = 3
const TICK_MS = 14

/**
 * Types a reply out character by character. Purely presentational: the full
 * answer already arrived, so reduced-motion users get it instantly.
 */
function TypewriterText({ text }: { text: string }) {
  const reduceMotion = useReducedMotion()
  const [visible, setVisible] = useState(reduceMotion ? text.length : 0)

  useEffect(() => {
    if (reduceMotion) {
      setVisible(text.length)
      return
    }
    setVisible(0)
    const interval = setInterval(() => {
      setVisible((current) => {
        if (current >= text.length) {
          clearInterval(interval)
          return current
        }
        return current + CHARS_PER_TICK
      })
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [text, reduceMotion])

  return <>{text.slice(0, visible)}</>
}
