'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  dropReport,
  enqueueReport,
  markAttempt,
  pruneQueue,
  type QueuedReport,
} from '@/domain/offline-queue'
import { readQueue, requestBackgroundFlush, writeQueue } from '@/lib/queue-store'

/** How often a queued report is retried while the tab stays open. */
const RETRY_INTERVAL_MS = 15_000

export interface OfflineQueue {
  /** Reports still waiting to reach the server. */
  queued: QueuedReport[]
  online: boolean
  /** Queues a report for later delivery to `endpoint`. */
  queue: (body: unknown, endpoint?: string) => void
  /** Attempts delivery of everything pending, now. */
  flush: () => Promise<void>
}

/**
 * Holds reports that could not be sent, and delivers them when the network
 * comes back.
 *
 * Delivery is attempted three ways, because no one of them is enough. The
 * `online` event catches the common case. A slow interval covers the phone
 * that walks out of a dead zone without firing any event, because the browser
 * only knows it has an interface, not that the interface works. And
 * Background Sync hands the queue to the browser itself, so a report still
 * sends after this tab is closed — the case the other two cannot reach.
 *
 * @example
 * const { queue, flush, queued, online } = useOfflineQueue()
 * if (!online) queue(reportBody)
 */
export function useOfflineQueue(): OfflineQueue {
  const [queued, setQueued] = useState<QueuedReport[]>([])
  const [online, setOnline] = useState(true)

  // Storage and `navigator.onLine` are browser-only, so the first read happens
  // after mount rather than during render — otherwise SSR and the client would
  // disagree about the initial markup.
  useEffect(() => {
    setOnline(navigator.onLine)
    void readQueue().then((stored) => setQueued(pruneQueue(stored, new Date())))
  }, [])

  const persist = useCallback((next: QueuedReport[]) => {
    setQueued(next)
    void writeQueue(next)
  }, [])

  const flush = useCallback(async () => {
    let working = pruneQueue(await readQueue(), new Date())

    for (const report of working) {
      try {
        const response = await fetch(report.endpoint ?? '/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report.body),
        })

        // A validation failure will never succeed on retry, so drop it rather
        // than retrying a malformed report forever.
        if (response.ok || response.status === 400) {
          working = dropReport(working, report.id)
        } else {
          working = markAttempt(working, report.id, `server responded ${response.status}`)
        }
      } catch (error) {
        working = markAttempt(
          working,
          report.id,
          error instanceof Error ? error.message : 'network unreachable',
        )
      }
    }

    persist(working)
  }, [persist])

  const queue = useCallback(
    (body: unknown, endpoint = '/api/incidents') => {
      const report: QueuedReport = {
        id: globalThis.crypto.randomUUID().slice(0, 8),
        endpoint,
        body,
        queuedAt: new Date().toISOString(),
        attempts: 0,
      }

      void readQueue().then((stored) => {
        persist(enqueueReport(stored, report))
        // Hand it to the browser as well, so it goes out even if this tab
        // does not survive to see the network come back.
        void requestBackgroundFlush()
      })
    },
    [persist],
  )

  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      void flush()
    }
    const goOffline = () => setOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    const interval = setInterval(() => void flush(), RETRY_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      clearInterval(interval)
    }
  }, [flush])

  return { queued, online, queue, flush }
}
