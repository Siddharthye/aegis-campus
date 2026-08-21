'use client'

import {
  ACCEPTED_IMAGE_TYPES,
  MAX_EVIDENCE_BYTES,
  dataUrlByteSize,
  fitWithinMaxEdge,
  type EvidenceItem,
} from '@/domain/evidence'

/** Re-encode quality. 0.72 keeps a readable photo well under the size cap. */
const JPEG_QUALITY = 0.72

/** Quality steps tried, in order, when the first encode is still too large. */
const FALLBACK_QUALITIES = [0.6, 0.45, 0.3] as const

/**
 * Turns a file the reporter picked into a stored-ready evidence item.
 *
 * The re-encode through a canvas is what strips EXIF: the canvas holds only
 * pixels, so the GPS coordinates, camera serial, and capture timestamp that
 * ride along in a phone photo never survive the round trip. That is a privacy
 * guarantee produced by the mechanism, not by a library we have to trust.
 *
 * Runs entirely in the browser, so an oversized photo is never uploaded at all.
 *
 * @example
 * const evidence = await prepareEvidence(file)
 * evidence?.metadataStripped // => true
 */
export async function prepareEvidence(file: File): Promise<EvidenceItem | null> {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return null

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return null

  try {
    const { width, height } = fitWithinMaxEdge(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0, width, height)

    // Always JPEG out, whatever came in — one predictable output format, and
    // the encode is what discards the original container's metadata.
    let dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    for (const quality of FALLBACK_QUALITIES) {
      if (dataUrlByteSize(dataUrl) <= MAX_EVIDENCE_BYTES) break
      dataUrl = canvas.toDataURL('image/jpeg', quality)
    }

    const byteSize = dataUrlByteSize(dataUrl)
    if (byteSize === 0 || byteSize > MAX_EVIDENCE_BYTES) return null

    return {
      id: globalThis.crypto.randomUUID().slice(0, 8),
      dataUrl,
      capturedAt: new Date().toISOString(),
      metadataStripped: true,
      byteSize,
    }
  } finally {
    bitmap.close()
  }
}
