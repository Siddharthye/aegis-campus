import { describe, expect, it } from 'vitest'
import {
  TWILIO_EMPTY_ACK,
  classifyMessage,
  describeMessage,
  openingSeverity,
  readWhatsAppMessage,
} from './whatsapp-intake'

/** The exact body PingBin's README documents, so their contract is the test. */
const THEIR_EXAMPLE =
  'From=whatsapp%3A%2B919084686979&To=whatsapp%3A%2B14155238886&NumMedia=1' +
  '&MediaUrl0=https%3A%2F%2Fapi.twilio.com%2Fmedia%2F123&MessageSid=SM123'

describe('readWhatsAppMessage — the acquired contract', () => {
  it('normalises the payload their README specifies', () => {
    const message = readWhatsAppMessage(THEIR_EXAMPLE, 1_755_787_000_000)

    expect(message).toEqual({
      senderPhone: '+919084686979',
      messageType: 'photo',
      mediaUrl: 'https://api.twilio.com/media/123',
      latitude: null,
      longitude: null,
      bodyText: '',
      receivedAt: 1_755_787_000,
      messageSid: 'SM123',
    })
  })

  it('strips the channel prefix so the number is the identity', () => {
    const message = readWhatsAppMessage('From=whatsapp%3A%2B919084686979')
    expect(message.senderPhone).toBe('+919084686979')
  })

  it('reads a shared location pin as coordinates', () => {
    const message = readWhatsAppMessage('From=whatsapp%3A%2B91900&Latitude=20.3549&Longitude=85.8197')
    expect(message.messageType).toBe('location')
    expect(message.latitude).toBeCloseTo(20.3549, 4)
    expect(message.longitude).toBeCloseTo(85.8197, 4)
  })

  it('treats a captioned photo as a photo', () => {
    // Their precedence: media beats a pin, a pin beats text. The picture is
    // the report; the caption is a note on it.
    const message = readWhatsAppMessage('NumMedia=1&MediaUrl0=https%3A%2F%2Fx&Body=fire+here')
    expect(message.messageType).toBe('photo')
    expect(message.bodyText).toBe('fire here')
  })

  it('falls back to text when nothing else was sent', () => {
    expect(readWhatsAppMessage('Body=someone+is+following+me').messageType).toBe('text')
  })

  it('survives a body with no fields at all', () => {
    const message = readWhatsAppMessage('')
    expect(message.senderPhone).toBe('')
    expect(message.messageType).toBe('text')
  })
})

describe('classifyMessage', () => {
  it('reads the category out of what the sender wrote', () => {
    expect(classifyMessage('smoke on the third floor')).toBe('fire')
    expect(classifyMessage('someone collapsed near the library')).toBe('medical')
    expect(classifyMessage('a man is following me')).toBe('harassment')
    expect(classifyMessage('my laptop was stolen')).toBe('security')
    expect(classifyMessage('water leak in the stairwell')).toBe('infrastructure')
  })

  it('puts fire ahead of medical when a message mentions both', () => {
    // "fire in the medical centre" is a fire, and dispatching it as a medical
    // call would send the wrong unit.
    expect(classifyMessage('fire in the medical centre')).toBe('fire')
  })

  it('says other rather than guessing', () => {
    expect(classifyMessage('hello is anyone there')).toBe('other')
  })
})

describe('openingSeverity', () => {
  it('opens a fire at P0 and an unknown message at P3', () => {
    expect(openingSeverity('fire')).toBe('P0')
    expect(openingSeverity('other')).toBe('P3')
  })
})

describe('describeMessage', () => {
  it('uses the sender’s own words when there are any', () => {
    const message = readWhatsAppMessage('Body=Fire+in+B+Block+stairwell')
    expect(describeMessage(message)).toBe('Fire in B Block stairwell')
  })

  it('still names a photo sent without a caption', () => {
    const message = readWhatsAppMessage('NumMedia=1&MediaUrl0=https%3A%2F%2Fx')
    expect(describeMessage(message)).toBe('Photo sent over WhatsApp')
  })

  it('keeps a long message short enough for the queue', () => {
    const message = readWhatsAppMessage(`Body=${'a'.repeat(200)}`)
    expect(describeMessage(message).length).toBeLessThanOrEqual(80)
  })
})

describe('TWILIO_EMPTY_ACK', () => {
  it('is the empty TwiML response Twilio requires', () => {
    expect(TWILIO_EMPTY_ACK).toContain('<Response></Response>')
  })
})
