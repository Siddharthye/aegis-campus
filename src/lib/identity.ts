'use client'

import { useEffect, useState } from 'react'

/**
 * Who is using AEGIS right now.
 *
 * Deliberately not authentication: there is no password, no server, and no
 * session. A campus emergency tool cannot make a frightened person log in, so
 * the app asks once for a name and a roll number, keeps them on the device,
 * and attributes everything to them from then on.
 *
 * That means the identity is *claimed*, not verified — the control room sees
 * a roll number because it is more useful than "Anonymous", not because the
 * platform can vouch for it. Anonymous reporting stays available and still
 * strips this entirely.
 */

const STORAGE_KEY = 'aegis:identity'

export interface Identity {
  name: string
  roll: string
}

/** Broadcast so every mounted hook updates the moment the gate is answered. */
const IDENTITY_EVENT = 'aegis:identity-changed'

export function readIdentity(): Identity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Identity>
    if (!parsed.name || !parsed.roll) return null
    return { name: parsed.name, roll: parsed.roll }
  } catch {
    // A blocked or corrupt localStorage must not take the app down; the gate
    // simply asks again.
    return null
  }
}

export function saveIdentity(identity: Identity) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  } catch {
    // Private-browsing mode: the identity lives for this page only.
  }
  window.dispatchEvent(new Event(IDENTITY_EVENT))
}

export function clearIdentity() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
  window.dispatchEvent(new Event(IDENTITY_EVENT))
}

/**
 * The current identity, or null before the gate is answered.
 *
 * Starts null on every render pass so the server and the browser agree —
 * localStorage does not exist during SSR, and reading it while rendering
 * would fail hydration.
 *
 * @example
 * const identity = useIdentity()
 * <span>{identity ? identity.roll : 'Anonymous'}</span>
 */
export function useIdentity(): Identity | null {
  const [identity, setIdentity] = useState<Identity | null>(null)

  useEffect(() => {
    const sync = () => setIdentity(readIdentity())
    sync()

    window.addEventListener(IDENTITY_EVENT, sync)
    // Another tab answering the gate counts too.
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(IDENTITY_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return identity
}

/** `Ananya Rath · 22051234`, or a placeholder before the gate is answered. */
export function describeIdentity(identity: Identity | null): string {
  return identity ? `${identity.name} · ${identity.roll}` : 'Not signed in'
}
