/**
 * The offline report queue.
 *
 * Campus dead zones are real — stairwells, basements, the back of the
 * chemistry block — and they are disproportionately where emergencies happen.
 * A report form that fails when the signal drops is a report form that fails
 * exactly when it matters, so a submission that cannot reach the server is
 * held on the device and flushed the moment connectivity returns.
 *
 * Pure queue algebra only: no storage, no fetch, no timers. The hook at the
 * edge owns those, which is what makes every rule below testable.
 */

/** One report waiting to be sent, with the payload exactly as it will POST. */
export interface QueuedReport {
  id: string
  /** The `POST /api/incidents` body, held verbatim. */
  body: unknown
  queuedAt: string
  /** Delivery attempts so far, used to stop hammering a dead network. */
  attempts: number
  /** Set when the last attempt failed, for honest UI. */
  lastError?: string
}

/** Reports older than this are dropped — a stale emergency is not actionable. */
export const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000

/** Attempts before a report is treated as undeliverable rather than pending. */
export const MAX_DELIVERY_ATTEMPTS = 8

/** Ceiling on queued reports, so a long outage cannot exhaust device storage. */
export const MAX_QUEUE_LENGTH = 25

/**
 * Adds a report to the queue, oldest first, trimming to the length cap.
 *
 * When the cap is hit the *oldest* entry is dropped rather than the newest,
 * because during an unfolding incident the most recent report is the one that
 * still describes reality.
 *
 * @example
 * enqueueReport([], { id: 'q1', body, queuedAt: now, attempts: 0 }).length // => 1
 */
export function enqueueReport(
  queue: readonly QueuedReport[],
  report: QueuedReport,
): QueuedReport[] {
  return [...queue, report].slice(-MAX_QUEUE_LENGTH)
}

/**
 * Removes a report — used after a successful delivery.
 *
 * @example
 * dropReport([{ id: 'q1' } as QueuedReport], 'q1') // => []
 */
export function dropReport(queue: readonly QueuedReport[], id: string): QueuedReport[] {
  return queue.filter((report) => report.id !== id)
}

/**
 * Records a failed delivery attempt against one report.
 *
 * @example
 * markAttempt(queue, 'q1', 'network unreachable')[0].attempts // => 1
 */
export function markAttempt(
  queue: readonly QueuedReport[],
  id: string,
  error: string,
): QueuedReport[] {
  return queue.map((report) =>
    report.id === id ? { ...report, attempts: report.attempts + 1, lastError: error } : report,
  )
}

/**
 * Drops reports that are too old or have failed too often, so the queue can
 * never grow into a permanently retrying backlog.
 *
 * @example
 * pruneQueue(queue, new Date()).length
 */
export function pruneQueue(queue: readonly QueuedReport[], now: Date): QueuedReport[] {
  return queue.filter((report) => {
    const age = now.getTime() - new Date(report.queuedAt).getTime()
    return age <= MAX_QUEUE_AGE_MS && report.attempts < MAX_DELIVERY_ATTEMPTS
  })
}

/**
 * Reports still worth trying to deliver right now.
 *
 * @example
 * pendingReports(queue).length // => 2
 */
export function pendingReports(queue: readonly QueuedReport[]): QueuedReport[] {
  return queue.filter((report) => report.attempts < MAX_DELIVERY_ATTEMPTS)
}

/**
 * Parses a persisted queue, discarding anything that is not a well-formed
 * entry. Corrupt storage must degrade to an empty queue, never to a crash on
 * the report screen.
 *
 * @example
 * parseQueue('not json') // => []
 */
export function parseQueue(raw: string | null): QueuedReport[] {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((entry): entry is QueuedReport => {
      if (typeof entry !== 'object' || entry === null) return false
      const candidate = entry as Partial<QueuedReport>
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.queuedAt === 'string' &&
        typeof candidate.attempts === 'number' &&
        'body' in candidate
      )
    })
  } catch {
    return []
  }
}
