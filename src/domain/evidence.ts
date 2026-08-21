/**
 * Evidence attached to a report — a photo of the smoke, the broken railing,
 * the blocked fire exit.
 *
 * Two decisions shape this module. First, images are re-encoded in the browser
 * before they are ever uploaded, which downscales them *and* drops EXIF as a
 * side effect — a phone photo carries the GPS coordinates and timestamp of
 * whoever took it, and someone reporting harassment anonymously must not have
 * their home address travel with the evidence. Second, we tell the reporter
 * that we did it, because silently discarding metadata is indistinguishable
 * from silently keeping it.
 */

/** Formats a phone camera actually produces. Anything else is refused. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Longest edge after downscaling. Enough to read a sign, small enough to send. */
export const MAX_IMAGE_EDGE_PX = 1280

/** Ceiling on a single stored attachment, after re-encoding. */
export const MAX_EVIDENCE_BYTES = 400_000

/** Attachments per incident. A report is evidence, not an album. */
export const MAX_EVIDENCE_ITEMS = 3

export interface EvidenceItem {
  id: string
  /** Re-encoded image as a `data:` URL. No external blob store to configure. */
  dataUrl: string
  capturedAt: string
  /** Always true for anything we accepted — recorded so the UI can say so. */
  metadataStripped: boolean
  /** Bytes after re-encoding, for the control room to show honestly. */
  byteSize: number
}

/**
 * Approximate byte length of a `data:` URL payload without decoding it.
 *
 * Base64 carries 3 bytes per 4 characters, minus any padding.
 *
 * @example
 * dataUrlByteSize('data:image/jpeg;base64,////') // => 3
 */
export function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  if (base64.length === 0) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

/**
 * Target dimensions that fit inside {@link MAX_IMAGE_EDGE_PX} while preserving
 * aspect ratio. Images already small enough are left alone rather than
 * upscaled into a blurrier version of themselves.
 *
 * @example
 * fitWithinMaxEdge(4000, 3000) // => { width: 1280, height: 960 }
 * fitWithinMaxEdge(800, 600)   // => { width: 800, height: 600 }
 */
export function fitWithinMaxEdge(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE_PX,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }

  const scale = maxEdge / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Whether a `data:` URL is something we are willing to store: an accepted
 * image type, non-empty, and inside the size ceiling.
 *
 * @example
 * isAcceptableEvidence('data:image/jpeg;base64,/9j/4AAQ') // => true
 * isAcceptableEvidence('data:text/html;base64,PHNjcmlwdD4=') // => false
 */
export function isAcceptableEvidence(dataUrl: string): boolean {
  const declaredType = dataUrl.match(/^data:([^;,]+)[;,]/)?.[1]
  if (!declaredType) return false
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(declaredType)) return false

  const size = dataUrlByteSize(dataUrl)
  return size > 0 && size <= MAX_EVIDENCE_BYTES
}

/**
 * Human-readable file size for the control room.
 *
 * @example
 * describeByteSize(184_320) // => '180 KB'
 */
export function describeByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}
