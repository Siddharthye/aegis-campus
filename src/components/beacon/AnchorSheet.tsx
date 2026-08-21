'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import type { BeaconAnchor } from '@/domain/beacon'

/**
 * Deploying BEACON is literally printing this page and taping the codes up.
 *
 * Each QR encodes a deep link back into the report flow carrying the anchor
 * id, so scanning one with any phone camera opens a pre-located report — no
 * app to install, which is the only way a campus-wide rollout actually
 * happens.
 */

/** Print size. Big enough to scan from a metre away, small enough for 6-up. */
const QR_PIXELS = 220

interface AnchorSheetProps {
  anchors: BeaconAnchor[]
  /** Origin used in the encoded URL, e.g. `https://aegis.example`. */
  origin: string
}

export function AnchorSheet({ anchors, origin }: AnchorSheetProps) {
  const [codes, setCodes] = useState<Record<string, string>>({})

  const urls = useMemo(
    () =>
      Object.fromEntries(
        anchors.map((anchor) => [anchor.id, `${origin}/report?anchor=${encodeURIComponent(anchor.id)}`]),
      ),
    [anchors, origin],
  )

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      const entries = await Promise.all(
        anchors.map(async (anchor) => {
          const dataUrl = await QRCode.toDataURL(urls[anchor.id], {
            width: QR_PIXELS,
            margin: 1,
            errorCorrectionLevel: 'M',
          })
          return [anchor.id, dataUrl] as const
        }),
      )
      if (!cancelled) setCodes(Object.fromEntries(entries))
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [anchors, urls])

  if (anchors.length === 0) {
    return (
      <p className="text-[12px] text-ops-muted">
        No anchors for this building. Pick another from the list above.
      </p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
      {anchors.map((anchor) => (
        <figure
          key={anchor.id}
          className="flex flex-col items-center gap-2 rounded-lg border border-ops-border bg-white p-4 text-center print:break-inside-avoid"
        >
          {codes[anchor.id] ? (
            // eslint-disable-next-line @next/next/no-img-element -- a data: URL generated in the browser; next/image cannot optimise it.
            <img
              src={codes[anchor.id]}
              alt={`QR anchor ${anchor.id}`}
              width={QR_PIXELS}
              height={QR_PIXELS}
              className="size-40"
            />
          ) : (
            <div className="size-40 animate-pulse rounded bg-neutral-100" />
          )}

          <figcaption>
            <p className="font-mono text-[13px] font-bold text-neutral-900">{anchor.id}</p>
            <p className="mt-0.5 text-[11px] text-neutral-600">{anchor.label}</p>
            <p className="mt-1.5 text-[9px] uppercase tracking-wider text-neutral-400">
              Scan to report — AEGIS
            </p>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
