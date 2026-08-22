# Vernacular voice announcements — acquired module

**Asset:** JanSetu Vernacular Voice SDK — Live SDK Activation Hub
**Seller:** JanSetu — https://jan-setu-steel.vercel.app/activate-voice-sdk
**Licence key issued:** `JS-VOICE-ACTIVE-2026-PROD-LIVE`
**Acquired by:** Team PROMPT & PRAY (HA-040-7800)

## What was bought

A speech engine that reads a message aloud in the language it is written in,
across seven Indian languages — so a campus alert reaches people who cannot
read the screen it is on.

## What was actually deliverable, and what we did

The seller's integration guide documents a two-line install:

```js
import { VernacularVoiceEngine } from '@jansetu/vernacular-voice-sdk'
const voice = new VernacularVoiceEngine({ licenseKey, defaultLanguage })
voice.speak('आपकी छात्रवृत्ति स्वीकृत हो गई है।', 'hi')
```

That package is not published to npm — `npm view @jansetu/vernacular-voice-sdk`
returns 404 — so the import cannot resolve on any machine. The seller's other
link (`github.com/vexyl-ai/vexyl-stt`) is speech-to-*text*, the opposite
direction, and needs a self-hosted 600M-parameter model with no live endpoint.

So we integrated the **interface** rather than the package: `VernacularVoiceEngine`
in `src/domain/vernacular-voice.ts` implements their documented constructor and
`.speak(text, lang)` signature exactly, backed by the speech engine every
browser already ships. If the package is published later, swapping it in is a
one-line change at the construction site, because the surface is theirs.

## Where it landed

The control room's geofenced broadcast box. A dispatcher composes or loads a
template and presses the speaker button; the message is read aloud in the
language it is written in, detected from its script — Devanagari for Hindi,
Odia's own block for Odia, English otherwise.

That works because AEGIS already authors every broadcast template in English,
Hindi and Odia, so the acquisition plugged into content that already existed.

Speaking locally also suits the product: nothing leaves the device, so an
announcement still works with the wifi off.
