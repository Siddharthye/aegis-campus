# AEGIS — Campus Emergency Response OS

**Every second, accounted for.** Report an emergency in three taps, locate it
to the room (not the block), fuse fifty duplicate reports into one incident,
dispatch the nearest responder — with an SLA clock running on every transition.

Built by **Team PROMPT & PRAY (HA-040-7800)** for HACQUIRE 2026 · PS-01 Smart
Campus Emergency Response.

---

**Live:** [aegis-campus.vercel.app](https://aegis-campus.vercel.app) · Reading order for
reviewers: [`CODEMAP.md`](CODEMAP.md)

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 164 domain tests, no mocks, under a second
./smoke.sh         # exercises the whole pipeline over HTTP, in another terminal
```

That's the whole setup: no database, no API keys, no accounts. Seeded demo
data appears on first load, and everything — including the AI assistant — works
with the wifi off. Optional integrations (Claude triage, Redis persistence)
are documented in [`.env.example`](.env.example).

## The four failure points

Campus emergencies fail in four places. Each one maps to a subsystem:

| # | Failure | Subsystem |
| --- | --- | --- |
| 01 | People can't report fast enough | **3-tap reporting** + **SENTINEL** silent panic (triple-tap → decoy calculator, location streams silently, PIN to disarm) + **SAFE WALK** dead man's switch (miss two check-ins → silent alarm with your last known position) |
| 02 | Nobody knows exactly *where* | **BEACON** printed QR anchors → building/floor/room at 99% confidence, honest confidence shown for GPS (±30m, 40%) |
| 03 | The control room drowns in duplicates | **FUSION** — spatial+temporal+semantic clustering, corroboration confidence, velocity auto-escalation, prank quarantine |
| 04 | Nobody learns anything afterward | **PULSE** — heat calendar, hotspot ranking, SLA scorecards, and patrol *recommendations*, not just charts |

Installable as a PWA, and the report screen keeps working with no signal:
reports filed in a dead zone are held on the device and sent automatically on
reconnect, because campus dead zones are disproportionately where emergencies
happen. Attached photos are downscaled and re-encoded in the browser, which
strips the GPS and camera metadata a phone embeds — and the UI says so.

Plus **DRILL MODE**: a deterministic, fully offline replay of a scripted campus
emergency through the real pipeline — reports, fusion, dispatch, resolution —
ending in a graded after-action report. Campuses are required to run drills;
we made the drill a product feature.

## The seats

| Route | Seat | What happens there |
| --- | --- | --- |
| `/` | — | The landing page |
| `/report` | Student / staff | 3-tap report, anonymous toggle, QR anchor location, SENTINEL |
| `/control` | Dispatcher | Live queue ranked by SLA pressure, dispatch recommendations with reasons, silent-alarm lane, drill panel |
| `/respond` | Responder | My assignment, thumb-sized status advances, live SLA clock |
| `/analytics` | Admin | PULSE analytics + patrol plan |
| `/beacon` | Admin | Printable QR anchor sheets |
| `/case` | Anyone | **VEIL** — check a case with the one-way token from your report. No account, no name |
| `/wanted` | — | The six integrations we will buy, each mapped to a slot already in the product |
| `/ai` | Anyone | **NEXBOT console** — the ops copilot, with measured receipts under every answer |

Navigation is a macOS-style dock (bottom of every screen) plus a ⌘K command
palette that reaches every screen, any live incident by id or title, and hands
typed questions to NEXBOT.

Broadcasts ship as authored templates in **English, Hindi and Odia** — an
English-only alert excludes the support staff and visitors often closest to the
hazard, and a mistranslated evacuation instruction is worse than none. Every
drill ends in a printable after-action report, produced by the browser's own
print-to-PDF so there is no PDF library to install.

**NEXBOT**, the ops copilot (the robot in the corner watches your cursor on
every screen), answers
questions from the live incident store — "what needs attention", "any SLA
breaches", "who is free" — with zero external dependencies.

## Bought & sold (the HACQUIRE part)

Three of AEGIS's six subsystems are listed on the trading floor as standalone
products, each in its own repo with its own README, API, widget, and React
embed — and AEGIS consumes them **only over their public HTTP APIs**, which is
the proof they're genuinely standalone:

| Module | Repo | Listed at |
| --- | --- | --- |
| SIREN — geofenced alerts & broadcast | `siren-alerts` | ₹5.00 Cr |
| ATLAS — live 3D map + triage engine | `atlas-incident-map` | ₹5.00 Cr |
| FUSION — duplicate report fusion | `fusion-reports` | ₹5.00 Cr |

Modules acquired from other teams plug into pre-wired integration slots
(`src/integrations/`) through a server-side proxy (`/api/ext`) — integration
is one config entry, not an afternoon.

## Architecture in one breath

Next.js 16 App Router / React 19 / TypeScript strict / Tailwind v4. Pure
domain logic in `src/domain` (dispatch ranking, SLA clocks, triage, pulse
analytics — all unit-testable functions with JSDoc examples). Thin zod-validated
routes. A four-method storage adapter: in-memory + JSON locally, Upstash Redis
when deployed. Realtime via self-rotating SSE streams that survive serverless
timeouts. Reasoning behind every non-obvious call: [`DECISIONS.md`](DECISIONS.md).

> **On the deployed demo:** with no Upstash credentials set, the hosted build
> runs on the in-memory adapter. State therefore lives only as long as the
> serverless instance stays warm — fine for a walkthrough, and a cold start
> mid-drill simply resets to seeded data. Setting `UPSTASH_REDIS_REST_URL` and
> `UPSTASH_REDIS_REST_TOKEN` switches it to durable storage with no code change.
