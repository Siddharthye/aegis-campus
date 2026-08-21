'use client'

import { useState } from 'react'
import { useSentinelPings } from './use-sentinel-pings'

/** Calculator keys, in visual order. */
const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'] as const

const OPERATORS: Record<string, (a: number, b: number) => number> = {
  '+': (a, b) => a + b,
  '−': (a, b) => a - b,
  '×': (a, b) => a * b,
  '÷': (a, b) => (b === 0 ? Number.NaN : a / b),
}

interface DecoyCalculatorProps {
  sessionId: string
  /** Called once the correct PIN has been accepted by the server. */
  onDisarmed: () => void
}

/**
 * The SENTINEL cover screen: a working calculator that hides an armed
 * silent-panic session.
 *
 * The calculator is genuinely functional — anyone who takes the phone and taps
 * it sees arithmetic, not a disguised alarm. Typing the 4-digit disarm PIN and
 * pressing `=` ends the session; every other input is just arithmetic.
 *
 * Disarm requires the PIN precisely so that someone who seizes the phone
 * cannot switch the alarm off. The server answers identically for a wrong PIN
 * and a right one, so watching the network reveals nothing either.
 */
export function DecoyCalculator({ sessionId, onDisarmed }: DecoyCalculatorProps) {
  const [display, setDisplay] = useState('0')
  const [pending, setPending] = useState<{ value: number; operator: string } | null>(null)
  const [freshEntry, setFreshEntry] = useState(true)

  useSentinelPings(sessionId)

  const attemptDisarm = async (candidate: string): Promise<boolean> => {
    if (!/^\d{4}$/.test(candidate)) return false

    try {
      const response = await fetch('/api/sentinel/disarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: candidate }),
      })
      const body = (await response.json()) as { disarmed: boolean }
      return body.disarmed
    } catch {
      // Offline: stay armed and keep showing arithmetic. Failing open here
      // would let a dropped connection silently cancel someone's alarm.
      return false
    }
  }

  const press = async (key: string) => {
    if (key === '=') {
      // The PIN check runs before the arithmetic so that a disarm looks
      // exactly like pressing equals on any other number.
      if (await attemptDisarm(display)) {
        onDisarmed()
        return
      }

      if (pending) {
        const result = OPERATORS[pending.operator](pending.value, Number(display))
        setDisplay(Number.isFinite(result) ? String(result) : 'Error')
        setPending(null)
      }
      setFreshEntry(true)
      return
    }

    if (key in OPERATORS) {
      setPending({ value: Number(display), operator: key })
      setFreshEntry(true)
      return
    }

    const next = freshEntry ? (key === '.' ? '0.' : key) : `${display}${key}`
    setDisplay(next.length > 12 ? next.slice(0, 12) : next)
    setFreshEntry(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white text-neutral-900">
      <div className="flex flex-1 items-end justify-end p-6">
        <output className="font-mono text-6xl font-light tabular-nums">{display}</output>
      </div>

      <div className="grid grid-cols-4 gap-px bg-neutral-200">
        <button
          type="button"
          onClick={() => {
            setDisplay('0')
            setPending(null)
            setFreshEntry(true)
          }}
          className="col-span-4 bg-white py-4 text-lg font-medium text-neutral-500 active:bg-neutral-100"
        >
          C
        </button>

        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => void press(key)}
            className={`py-6 text-2xl font-light active:bg-neutral-100 ${
              key in OPERATORS || key === '=' ? 'bg-neutral-50 text-neutral-700' : 'bg-white'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
