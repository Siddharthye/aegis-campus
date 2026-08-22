import type { LanguageCode } from './broadcast-templates'

/**
 * Vernacular voice announcements — acquired from JanSetu.
 *
 * The asset is a speech engine that reads a message aloud in the language it
 * was written in, so a campus alert reaches the people who cannot read the
 * screen it is on: support staff, contractors, visitors, anyone whose phone
 * is in a pocket.
 *
 * Their `@jansetu/vernacular-voice-sdk` package is not published to npm, so
 * this implements the interface their integration guide documents —
 * `new VernacularVoiceEngine({ licenseKey, defaultLanguage })` and
 * `.speak(text, lang)` — against the speech engine every browser already
 * ships. Swapping in their package later is a one-line change at the
 * construction site, because the surface is theirs.
 *
 * Speaking locally is also the right call for this product: no request
 * leaves the device, so an announcement still works with the wifi off.
 */

/** Their licence key, from the activation hub. Carried for provenance. */
export const JANSETU_LICENCE_KEY = 'JS-VOICE-ACTIVE-2026-PROD-LIVE'

/**
 * BCP-47 tags for the languages AEGIS broadcasts in.
 *
 * A voice has to be asked for by locale, not by our internal code, and the
 * Indian English tag matters: `en-IN` reads "Block C" and Indian place names
 * far more naturally than the US default.
 */
const VOICE_LOCALE: Record<LanguageCode, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  or: 'or-IN',
}

export interface VernacularVoiceOptions {
  licenseKey: string
  defaultLanguage: LanguageCode
}

/**
 * Their documented engine, implemented locally.
 *
 * @example
 * const voice = new VernacularVoiceEngine({
 *   licenseKey: JANSETU_LICENCE_KEY,
 *   defaultLanguage: 'hi',
 * })
 * voice.speak('आपकी छात्रवृत्ति स्वीकृत हो गई है।', 'hi')
 */
export class VernacularVoiceEngine {
  private readonly defaultLanguage: LanguageCode

  constructor(options: VernacularVoiceOptions) {
    this.defaultLanguage = options.defaultLanguage
  }

  /** Whether this device can speak at all. */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  /**
   * Whether this device has a voice that can actually read this language.
   *
   * Worth asking before offering the control. Odia in particular ships on
   * almost no desktop: asked to read Odia script with an English voice, the
   * engine produces silence, and a dispatcher who pressed the button would
   * believe the announcement went out. Better to say the language is
   * unavailable than to fail quietly.
   */
  static canSpeak(lang: LanguageCode): boolean {
    if (!VernacularVoiceEngine.isAvailable()) return false
    if (pickVoice(VOICE_LOCALE[lang]) !== null) return true
    // Odia can still be spoken through the Hindi voice — see renderFor.
    return lang === 'or' && pickVoice(VOICE_LOCALE.hi) !== null
  }

  /** The subset of broadcast languages this device can read aloud. */
  static spokenLanguages(): LanguageCode[] {
    return (Object.keys(VOICE_LOCALE) as LanguageCode[]).filter((lang) =>
      VernacularVoiceEngine.canSpeak(lang),
    )
  }

  /**
   * Reads `text` aloud. Cancels anything already speaking, because a second
   * alert must interrupt the first rather than queue behind it.
   */
  speak(text: string, lang: LanguageCode = this.defaultLanguage): void {
    if (!VernacularVoiceEngine.isAvailable() || !text.trim()) return

    window.speechSynthesis.cancel()

    const { spoken, locale } = renderFor(text, lang)
    const utterance = new SpeechSynthesisUtterance(spoken)
    utterance.lang = locale
    // Slightly under normal pace: an emergency instruction is heard once.
    utterance.rate = 0.95
    const voice = pickVoice(locale)
    if (voice) {
      try {
        utterance.voice = voice
      } catch {
        // Naming a specific voice is an optimisation, not the point. If the
        // engine rejects it, the browser's default still says the words —
        // and an announcement in the wrong accent beats silence.
      }
    }

    window.speechSynthesis.speak(utterance)
  }

  /** Stops mid-sentence — the "all clear" for the speaker. */
  stop(): void {
    if (VernacularVoiceEngine.isAvailable()) window.speechSynthesis.cancel()
  }
}

/**
 * Odia and Devanagari both descend from Brahmi, and their Unicode blocks run
 * exactly 0x200 apart — ଅ U+0B05 to अ U+0905, କ U+0B15 to क U+0915, and so on
 * through the consonants, vowel signs, virama and digits.
 */
const ODIA_TO_DEVANAGARI_OFFSET = 0x200
const ODIA_BLOCK_START = 0x0b01
const ODIA_BLOCK_END = 0x0b7c

/** Rewrites Odia script as Devanagari, leaving everything else untouched. */
export function odiaToDevanagari(text: string): string {
  return [...text]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0
      return code >= ODIA_BLOCK_START && code <= ODIA_BLOCK_END
        ? String.fromCodePoint(code - ODIA_TO_DEVANAGARI_OFFSET)
        : character
    })
    .join('')
}

/**
 * What to actually utter, and in which locale.
 *
 * Odia text normally comes back in silence or in a Hindi accent, because no
 * desktop ships an Odia voice. Rather than give up, the script is rewritten
 * into Devanagari and handed to the Hindi voice: the two share enough
 * phonology that the words come out as Odia words, in a Hindi accent, which
 * a listener understands — where the alternative was hearing nothing.
 *
 * It is an approximation and only used when there is no Odia voice. Install
 * one and this path is skipped entirely.
 */
function renderFor(text: string, lang: LanguageCode): { spoken: string; locale: string } {
  const native = VOICE_LOCALE[lang]

  if (lang === 'or' && !pickVoice(native) && pickVoice(VOICE_LOCALE.hi)) {
    return { spoken: odiaToDevanagari(text), locale: VOICE_LOCALE.hi }
  }

  return { spoken: text, locale: native }
}

/**
 * The best installed voice for a locale.
 *
 * Exact match first, then any voice for the same language, then nothing —
 * in which case the browser picks, which is still better than silence. Odia
 * in particular ships on very few devices, and an alert that refuses to
 * speak because the accent is wrong helps nobody.
 */
function pickVoice(locale: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  const language = locale.split('-')[0]
  return (
    voices.find((candidate) => candidate.lang === locale) ??
    voices.find((candidate) => candidate.lang.startsWith(language)) ??
    null
  )
}
