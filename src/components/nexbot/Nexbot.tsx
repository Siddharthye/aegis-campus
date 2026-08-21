'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Send, Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { NexbotAvatar } from './NexbotAvatar'

/**
 * NEXBOT — the AEGIS ops copilot. Floating FAB opens a chat sheet; answers are
 * computed server-side from the live incident store (`/api/assist`), so it
 * works offline and responds instantly. Pattern carried over from our TOWERZ
 * project and rebuilt for the incident domain.
 */

interface Message {
  id: number
  role: 'user' | 'bot'
  text: string
  navigate?: string
  pending?: boolean
}

const SUGGESTIONS = [
  'What needs attention?',
  'Any SLA breaches?',
  'Who is free right now?',
  'How do I report silently?',
]

export function Nexbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)
  const scroller = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages])

  const ask = async (question?: string) => {
    const text = (question ?? draft).trim()
    if (!text || busy) return

    setDraft('')
    setBusy(true)
    const pendingId = nextId.current + 1
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: 'user', text },
      { id: nextId.current++, role: 'bot', text: '…', pending: true },
    ])

    try {
      const response = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const answer = (await response.json()) as { text: string; navigate?: string }

      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? { ...message, text: answer.text, navigate: answer.navigate, pending: false }
            : message,
        ),
      )
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? { ...message, text: 'NEXBOT is unreachable — is the server running?', pending: false }
            : message,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <motion.button
        type="button"
        onClick={() => setOpen((current) => !current)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed right-5 bottom-5 z-50 grid size-15 place-items-center rounded-full border border-ops-accent/40 bg-ops-panel/80 backdrop-blur-sm shadow-[0_0_28px_rgba(56,189,248,0.28)]"
        aria-label={open ? 'Close NEXBOT' : 'Ask NEXBOT'}
      >
        {open ? (
          <X size={20} className="text-ops-accent" />
        ) : (
          <NexbotAvatar size={38} />
        )}
      </motion.button>

      {/* Sheet */}
      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="card-sheen fixed right-5 bottom-21 z-50 flex max-h-[min(60vh,480px)] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl bg-ops-panel/95 backdrop-blur-md"
          >
            <header className="flex items-center gap-2.5 border-b border-ops-border px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ops-accent/10">
                <NexbotAvatar size={24} />
              </span>
              <div>
                <p className="ops-label text-ops-accent">Ask NEXBOT</p>
                <p className="text-[11px] text-ops-muted">Live campus ops · answers locally</p>
              </div>
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
                        onClick={() => ask(suggestion)}
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
                      <span className="siren-pulse text-ops-accent">thinking…</span>
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
                  </div>
                </div>
              ))}
            </div>

            <form
              className="flex gap-2 border-t border-ops-border p-3"
              onSubmit={(event) => {
                event.preventDefault()
                void ask()
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
