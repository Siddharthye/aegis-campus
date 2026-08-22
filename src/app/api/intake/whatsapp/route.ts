import { CAMPUS_CENTRE } from '@/data/campus'
import { nearestBuilding } from '@/domain/campus-geometry'
import {
  TWILIO_EMPTY_ACK,
  classifyMessage,
  describeMessage,
  openingSeverity,
  readWhatsAppMessage,
  type WhatsAppMessage,
} from '@/domain/whatsapp-intake'
import type { LocatedPosition } from '@/domain/types'
import { intakeReport } from '@/lib/intake-service'

export const dynamic = 'force-dynamic'

/**
 * `POST /api/intake/whatsapp` — Twilio WhatsApp webhook.
 *
 * The acquired PingBin intake module (`MOD-WHATSAPP-INTAKE-03`) landing in
 * AEGIS. It keeps their contract exactly: Twilio's form-encoded body in, an
 * empty `<Response/>` out, and their normalisation rules in between. What
 * changes is the destination — their Lambda flushes to an SQS queue, and this
 * hands the message to the same intake pipeline the in-app reporter uses, so
 * a WhatsApp message fuses, triages and dispatches like any other report.
 *
 * Two things follow from Twilio's rules and are deliberate:
 *
 * Every path answers 200 with the ACK, including failures. A non-200 makes
 * Twilio retry, and a retried emergency becomes a duplicate incident — the
 * one outcome this platform exists to prevent.
 *
 * The reply is sent whatever happens downstream, because Twilio times out at
 * 15 seconds. Their module bought that headroom with a queue; we get it by
 * answering first and letting intake finish on its own.
 */
export async function POST(request: Request) {
  try {
    const message = readWhatsAppMessage(await request.text())
    // A message with nothing in it is a delivery receipt or a stray tap.
    if (message.senderPhone && (message.bodyText || message.mediaUrl || message.latitude)) {
      await fileAsIncident(message)
    }
  } catch {
    // Swallowed on purpose: see the note above about retries.
  }

  return new Response(TWILIO_EMPTY_ACK, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  })
}

/** Turns a normalised WhatsApp message into an AEGIS incident. */
async function fileAsIncident(message: WhatsAppMessage) {
  const category = classifyMessage(message.bodyText)

  await intakeReport({
    category,
    severity: openingSeverity(category),
    title: describeMessage(message),
    description: message.bodyText || `${message.messageType} received over WhatsApp.`,
    location: locate(message),
    // The phone number is the reporter, so the control room can call back.
    reporterId: message.senderPhone || null,
  })
}

/**
 * Where the message came from.
 *
 * A shared location pin is a real GPS fix and is treated as one, named by the
 * building nearest to it. Without a pin there is genuinely no position, and
 * the honest thing is to say so rather than invent precision: the incident
 * sits at the campus centre with the confidence of a guess, and the control
 * room can see that it needs to ask where.
 */
function locate(message: WhatsAppMessage): LocatedPosition {
  if (message.latitude === null || message.longitude === null) {
    return {
      ...CAMPUS_CENTRE,
      label: 'Campus 25 · location not shared',
      method: 'gps',
      confidence: 0.1,
    }
  }

  const point = { lat: message.latitude, lng: message.longitude }
  const { building } = nearestBuilding(point.lat, point.lng)

  return {
    ...point,
    label: `${building.shortName} · WhatsApp pin`,
    method: 'gps',
    confidence: 0.4,
    buildingId: building.id,
  }
}
