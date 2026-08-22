'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BROADCAST_LANGUAGES, detectLanguage } from '@/domain/broadcast-templates'
import { JANSETU_LICENCE_KEY, VernacularVoiceEngine } from '@/domain/vernacular-voice'

/**
 * Reads the composed broadcast aloud — the acquired JanSetu voice engine,
 * mounted where a dispatcher already is.
 *
 * The language is not a setting to get wrong under pressure: it is read from
 * the message itself, so loading the Hindi template and pressing this speaks
 * Hindi. That works because the broadcast templates are already authored in
 * English, Hindi and Odia.
 *
 * When the device has no voice for that language the control says so rather
 * than failing quietly. Odia is the real case: it ships on almost no desktop,
 * and a dispatcher who pressed a dead button would believe the announcement
 * had gone out over the speakers when nothing had been said at all.
 */
export function AnnounceButton({ text }: { text: string }) {
  const [available, setAvailable] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  /* Voices load asynchronously and are often empty on first paint, so this
     is recomputed when the engine reports them. */
  const [spoken, setSpoken] = useState<string[]>([])
  const engineRef = useRef<VernacularVoiceEngine | null>(null)

  useEffect(() => {
    if (!VernacularVoiceEngine.isAvailable()) return

    setAvailable(true)
    engineRef.current = new VernacularVoiceEngine({
      licenseKey: JANSETU_LICENCE_KEY,
      defaultLanguage: 'en',
    })

    const refresh = () => setSpoken(VernacularVoiceEngine.spokenLanguages())
    refresh()
    window.speechSynthesis.addEventListener('voiceschanged', refresh)

    const engine = engineRef.current
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', refresh)
      // Speech outlives the component unless it is stopped on the way out.
      engine.stop()
    }
  }, [])

  // Track the engine finishing so the button returns to its resting state.
  useEffect(() => {
    if (!speaking) return
    const poll = setInterval(() => {
      if (!window.speechSynthesis.speaking) setSpeaking(false)
    }, 400)
    return () => clearInterval(poll)
  }, [speaking])

  if (!available) return null

  const language = detectLanguage(text)
  const languageName =
    BROADCAST_LANGUAGES.find((entry) => entry.code === language)?.label ?? language
  const hasVoice = spoken.includes(language)
  const ready = text.trim().length > 0 && hasVoice

  const label = !text.trim()
    ? 'Nothing to announce yet'
    : !hasVoice
      ? `No ${languageName} voice on this device — install one to announce in ${languageName}`
      : speaking
        ? 'Stop the announcement'
        : `Read this aloud in ${languageName}`

  const toggle = () => {
    const engine = engineRef.current
    if (!engine) return

    if (speaking) {
      engine.stop()
      setSpeaking(false)
      return
    }

    engine.speak(text, language)
    setSpeaking(true)
  }

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={toggle}
      title={label}
      aria-label={label}
      className={`grid size-11 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-40 sm:size-9 ${
        speaking
          ? 'border-ops-accent/50 bg-ops-accent/15 text-ops-accent'
          : 'border-ops-border text-ops-muted hover:border-ops-accent/40 hover:text-ops-text'
      }`}
    >
      {speaking || !hasVoice ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  )
}
