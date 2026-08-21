'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Send, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { NexbotAvatar } from './NexbotAvatar'
import { useNexbotChat } from './use-nexbot-chat'

/**
 * NEXBOT's floating seat — quick chat from any screen, with the full console
 * one link away at /ai. Answers come from `/api/assist`, which reads the live
 * incident store: no external model, no key, works offline.
 *
 * Positioned above the dock, which owns the bottom edge of every screen.
 */

const SUGGESTIONS = [
  'What needs attention?',
  'Any SLA breaches?',
  'Who is free right now?',
  'How do I report silently?',
]

export function Nexbot() {
  const [open, setOpen] = useState(false)
  const { messages, busy, ask } = useNexbotChat()
  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages])

  const submit = (question?: string) => {
    const text = (question ?? draft).trim()
    if (!text) return
    setDraft('')
    void ask(text)
  }

  return (
    <>
      {/* FAB — sits above the dock's corner. */}
      <motion.button
        type="button"
        onClick={() => setOpen((current) => !current)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="glass-chrome fixed right-4 bottom-24 z-50 grid size-15 place-items-center rounded-full shadow-[0_0_28px_rgba(56,189,248,0.28)] sm:right-5 sm:bottom-5"
        aria-label={open ? 'Close NEXBOT' : 'Ask NEXBOT'}
      >
        {open ? <X size={20} className="text-ops-accent" /> : <NexbotAvatar size={38} />}
      </motion.button>

      {/* Sheet */}
      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="card-sheen fixed inset-x-4 bottom-24 z-50 flex max-h-[min(70vh,520px)] flex-col overflow-hidden rounded-2xl bg-ops-panel/95 backdrop-blur-md sm:inset-x-auto sm:right-5 sm:bottom-24 sm:w-[380px]"
          >
            <header className="flex items-center gap-2.5 border-b border-ops-border px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ops-accent/10">
                <NexbotAvatar size={24} />
              </span>
              <div>
                <p className="ops-label text-ops-accent">Ask NEXBOT</p>
                <p className="text-[11px] text-ops-muted">Live campus ops · answers locally</p>
              </div>
              <Link
                href="/ai"
                onClick={() => setOpen(false)}
                className="ops-label ml-auto rounded-md border border-ops-border px-2 py-1 text-ops-faint transition-colors hover:border-ops-accent/40 hover:text-ops-accent"
              >
                Console →
              </Link>
            </header>

            <div ref={scroller} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="space-y-2 py-2 text-[12px] leading-relaxed text-ops-muted">
                  <Sparkles size={15} className="text-ops-accent" />
                  <p>
                    Ask about open incidents, SLA clocks, responders, or how to report.
                    Answers come from the live AEGIS store — no external model needed.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => submit(suggestion)}
                        className="rounded-full border border-ops-border bg-ops-lift px-2.5 py-1 text-left text-[11px] text-ops-muted transition hover:border-ops-accent/40 hover:text-ops-text"
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
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-ops-accent text-ops-deep'
                        : 'border border-ops-border bg-ops-lift text-ops-text'
                    }`}
                  >
                    {message.pending ? (
                      <span className="siren-pulse text-ops-accent">reading the board…</span>
                    ) : (
                      message.text
                    )}
                    {message.navigate && !message.pending && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          router.push(message.navigate as string)
                        }}
                        className="ops-label mt-2 block rounded-md border border-ops-accent/40 bg-ops-accent/10 px-2 py-1 text-ops-accent"
                      >
                        Open view →
                      </button>
                    )}
                    {message.sources && !message.pending && (
                      <p className="ops-label mt-1.5 border-t border-ops-border/60 pt-1 text-ops-faint">
                        {message.sources.incidents} incidents · {message.sources.tookMs}ms
                      </p>
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
                placeholder="Ask NEXBOT…"
                className="min-w-0 flex-1 rounded-lg border border-ops-border bg-ops-bg px-3 py-2 text-[12px] outline-none focus:border-ops-accent"
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-ops-accent/40 bg-ops-accent/10 text-ops-accent transition hover:bg-ops-accent/20 disabled:opacity-40"
                aria-label="Send"
              >
                <Send size={14} />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}
