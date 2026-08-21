import { describe, expect, it } from 'vitest'
import { isAllowedTarget, normaliseOrigin, parseAllowlist } from './ext-allowlist'

/**
 * These are the security tests for the `/api/ext` proxy. The proxy makes a
 * server-side request to a URL supplied by the browser, so a hole here is a
 * server-side request forgery into our own network — which is exactly what an
 * allowlist exists to prevent.
 */

describe('isAllowedTarget', () => {
  it('permits our own module ports on loopback with no configuration', () => {
    expect(isAllowedTarget('http://localhost:4101', [])).toBe(true)
    expect(isAllowedTarget('http://127.0.0.1:4102', [])).toBe(true)
    expect(isAllowedTarget('http://localhost:4104', [])).toBe(true)
  })

  it('refuses loopback ports that are not ours', () => {
    // A dev database or admin panel on another local port is not fair game.
    expect(isAllowedTarget('http://localhost:5432', [])).toBe(false)
    expect(isAllowedTarget('http://127.0.0.1:22', [])).toBe(false)
  })

  it('blocks the cloud metadata endpoint', () => {
    // The classic SSRF target: link-local metadata holds deployment credentials.
    expect(isAllowedTarget('http://169.254.169.254', [])).toBe(false)
    expect(isAllowedTarget('http://169.254.169.254/latest/meta-data/', [])).toBe(false)
  })

  it('blocks arbitrary internet hosts that were never listed', () => {
    expect(isAllowedTarget('https://example.com', [])).toBe(false)
    expect(isAllowedTarget('http://192.168.1.1', [])).toBe(false)
  })

  it('permits exactly the origins that were listed', () => {
    const allowlist = ['https://seller.example']
    expect(isAllowedTarget('https://seller.example', allowlist)).toBe(true)
    expect(isAllowedTarget('https://seller.example/api/alerts', allowlist)).toBe(true)
  })

  it('does not let a listed origin authorise its neighbours', () => {
    const allowlist = ['https://seller.example']
    expect(isAllowedTarget('https://evil.seller.example', allowlist)).toBe(false)
    expect(isAllowedTarget('https://seller.example.evil.com', allowlist)).toBe(false)
    // Same host, different scheme and port are different origins.
    expect(isAllowedTarget('http://seller.example', allowlist)).toBe(false)
    expect(isAllowedTarget('https://seller.example:8443', allowlist)).toBe(false)
  })

  it('rejects non-http schemes outright', () => {
    expect(isAllowedTarget('file:///etc/passwd', [])).toBe(false)
    expect(isAllowedTarget('ftp://example.com', [])).toBe(false)
    expect(isAllowedTarget('javascript:alert(1)', [])).toBe(false)
  })

  it('rejects unparseable input instead of failing open', () => {
    expect(isAllowedTarget('', [])).toBe(false)
    expect(isAllowedTarget('not a url', [])).toBe(false)
    expect(isAllowedTarget('//localhost:4101', [])).toBe(false)
  })
})

describe('normaliseOrigin', () => {
  it('reduces any URL to scheme, host and port', () => {
    expect(normaliseOrigin('http://localhost:4101/api/alerts?x=1')).toBe('http://localhost:4101')
    expect(normaliseOrigin('https://a.example/')).toBe('https://a.example')
  })

  it('returns null for anything that is not http(s)', () => {
    expect(normaliseOrigin('ftp://a.example')).toBeNull()
    expect(normaliseOrigin('nonsense')).toBeNull()
  })
})

describe('parseAllowlist', () => {
  it('reads a comma-separated env value', () => {
    expect(parseAllowlist('https://a.example,https://b.example')).toEqual([
      'https://a.example',
      'https://b.example',
    ])
  })

  it('tolerates whitespace and empty entries', () => {
    expect(parseAllowlist('https://a.example, ,  https://b.example ')).toEqual([
      'https://a.example',
      'https://b.example',
    ])
  })

  it('drops entries it cannot parse rather than trusting them', () => {
    expect(parseAllowlist('https://a.example,garbage,ftp://b.example')).toEqual([
      'https://a.example',
    ])
  })

  it('treats an unset variable as an empty allowlist', () => {
    expect(parseAllowlist(undefined)).toEqual([])
    expect(parseAllowlist('')).toEqual([])
  })
})
