'use client'

import { useEffect, useRef } from 'react'

/**
 * Subscribes to the AEGIS live event stream and invokes `onEvent` for each
 * named event. `EventSource` reconnects on its own and replays `Last-Event-ID`,
 * so server-side stream rotation is invisible here.
 *
 * @example
 * useLiveEvents(['incident.created', 'incident.updated'], (type, payload) => refresh())
 */
export function useLiveEvents(
  eventTypes: readonly string[],
  onEvent: (type: string, payload: unknown) => void,
): void {
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    const source = new EventSource('/api/events')

    const listeners = eventTypes.map((type) => {
      const listener = (event: Event) => {
        const { data } = event as MessageEvent<string>
        handlerRef.current(type, JSON.parse(data))
      }
      source.addEventListener(type, listener)
      return { type, listener }
    })

    return () => {
      for (const { type, listener } of listeners) source.removeEventListener(type, listener)
      source.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- eventTypes is a stable literal at every call site.
  }, [eventTypes.join('|')])
}
