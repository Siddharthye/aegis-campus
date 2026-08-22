import type { IncidentCategory, Severity } from './types'

/**
 * WhatsApp intake — acquired from PingBin (`MOD-WHATSAPP-INTAKE-03`).
 *
 * Their module is an AWS Lambda that answers a Twilio webhook and pushes a
 * normalised message onto an SQS queue. AEGIS has no Lambda and no queue, so
 * what we integrate is the part that carries the value: their wire contract
 * and their normalisation rules, reimplemented here against the same field
 * names, the same message-type precedence, and the same payload shape.
 *
 * Their `handler.py` is vendored in `vendor/whatsapp-intake/` so the contract
 * this follows can be read next to the code that implements it.
 *
 * Everything in this file is pure: parsing and classification only. Turning a
 * message into an incident is the route's job.
 */

/** Twilio expects this exact body, and nothing else, within 15 seconds. */
export const TWILIO_EMPTY_ACK =
  '<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>'

/** What kind of thing the sender actually sent. */
export type WhatsAppMessageType = 'photo' | 'location' | 'text'

/** PingBin's normalised SQS payload, field for field. */
export interface WhatsAppMessage {
  senderPhone: string
  messageType: WhatsAppMessageType
  mediaUrl: string | null
  latitude: number | null
  longitude: number | null
  bodyText: string
  receivedAt: number
  messageSid: string
}

/**
 * Normalises a Twilio `application/x-www-form-urlencoded` webhook body.
 *
 * Message-type precedence is theirs and matters: media wins over a location
 * pin, which wins over text — a photo sent with a caption is a photo, because
 * the picture is the report and the caption is a note on it.
 *
 * @example
 * readWhatsAppMessage('From=whatsapp%3A%2B919084686979&Body=Fire+in+B+Block')
 * // => { senderPhone: '+919084686979', messageType: 'text', ... }
 */
export function readWhatsAppMessage(body: string, now = Date.now()): WhatsAppMessage {
  const fields = new URLSearchParams(body)
  const first = (key: string) => fields.get(key) ?? ''

  const mediaCount = Number.parseInt(first('NumMedia') || '0', 10) || 0
  const mediaUrl = mediaCount > 0 ? fields.get('MediaUrl0') : null
  const latitude = first('Latitude')
  const longitude = first('Longitude')

  return {
    // Twilio prefixes the sender with the channel; the number is the identity.
    senderPhone: first('From').replace('whatsapp:', '').trim(),
    messageType: mediaUrl ? 'photo' : latitude && longitude ? 'location' : 'text',
    mediaUrl: mediaUrl || null,
    latitude: latitude ? Number.parseFloat(latitude) : null,
    longitude: longitude ? Number.parseFloat(longitude) : null,
    bodyText: first('Body').trim(),
    receivedAt: Math.floor(now / 1000),
    messageSid: first('MessageSid'),
  }
}

/**
 * Words that put a message in a category, most urgent first.
 *
 * A WhatsApp message has no category picker, so the category has to come from
 * what the sender wrote. Order matters: "fire in the medical centre" is a
 * fire, not a medical call.
 */
const CATEGORY_WORDS: ReadonlyArray<readonly [IncidentCategory, readonly string[]]> = [
  ['fire', ['fire', 'smoke', 'burning', 'flame', 'blaze']],
  ['medical', ['medical', 'injured', 'hurt', 'bleeding', 'unconscious', 'collapsed', 'ambulance']],
  ['harassment', ['harass', 'following', 'followed', 'stalking', 'threat', 'unsafe', 'creep']],
  ['security', ['theft', 'stolen', 'intruder', 'suspicious', 'break-in', 'fight']],
  ['infrastructure', ['leak', 'flood', 'power', 'outage', 'broken', 'collapse', 'lift stuck']],
]

/** The severity a category opens at before triage revises it. */
const OPENING_SEVERITY: Record<IncidentCategory, Severity> = {
  fire: 'P0',
  medical: 'P1',
  harassment: 'P1',
  security: 'P2',
  infrastructure: 'P2',
  other: 'P3',
}

/**
 * Reads a category out of the message text.
 *
 * Falls back to `other`, which is the honest answer — AEGIS's triage engine
 * sees the same text afterwards and is better at this than a word list.
 *
 * @example
 * classifyMessage('smoke on the third floor') // => 'fire'
 */
export function classifyMessage(text: string): IncidentCategory {
  const haystack = text.toLowerCase()
  for (const [category, words] of CATEGORY_WORDS) {
    if (words.some((word) => haystack.includes(word))) return category
  }
  return 'other'
}

/** The severity a message opens at, derived from its category. */
export function openingSeverity(category: IncidentCategory): Severity {
  return OPENING_SEVERITY[category]
}

/**
 * A one-line title for the control-room queue.
 *
 * A photo with no caption still has to say something in a list of incidents,
 * so the message type supplies the words when the sender did not.
 */
export function describeMessage(message: WhatsAppMessage): string {
  if (message.bodyText) {
    const trimmed = message.bodyText.replace(/\s+/g, ' ')
    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed
  }
  return message.messageType === 'photo'
    ? 'Photo sent over WhatsApp'
    : message.messageType === 'location'
      ? 'Location pin sent over WhatsApp'
      : 'Empty WhatsApp message'
}
