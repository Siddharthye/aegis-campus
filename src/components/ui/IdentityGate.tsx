'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { readIdentity, saveIdentity } from '@/lib/identity'

/**
 * The first thing AEGIS asks: who are you.
 *
 * Not a login — there is nothing to authenticate against. It is the campus
 * equivalent of writing your name in the visitors' book: one screen, two
 * fields, then everything you file carries your name instead of a stranger's
 * placeholder. Answered once per device and never asked again.
 *
 * Mounted globally so it covers whichever route the reader lands on first.
 */
export function IdentityGate() {
  /* Null while we have not yet checked the device — rendering the gate during
     that gap would flash it at people who answered it weeks ago. */
  const [needed, setNeeded] = useState<boolean | null>(null)
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')

  useEffect(() => {
    setNeeded(readIdentity() === null)
  }, [])

  if (needed !== true) return null

  const ready = name.trim().length > 1 && roll.trim().length > 1

  const submit = () => {
    if (!ready) return
    saveIdentity({ name: name.trim(), roll: roll.trim().toUpperCase() })
    setNeeded(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-title"
      className="fixed inset-0 z-[95] grid place-items-center bg-ops-deep/85 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass-chrome w-full max-w-md rounded-2xl p-6 sm:p-7"
      >
        <p className="ops-label flex items-center gap-2 text-ops-accent">
          <span className="siren-pulse size-1.5 rounded-full bg-ops-accent" />
          Campus Emergency Response OS
        </p>

        <h1
          id="identity-title"
          className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-ops-text"
        >
          Who is reporting?
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ops-muted">
          Everything you file will carry this, so a dispatcher knows who to call
          back. No password, no account — it stays on this device, and you can
          still report anonymously any time.
        </p>

        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="ops-label text-ops-faint">Full name</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ananya Rath"
              className="min-h-12 rounded-xl border border-ops-border bg-ops-bg px-3.5 text-[14px] text-ops-text placeholder:text-ops-faint focus:border-ops-accent/50 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="ops-label text-ops-faint">Roll number</span>
            <input
              value={roll}
              onChange={(event) => setRoll(event.target.value)}
              placeholder="22051234"
              inputMode="text"
              className="min-h-12 rounded-xl border border-ops-border bg-ops-bg px-3.5 font-mono text-[14px] uppercase text-ops-text placeholder:font-sans placeholder:normal-case placeholder:text-ops-faint focus:border-ops-accent/50 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={!ready}
            className="mt-2 min-h-12 rounded-full bg-ops-accent px-6 text-sm font-semibold text-ops-deep transition-colors hover:bg-[#c4b5fd] disabled:opacity-40"
          >
            Continue →
          </button>
        </form>
      </motion.div>
    </div>
  )
}
