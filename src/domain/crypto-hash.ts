/**
 * One SHA-256 implementation, shared by every subsystem that needs to store a
 * secret without being able to read it back — SENTINEL disarm PINs and VEIL
 * case tokens.
 *
 * Web Crypto rather than `node:crypto` so the identical function runs on the
 * server and in the browser, which is what lets a client verify a token
 * locally without a round trip.
 */

/**
 * SHA-256 hex digest. Deterministic, so verification is a string comparison.
 *
 * @example
 * await sha256Hex('4102')
 * // => "35a2ff33…" (64 hex chars)
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
