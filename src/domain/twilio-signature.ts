import { createHmac } from 'node:crypto'

/**
 * Proving a webhook really came from Twilio.
 *
 * `/api/intake/whatsapp` has to be reachable by Twilio, which means it is
 * reachable by anyone — and an unauthenticated endpoint that files emergency
 * incidents is an obvious thing to abuse. Twilio signs every request with the
 * account's auth token, so checking that signature is what separates a real
 * message from anyone who found the URL.
 *
 * The scheme is Twilio's: concatenate the full request URL with every POST
 * field sorted by name, HMAC-SHA1 it with the auth token, and base64 the
 * result. Reimplemented here rather than pulling in the Twilio SDK, which is
 * a large dependency to carry for one hash.
 */

/**
 * Whether `signature` is Twilio's signature for this request.
 *
 * @example
 * isValidTwilioSignature({
 *   url: 'https://aegis-campus.vercel.app/api/intake/whatsapp',
 *   params: { From: 'whatsapp:+91900', Body: 'Fire' },
 *   signature: header,
 *   authToken: process.env.TWILIO_AUTH_TOKEN,
 * })
 */
export function isValidTwilioSignature({
  url,
  params,
  signature,
  authToken,
}: {
  url: string
  params: Record<string, string>
  signature: string | null
  authToken: string
}): boolean {
  if (!signature) return false

  const expected = signTwilioRequest(url, params, authToken)

  // Length is compared first because timingSafeEqual throws on a mismatch,
  // and the length of a signature is not a secret.
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false

  return timingSafeEquals(a, b)
}

/** The signature Twilio would send for this URL and these fields. */
export function signTwilioRequest(
  url: string,
  params: Record<string, string>,
  authToken: string,
): string {
  // Twilio's rule: the URL, then every parameter appended as name + value,
  // in ascending order of name.
  const payload = Object.keys(params)
    .sort()
    .reduce((accumulated, key) => accumulated + key + params[key], url)

  return createHmac('sha1', authToken).update(Buffer.from(payload, 'utf8')).digest('base64')
}

/** Constant-time comparison, so a wrong guess leaks nothing by how long it took. */
function timingSafeEquals(a: Buffer, b: Buffer): boolean {
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i]
  return difference === 0
}
