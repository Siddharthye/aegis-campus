# WhatsApp intake — acquired module

**Asset:** `MOD-WHATSAPP-INTAKE-03`
**Seller:** PingBin — https://github.com/SGOD-pro/PingBin
**Acquired by:** Team PROMPT & PRAY (HA-040-7800)

## What was bought

A Twilio WhatsApp webhook processor: it answers Twilio inside the 15-second
window with an empty TwiML ACK, normalises the form-encoded body into a typed
payload, and classifies each message as a photo, a location pin, or text.

`handler.py` and `UPSTREAM-README.md` are the seller's files, unmodified, so
the contract we integrated against can be read beside our implementation of it.

## How it is integrated

Their handler is an AWS Lambda that flushes to an SQS queue. AEGIS runs on
Next.js with no Lambda and no queue, so the port is a reimplementation of
their contract rather than a copy of their runtime:

| Their module | In AEGIS |
| --- | --- |
| Lambda `handle_webhook(event)` | `POST /api/intake/whatsapp` |
| `_detect_message_payload()` | `readWhatsAppMessage()` in `src/domain/whatsapp-intake.ts` |
| Publish to AWS SQS | `intakeReport()` — the same pipeline the in-app reporter uses |
| `<Response></Response>` ACK | unchanged, byte for byte |

Field names, message-type precedence (media → pin → text) and the ACK body are
theirs. `src/domain/whatsapp-intake.test.ts` asserts against the exact example
payload in their README, so their contract is what our tests hold us to.

Because the incident lands in the normal pipeline, a WhatsApp report fuses with
duplicates, gets triaged, and is dispatched like any other — the acquisition
extends the front of the journey without touching anything downstream.

## Pointing Twilio at it

Set the WhatsApp sandbox webhook to:

```
https://aegis-campus.vercel.app/api/intake/whatsapp
```

No credentials are needed on our side: Twilio posts to us, and nothing is sent
back. Their `.env.example` (Twilio SID, auth token, SQS queue, AWS region)
applies to running *their* Lambda, not to this route.
