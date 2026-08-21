import Link from 'next/link'
import type { IntegrationKind } from '@/integrations/registry'

export const metadata = { title: 'WANTED — integrations AEGIS will buy' }

interface WantedGap {
  title: string
  /** The named slot it mounts into — already built and visible in the product. */
  slot: IntegrationKind
  /** Where in AEGIS it appears the moment it is registered. */
  mountsAt: string
  why: string
  /** The smallest thing that would make it integrable in one config entry. */
  minimumViable: string
}

/**
 * Six real gaps, deliberately not built.
 *
 * Publishing them is the point: a rival team reading this before the floor
 * opens knows exactly what we will pay for, and — more usefully — knows the
 * shape that makes it buyable. Every gap below already has a slot rendered in
 * the running product, so integrating one is a config entry, not an afternoon.
 */
const WANTED: readonly WantedGap[] = [
  {
    title: 'SMS / WhatsApp / IVR emergency intake',
    slot: 'intake-channel',
    mountsAt: '/report — "Other ways to report"',
    why: 'A feature phone with no data, or a visitor who will never install an app, still needs a way in. This is the single biggest reach multiplier we do not have.',
    minimumViable: 'A webhook that POSTs { text, from, receivedAt } to a URL we configure.',
  },
  {
    title: 'CCTV hazard or crowd-density detection',
    slot: 'sensor-feed',
    mountsAt: '/control — sensor feed panel',
    why: 'Every incident in AEGIS today starts with a human noticing. A camera that raises an incident before anyone reports it closes the last gap in detection time.',
    minimumViable: 'Any endpoint that emits { cameraId, hazard, confidence, at } over SSE or a webhook.',
  },
  {
    title: 'Campus loudspeaker / PA broadcast',
    slot: 'alert-channel',
    mountsAt: '/control — broadcast channel',
    why: 'Our broadcasts reach phones. A fire alarm needs to reach a corridor where nobody is looking at a phone.',
    minimumViable: 'POST { message, zone } that plays audio, plus a delivery receipt.',
  },
  {
    title: 'Multilingual voice-to-incident intake',
    slot: 'intake-channel',
    mountsAt: '/report — "Other ways to report"',
    why: 'We ship authored Hindi and Odia broadcast templates, but reporting is still typed English. Speech in the reporter’s own language is the missing half.',
    minimumViable: 'Audio in, { transcript, language, category? } out. Accuracy matters more than latency.',
  },
  {
    title: 'BLE panic button / wearable',
    slot: 'sensor-feed',
    mountsAt: '/control — sensor feed panel',
    why: 'SENTINEL needs a phone in hand. A pendant or keyring works when a phone is in a bag, or taken.',
    minimumViable: 'A bridge that turns a button press into POST /api/sentinel/arm with a location.',
  },
  {
    title: 'Vehicle routing with real road ETA',
    slot: 'custom',
    mountsAt: '/control — dispatch recommendations',
    why: 'Our ETA assumes someone walks in a straight line. An ambulance follows roads, gates and one-way campus loops.',
    minimumViable: 'GET route(from, to) → { distanceM, etaSeconds, path[] }. Offline routing preferred.',
  },
]

/**
 * The WANTED board — published so other teams can build against it, and so a
 * panel can see we know precisely where our own product stops.
 */
export default function WantedPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="ops-label text-ops-accent">AEGIS · HACQUIRE 2026</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance">
        Six things we will buy.
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ops-muted">
        These are real gaps in AEGIS that we deliberately did not build. Each one already has a
        mounting point rendered in the running product, so integrating it is one entry in{' '}
        <code className="font-mono text-[13px] text-ops-faint">integrations.config.ts</code> and
        one environment variable — not an afternoon of glue.
      </p>
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ops-faint">
        We buy on three criteria, in order: it runs from a fresh clone in front of us, it has a
        README, and it needs no key we do not already have. Bring it running.
      </p>

      <ul className="mt-10 flex flex-col gap-4">
        {WANTED.map((gap, index) => (
          <li
            key={gap.title}
            className="rounded-lg border border-ops-border bg-ops-panel p-5"
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="ops-label text-ops-faint">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="text-[16px] font-semibold text-ops-text">{gap.title}</h2>
              <span className="ops-label ml-auto rounded border border-ops-accent/30 px-2 py-0.5 text-ops-accent">
                {gap.slot}
              </span>
            </div>

            <p className="mt-2.5 text-[13px] leading-relaxed text-ops-muted">{gap.why}</p>

            <dl className="mt-3 grid gap-2 border-t border-ops-border pt-3 sm:grid-cols-2">
              <div>
                <dt className="ops-label text-ops-faint">Mounts at</dt>
                <dd className="mt-0.5 font-mono text-[11px] text-ops-muted">{gap.mountsAt}</dd>
              </div>
              <div>
                <dt className="ops-label text-ops-faint">Minimum viable contract</dt>
                <dd className="mt-0.5 text-[11px] leading-relaxed text-ops-muted">
                  {gap.minimumViable}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <section className="mt-10 rounded-lg border border-ops-accent/30 bg-ops-accent/5 p-5">
        <p className="ops-label text-ops-accent">What we are selling</p>
        <p className="mt-2 text-[13px] leading-relaxed text-ops-muted">
          SIREN (geofenced alerts), ATLAS (live incident map + triage engine), and FUSION
          (duplicate report fusion). Each ships a REST + SSE API, an iframe widget, a React
          component, and a framework-free JS client — so any stack integrates in about ten
          minutes.
        </p>
        <Link
          href="/"
          className="ops-label mt-3 inline-block rounded-md border border-ops-accent/40 bg-ops-accent/10 px-3 py-1.5 text-ops-accent"
        >
          See the product →
        </Link>
      </section>
    </main>
  )
}
