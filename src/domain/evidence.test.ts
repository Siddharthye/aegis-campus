import { describe, expect, it } from 'vitest'
import {
  MAX_EVIDENCE_BYTES,
  dataUrlByteSize,
  describeByteSize,
  fitWithinMaxEdge,
  isAcceptableEvidence,
} from './evidence'

/** A base64 payload of roughly `bytes` length, as a data URL of the given type. */
const dataUrl = (type: string, bytes: number) =>
  `data:${type};base64,${'A'.repeat(Math.ceil((bytes * 4) / 3))}`

describe('fitWithinMaxEdge', () => {
  it('scales a large photo down to the long edge, preserving aspect ratio', () => {
    expect(fitWithinMaxEdge(4000, 3000)).toEqual({ width: 1280, height: 960 })
  })

  it('handles portrait as well as landscape', () => {
    expect(fitWithinMaxEdge(3000, 4000)).toEqual({ width: 960, height: 1280 })
  })

  it('leaves an already-small image alone rather than upscaling it', () => {
    expect(fitWithinMaxEdge(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('respects an explicit max edge', () => {
    expect(fitWithinMaxEdge(1000, 500, 100)).toEqual({ width: 100, height: 50 })
  })
})

describe('dataUrlByteSize', () => {
  it('decodes the payload length without decoding the payload', () => {
    // "AAAA" is 4 base64 chars => 3 bytes.
    expect(dataUrlByteSize('data:image/jpeg;base64,AAAA')).toBe(3)
  })

  it('accounts for padding', () => {
    expect(dataUrlByteSize('data:image/jpeg;base64,AAA=')).toBe(2)
    expect(dataUrlByteSize('data:image/jpeg;base64,AA==')).toBe(1)
  })

  it('treats an empty payload as zero bytes', () => {
    expect(dataUrlByteSize('data:image/jpeg;base64,')).toBe(0)
  })
})

describe('isAcceptableEvidence', () => {
  it('accepts the image types a phone camera produces', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(isAcceptableEvidence(dataUrl(type, 1000))).toBe(true)
    }
  })

  it('refuses a non-image payload dressed up as an attachment', () => {
    // The reason the server re-checks rather than trusting the browser.
    expect(isAcceptableEvidence(dataUrl('text/html', 100))).toBe(false)
    expect(isAcceptableEvidence(dataUrl('application/javascript', 100))).toBe(false)
    expect(isAcceptableEvidence(dataUrl('image/svg+xml', 100))).toBe(false)
  })

  it('refuses anything past the size ceiling', () => {
    expect(isAcceptableEvidence(dataUrl('image/jpeg', MAX_EVIDENCE_BYTES + 5_000))).toBe(false)
  })

  it('refuses an empty or malformed data URL', () => {
    expect(isAcceptableEvidence('data:image/jpeg;base64,')).toBe(false)
    expect(isAcceptableEvidence('https://example.com/photo.jpg')).toBe(false)
    expect(isAcceptableEvidence('')).toBe(false)
  })
})

describe('describeByteSize', () => {
  it('reads in bytes below a kilobyte and KB above', () => {
    expect(describeByteSize(512)).toBe('512 B')
    expect(describeByteSize(184_320)).toBe('180 KB')
  })
})
