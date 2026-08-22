import { describe, expect, it } from 'vitest'
import { isValidTwilioSignature, signTwilioRequest } from './twilio-signature'

/**
 * The worked example from Twilio's own security documentation. If this ever
 * fails, our signing disagrees with theirs and every real message would be
 * rejected — so it is checked against their published numbers, not ours.
 */
const TWILIO_DOC_EXAMPLE = {
  url: 'https://mycompany.com/myapp.php?foo=1&bar=2',
  authToken: '12345',
  params: {
    Digits: '1234',
    To: '+18005551212',
    From: '+14158675310',
    Caller: '+14158675310',
    CallSid: 'CA1234567890ABCDE',
  },
  signature: 'GvWf1cFY/Q7PnoempGyD5oXAezc=',
}

describe('signTwilioRequest', () => {
  it('reproduces the signature from Twilio’s documentation', () => {
    const signature = signTwilioRequest(
      TWILIO_DOC_EXAMPLE.url,
      TWILIO_DOC_EXAMPLE.params,
      TWILIO_DOC_EXAMPLE.authToken,
    )
    expect(signature).toBe(TWILIO_DOC_EXAMPLE.signature)
  })

  it('sorts parameters by name, so field order cannot change the result', () => {
    const forwards = signTwilioRequest('https://x.test/hook', { a: '1', b: '2' }, 'tok')
    const backwards = signTwilioRequest('https://x.test/hook', { b: '2', a: '1' }, 'tok')
    expect(forwards).toBe(backwards)
  })
})

describe('isValidTwilioSignature', () => {
  const base = {
    url: 'https://aegis-campus.vercel.app/api/intake/whatsapp',
    params: { From: 'whatsapp:+919812345678', Body: 'Fire in A Block' },
    authToken: 'test-auth-token',
  }
  const signature = signTwilioRequest(base.url, base.params, base.authToken)

  it('accepts a genuinely signed request', () => {
    expect(isValidTwilioSignature({ ...base, signature })).toBe(true)
  })

  it('rejects a request with no signature at all', () => {
    expect(isValidTwilioSignature({ ...base, signature: null })).toBe(false)
  })

  it('rejects a tampered body', () => {
    // The attack this exists to stop: someone replaying a real request with
    // the message swapped for one of their own.
    const tampered = { ...base.params, Body: 'Fire everywhere, evacuate campus' }
    expect(isValidTwilioSignature({ ...base, params: tampered, signature })).toBe(false)
  })

  it('rejects a signature made with the wrong token', () => {
    const forged = signTwilioRequest(base.url, base.params, 'not-the-token')
    expect(isValidTwilioSignature({ ...base, signature: forged })).toBe(false)
  })

  it('rejects a valid signature replayed against a different URL', () => {
    expect(
      isValidTwilioSignature({ ...base, url: 'https://evil.test/hook', signature }),
    ).toBe(false)
  })
})
