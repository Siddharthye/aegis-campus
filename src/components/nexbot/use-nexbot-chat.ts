'use client'

import { useRef, useState } from 'react'

/** What one `/api/assist` answer actually read — shown as proof of work. */
export interface AssistSources {
  incidents: number
  responders: number
  tookMs: number
}

export interface ChatMessage {
  id: number
  role: 'user' | 'bot'
  text: string
  navigate?: string
  pending?: boolean
  sources?: AssistSources
}

/**
 * The NEXBOT conversation, shared by the floating chat sheet and the full
 * `/ai` console so both surfaces behave identically: optimistic user bubble,
 * a pending bot bubble, then the answer with its sources filled in.
 */
export function useNexbotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)

  const ask = async (question: string): Promise<void> => {
    const text = question.trim()
    if (!text || busy) return

    setBusy(true)
    const pendingId = nextId.current + 1
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: 'user', text },
      { id: nextId.current++, role: 'bot', text: '…', pending: true },
    ])

    try {
      const response = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const answer = (await response.json()) as {
        text: string
        navigate?: string
        sources?: AssistSources
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? {
                ...message,
                text: answer.text,
                navigate: answer.navigate,
                sources: answer.sources,
                pending: false,
              }
            : message,
        ),
      )
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? { ...message, text: 'NEXBOT is unreachable — is the server running?', pending: false }
            : message,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return { messages, busy, ask }
}
