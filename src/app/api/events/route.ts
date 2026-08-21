import { store } from '@/store'

export const dynamic = 'force-dynamic'

/** How often the event log is checked for new entries. */
const POLL_INTERVAL_MS = 500

/** Silence after which a comment frame keeps proxies from closing us. */
const HEARTBEAT_INTERVAL_MS = 15_000

/**
 * Streams are closed deliberately a little under a typical serverless function
 * limit. `EventSource` reconnects on its own and replays `Last-Event-ID`, so a
 * rotation is invisible to the client and loses no events.
 */
const STREAM_LIFETIME_MS = 50_000

/**
 * `GET /api/events?since=`
 *
 * Server-sent events carrying live incident activity: `incident.created`,
 * `incident.updated`, plus drill and sentinel events as those systems emit them.
 *
 * @example
 * const stream = new EventSource('/api/events')
 * stream.addEventListener('incident.created', (e) => console.log(JSON.parse(e.data)))
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const resumeFrom = Number(request.headers.get('last-event-id') ?? params.get('since') ?? 0)
  let cursor = Number.isFinite(resumeFrom) && resumeFrom > 0 ? resumeFrom : await store.latestEventId()

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const startedAt = Date.now()
      let lastFrameAt = Date.now()

      const close = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // Already closed by the runtime — nothing to do.
        }
      }

      const write = (frame: string) => {
        if (closed) return
        controller.enqueue(encoder.encode(frame))
        lastFrameAt = Date.now()
      }

      request.signal.addEventListener('abort', close)
      write('retry: 1000\n\n')

      while (!closed && !request.signal.aborted && Date.now() - startedAt < STREAM_LIFETIME_MS) {
        const events = await store.readEventsSince(cursor)

        for (const event of events) {
          cursor = Math.max(cursor, event.id)
          write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`)
        }

        if (Date.now() - lastFrameAt >= HEARTBEAT_INTERVAL_MS) write(': heartbeat\n\n')
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }

      close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
