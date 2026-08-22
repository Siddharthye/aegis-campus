'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { detectLanguage } from '@/domain/broadcast-templates'
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
 * Renders nothing on a device with no speech engine, rather than offering a
 * button that would do nothing when pressed.
 */
export function AnnounceButton({ text }: { text: string }) {
  const [available, setAvailable] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const engineRef = useRef<VernacularVoiceEngine | null>(null)

  useEffect(() => {
    if (!VernacularVoiceEngine.isAvailable()) return

    setAvailable(true)
    engineRef.current = new VernacularVoiceEngine({
      licenseKey: JANSETU_LICENCE_KEY,
      defaultLanguage: 'en',
    })

    // Speech outlives the component unless it is stopped on the way out.
    const engine = engineRef.current
    return () => engine.stop()
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

  const ready = text.trim().length > 0

  const toggle = () => {
    const engine = engineRef.current
    if (!engine) return

    if (speaking) {
      engine.stop()
      setSpeaking(false)
      return
    }

    engine.speak(text, detectLanguage(text))
    setSpeaking(true)
  }

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={toggle}
      title={speaking ? 'Stop the announcement' : 'Read this aloud over the speakers'}
      aria-label={speaking ? 'Stop the announcement' : 'Read this aloud over the speakers'}
      className={`grid size-11 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-40 sm:size-9 ${
        speaking
          ? 'border-ops-accent/50 bg-ops-accent/15 text-ops-accent'
          : 'border-ops-border text-ops-muted hover:border-ops-accent/40 hover:text-ops-text'
      }`}
    >
      {speaking ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  )
}
