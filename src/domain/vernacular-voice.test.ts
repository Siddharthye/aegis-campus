import { describe, expect, it } from 'vitest'
import { odiaToDevanagari } from './vernacular-voice'

describe('odiaToDevanagari', () => {
  it('maps Odia letters onto their Devanagari counterparts', () => {
    // Both scripts descend from Brahmi and their blocks run 0x200 apart.
    expect(odiaToDevanagari('ଅ')).toBe('अ')
    expect(odiaToDevanagari('କ')).toBe('क')
    expect(odiaToDevanagari('ଓ')).toBe('ओ')
  })

  it('carries vowel signs, virama and digits across too', () => {
    expect(odiaToDevanagari('ି')).toBe('ि')
    expect(odiaToDevanagari('୍')).toBe('्')
    expect(odiaToDevanagari('୦୯')).toBe('०९')
  })

  it('transliterates a real evacuation instruction', () => {
    const spoken = odiaToDevanagari('ଅଗ୍ନିକାଣ୍ଡ')
    expect(spoken).toBe('अग्निकाण्ड')
    // Nothing may be left in the Odia block, or the Hindi voice goes quiet.
    expect(/[଀-୿]/.test(spoken)).toBe(false)
  })

  it('leaves Latin text, digits and punctuation untouched', () => {
    // Templates name the place in English inside a translated sentence.
    expect(odiaToDevanagari('ଅଗ୍ନିକାଣ୍ଡ — Central Library, 12:45')).toBe(
      'अग्निकाण्ड — Central Library, 12:45',
    )
  })

  it('leaves Devanagari alone, so Hindi is never double-shifted', () => {
    expect(odiaToDevanagari('आग लगी है')).toBe('आग लगी है')
  })

  it('is a no-op on an empty string', () => {
    expect(odiaToDevanagari('')).toBe('')
  })
})
