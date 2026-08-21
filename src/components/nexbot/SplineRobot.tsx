'use client'

import { useEffect, useRef, useState } from 'react'
import { NexbotAvatar } from './NexbotAvatar'

/**
 * NEXBOT Spline scene — same mount pattern as towerz.
 *
 * `@splinetool/viewer`'s custom element is created imperatively because React
 * props on custom elements are unreliable for `url`. The scene is served from
 * our own `public/` (not Spline's CDN) so venue wifi can still fail without
 * blanking the hero. CSS `NexbotAvatar` covers the load / failure window.
 */

const SCENE_URL = '/nexbot.splinecode'

type LoadState = 'idle' | 'loading' | 'ready' | 'failed'

interface SplineRobotProps {
  /** Size of the CSS fallback robot while the scene loads / if it fails. */
  fallbackSize?: number
  className?: string
  /**
   * `global` lets look-at track the cursor outside the canvas (towerz default).
   * `local` only tracks when the pointer is over the viewer.
   */
  eventsTarget?: 'local' | 'global'
  /** Dark fill behind the scene so transparent materials don't flash white. */
  background?: string
}

export function SplineRobot({
  fallbackSize = 190,
  className = '',
  eventsTarget = 'global',
  background = '#0a0e17',
}: SplineRobotProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<LoadState>('idle')

  // Only pay for the scene once the section is near the viewport.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState((current) => (current === 'idle' ? 'loading' : current))
          observer.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (state !== 'loading') return
    const host = hostRef.current
    if (!host) return

    let cancelled = false

    void (async () => {
      try {
        await import('@splinetool/viewer')
        await customElements.whenDefined('spline-viewer')
        if (cancelled || !hostRef.current) return

        const el = document.createElement('spline-viewer') as HTMLElement & {
          url?: string
        }
        el.setAttribute('url', SCENE_URL)
        el.setAttribute('events-target', eventsTarget)
        el.setAttribute('loading-anim-type', 'spinner-small-dark')
        el.style.width = '100%'
        el.style.height = '100%'
        el.style.display = 'block'
        el.style.background = background

        try {
          el.url = SCENE_URL
        } catch {
          /* attribute is enough */
        }

        host.replaceChildren(el)
        if (!cancelled) setState('ready')
      } catch (error) {
        console.error('NEXBOT scene failed to load', error)
        if (!cancelled) setState('failed')
      }
    })()

    return () => {
      cancelled = true
      host.replaceChildren()
    }
  }, [state, eventsTarget, background])

  return (
    <div className={`relative ${className}`}>
      <div
        ref={hostRef}
        className={`absolute inset-0 transition-opacity duration-700 ${
          state === 'ready' ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {state !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center">
          {state === 'failed' ? (
            <div className="max-w-[16rem] px-4 text-center font-mono text-[11px] leading-relaxed text-ops-muted">
              NEXBOT scene failed to load.
              <br />
              Check /nexbot.splinecode
            </div>
          ) : (
            <NexbotAvatar size={fallbackSize} />
          )}
        </div>
      )}
    </div>
  )
}
