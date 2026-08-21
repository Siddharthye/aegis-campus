'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Bot, Radio, Send } from 'lucide-react'
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

const EASE = [0.22, 1, 0.36, 1] as const

interface LiveStats {
  openIncidents: number
  respondersAvailable: number
  responders: number
}

/**
 * Full-bleed NEXBOT stage — same composition as towerz: Spline owns the
 * viewport, chat docks on the right as the interaction surface.
 */
export function AiConsole({ initialQuestion }: { initialQuestion?: string }) {
  const { messages, busy, ask } = useNexbotChat()
  const [draft, setDraft] = useState('')
  const [stats, setStats] = useState<LiveStats | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const askedInitial = useRef(false)
  const router = useRouter()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    void fetch('/api/stats')
      .then((response) => response.json() as Promise<LiveStats>)
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

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

  // Keep page scroll from stealing wheel events over the 3D stage.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const stop = (event: WheelEvent) => event.stopPropagation()
    el.addEventListener('wheel', stop, { passive: true })
    return () => el.removeEventListener('wheel', stop)
  }, [])

  const submit = (question?: string) => {
    const text = (question ?? draft).trim()
    if (!text) return
    setDraft('')
    void ask(text)
  }

  const briefing = stats
    ? `${stats.openIncidents} open · ${stats.respondersAvailable}/${stats.responders} ready`
    : 'Syncing campus…'

  return (
    <div className="relative h-[calc(100dvh-3.25rem)] min-h-[560px] overflow-hidden pb-24">
      {/* Full-bleed Spline stage */}
      <div ref={stageRef} className="absolute inset-0 bg-ops-deep">
        <div className="absolute inset-y-0 left-0 grid w-full place-items-center md:w-[62%]">
          <NexbotAvatar
            size={260}
            alert={stats !== null && stats.openIncidents > 3}
            className="max-w-[46vw]"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_65%_40%,transparent_18%,rgba(5,7,13,0.55)_78%)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[min(48%,520px)] bg-gradient-to-l from-ops-bg/90 via-ops-bg/35 to-transparent" />
      </div>

      {/* Brand lockup */}
      <motion.div
        className="pointer-events-none absolute top-4 left-4 z-10 max-w-[min(100%,28rem)] md:top-6 md:left-6"
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <div className="ops-label flex items-center gap-2 text-ops-accent">
          <Bot size={12} />
          Ops intelligence
        </div>
        <h1
          className="mt-1 text-[clamp(2.4rem,6vw,4.25rem)] leading-[0.9] font-bold tracking-tight text-ops-text"
          style={{ textShadow: '0 8px 40px rgba(0,0,0,0.55)' }}
        >
          NEXBOT
        </h1>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-ops-muted">
          Tracks your cursor across the desk. Ask anything about the live incident store —
          no model, no key.
        </p>
      </motion.div>

      {/* Live brief chip */}
      <motion.div
        className="absolute bottom-28 left-4 z-10 md:bottom-32 md:left-6"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: EASE }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-ops-border bg-black/50 px-3 py-1.5 font-mono text-[10px] tracking-[0.04em] text-white/70 backdrop-blur-md">
          <Radio size={11} className="text-ops-accent" />
          <span className="siren-pulse size-1.5 rounded-full bg-ops-accent" />
          {briefing}
        </div>
      </motion.div>

      {/* Chat dock */}
      <motion.aside
        className="absolute top-3 right-3 bottom-24 z-20 flex w-[min(100%-1.5rem,400px)] flex-col md:top-5 md:right-5 md:bottom-28"
        initial={reduceMotion ? false : { opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.08, duration: 0.45, ease: EASE }}
      >
        <div className="glass-slab flex min-h-0 flex-1 flex-col overflow-hidden !p-0 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-2 border-b border-ops-border px-3 py-2.5">
            <span className="grid size-7 place-items-center rounded-full bg-ops-accent/10 text-ops-accent">
              <Bot size={14} />
            </span>
            <div className="min-w-0">
              <p className="ops-label text-ops-accent">Ask NEXBOT</p>
              <p className="truncate text-[12px] font-medium text-ops-text">Live campus · local engine</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-ops-border px-3 py-2.5">
            {SUGGESTIONS.slice(0, 4).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => submit(suggestion)}
                className="rounded-full border border-ops-border bg-ops-lift/60 px-2.5 py-1 text-[11px] text-ops-muted transition hover:border-ops-accent/40 hover:text-ops-text"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <p className="text-[13px] leading-relaxed text-ops-muted">
                Ask about open incidents, SLA clocks, responders, a category, or say
                &ldquo;brief&rdquo;. I read the live board — I never guess.
              </p>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-ops-accent text-ops-deep'
                      : 'border border-ops-border bg-ops-lift/70 text-ops-text'
                  }`}
                >
                  {message.pending ? (
                    <span className="siren-pulse text-ops-accent">reading the board…</span>
                  ) : message.role === 'bot' ? (
                    <TypewriterText text={message.text} />
                  ) : (
                    message.text
                  )}

                  {message.navigate && !message.pending && (
                    <button
                      type="button"
                      onClick={() => router.push(message.navigate as string)}
                      className="ops-label mt-2 block rounded-md border border-ops-accent/40 bg-ops-accent/10 px-2 py-1.5 text-ops-accent"
                    >
                      Open view →
                    </button>
                  )}

                  {message.sources && !message.pending && (
                    <SourcesReceipt sources={message.sources} />
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-ops-border p-3"
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
              className="min-w-0 flex-1 rounded-xl border border-ops-border bg-ops-bg/80 px-3 py-2.5 text-[13px] outline-none transition-colors focus:border-ops-accent"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-ops-accent/40 bg-ops-accent/10 text-ops-accent transition hover:bg-ops-accent/20 disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </motion.aside>
    </div>
  )
}

function SourcesReceipt({ sources }: { sources: AssistSources }) {
  return (
    <p className="ops-label mt-2 border-t border-ops-border/60 pt-1.5 text-ops-faint">
      read {sources.incidents} incidents · {sources.responders} responders · {sources.tookMs}ms
    </p>
  )
}

const CHARS_PER_TICK = 3
const TICK_MS = 14

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
