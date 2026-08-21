'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker that keeps `/report` usable in a dead zone.
 *
 * Registration is skipped in development, where an aggressively cached shell
 * makes every code change look like it did not apply.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    // Registration after load, so it never competes with the first paint of a
    // screen someone may be opening mid-emergency.
    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is an enhancement; the app works fully without it.
      })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
