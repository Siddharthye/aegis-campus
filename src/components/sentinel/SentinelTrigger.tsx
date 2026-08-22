'use client'

import { useRef, useState } from 'react'
import { DecoyCalculator } from './DecoyCalculator'

/** Taps required to arm, and the window they must land in. */
const REQUIRED_TAPS = 3
const TAP_WINDOW_MS = 1200

type Phase = { kind: 'idle' } | { kind: 'armed'; sessionId: string; pin: string } | { kind: 'shown-pin'; sessionId: string }

/**
 * SENTINEL — silent panic, armed by a triple-tap.
 *
 * Wraps any region of the report screen. Three taps on bare surface inside
 * 1.2 seconds arms a
 * session and drops a decoy calculator over the whole display while location
 * streams silently to the control room.
 *
 * Ethics, because a panel will ask: arming is user-initiated and opt-in, the
 * PIN is shown once at arm time so consent is explicit, disarming requires
 * that PIN, and every session is written to the audit log where only the
 * control room can see it.
 */
export function SentinelTrigger({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const tapTimes = useRef<number[]>([])

  const registerTap = async (event: React.PointerEvent) => {
    // Only bare surface counts. Filling in the report means tapping buttons
    // and fields, and three quick taps on those is someone answering
    // questions — not someone signalling for help. Counting them would arm a
    // decoy screen over the form they were halfway through.
    if ((event.target as Element | null)?.closest('button, a, input, select, textarea, [role="button"]')) {
      return
    }

    const now = Date.now()
    tapTimes.current = [...tapTimes.current, now].filter((time) => now - time < TAP_WINDOW_MS)
    if (tapTimes.current.length < REQUIRED_TAPS) return

    tapTimes.current = []
    const position = await currentPosition()

    try {
      const response = await fetch('/api/sentinel/arm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(position ?? {}),
      })
      if (!response.ok) return

      const body = (await response.json()) as { sessionId: string; pin: string }
      setPhase({ kind: 'armed', sessionId: body.sessionId, pin: body.pin })
    } catch {
      // Arming failed — stay on the report screen rather than showing a decoy
      // that is covering nothing.
    }
  }

  if (phase.kind === 'armed') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-ops-deep p-6 text-center">
        <p className="ops-label text-sev-p0">Silent alarm armed</p>
        <p className="max-w-xs text-[13px] leading-relaxed text-ops-muted">
          Your location is now streaming to the control room. Memorise this PIN — typing it into
          the calculator and pressing <span className="font-mono">=</span> is the only way to stop
          the alarm.
        </p>
        <p className="font-mono text-5xl font-bold tracking-[0.3em] text-ops-text">{phase.pin}</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: 'shown-pin', sessionId: phase.sessionId })}
          className="rounded-md border border-ops-accent/40 bg-ops-accent/10 px-4 py-2 text-[12px] font-medium text-ops-accent"
        >
          I have memorised it — show the cover screen
        </button>
      </div>
    )
  }

  if (phase.kind === 'shown-pin') {
    return (
      <DecoyCalculator
        sessionId={phase.sessionId}
        onDisarmed={() => setPhase({ kind: 'idle' })}
      />
    )
  }

  return (
    <div onPointerDown={(event) => void registerTap(event)} className="contents">
      {children}
    </div>
  )
}

/** A GPS fix if the browser offers one quickly; never blocks arming on it. */
function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { timeout: 2_000, maximumAge: 30_000 },
    )
  })
}
