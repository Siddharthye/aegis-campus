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
   * Reads `text` aloud. Cancels anything already speaking, because a second
   * alert must interrupt the first rather than queue behind it.
   */
  speak(text: string, lang: LanguageCode = this.defaultLanguage): void {
    if (!VernacularVoiceEngine.isAvailable() || !text.trim()) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = VOICE_LOCALE[lang]
    // Slightly under normal pace: an emergency instruction is heard once.
    utterance.rate = 0.95
    const voice = pickVoice(VOICE_LOCALE[lang])
    if (voice) utterance.voice = voice

    window.speechSynthesis.speak(utterance)
  }

  /** Stops mid-sentence — the "all clear" for the speaker. */
  stop(): void {
    if (VernacularVoiceEngine.isAvailable()) window.speechSynthesis.cancel()
  }
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
