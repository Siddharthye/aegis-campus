'use client'

import { useState } from 'react'
import { describeByteSize, type EvidenceItem } from '@/domain/evidence'

/**
 * Reporter-supplied photos, for the dispatcher.
 *
 * Evidence changes decisions — a photo of actual flames is not the same call
 * as "smells smoky" — so it sits with the incident rather than behind a link.
 * Clicking enlarges in place; there is no separate viewer to get lost in
 * during an emergency.
 */
export function EvidenceStrip({ evidence }: { evidence: readonly EvidenceItem[] }) {
  const [enlargedId, setEnlargedId] = useState<string | null>(null)
  if (evidence.length === 0) return null

  return (
    <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
      <div className="flex items-center gap-2">
        <p className="ops-label text-ops-muted">
          Evidence · {evidence.length} photo{evidence.length === 1 ? '' : 's'}
        </p>
        <span className="ops-label ml-auto text-emerald-400">Metadata stripped</span>
      </div>

      <ul className="mt-2.5 flex flex-wrap gap-2">
        {evidence.map((item) => {
          const enlarged = item.id === enlargedId

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setEnlargedId(enlarged ? null : item.id)}
                aria-expanded={enlarged}
                className="block overflow-hidden rounded-md border border-ops-border transition-colors hover:border-ops-accent/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a stored data: URL; next/image cannot optimise it. */}
                <img
                  src={item.dataUrl}
                  alt="Reporter-supplied evidence"
                  className={`object-cover transition-all ${enlarged ? 'max-h-96 w-auto' : 'size-24'}`}
                />
              </button>
              <span className="ops-label mt-0.5 block text-ops-faint">
                {describeByteSize(item.byteSize)}
              </span>
            </li>
          )
        })}
      </ul>

      <p className="mt-2 text-[11px] leading-relaxed text-ops-faint">
        Re-encoded on the reporter&apos;s device before upload, so no GPS or camera metadata
        reached this system. Treat the image itself as the only evidence.
      </p>
    </section>
  )
}
