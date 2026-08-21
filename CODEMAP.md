# CODEMAP — what to read, in what order

AEGIS is about 6,000 lines. This is the path through it that makes sense in
twenty minutes, ordered so each file explains the next.

The shape of the codebase in one sentence: **pure decision logic lives in
`src/domain/`, all I/O lives in `src/lib/` and `src/store/`, and route handlers
are three lines of glue.** If you only read one directory, read `src/domain/` —
that is where the product's actual thinking is, and every file in it is a pure
function you can reason about without running anything.

---

## 1. The vocabulary (5 minutes)

| Read | Why |
| --- | --- |
| [`src/domain/types.ts`](src/domain/types.ts) | Every noun in the system: `Incident`, `Responder`, `LocatedPosition`, `TimelineEntry`. Note that a position carries *how it was obtained* and *how confident we are* — that honesty is load-bearing everywhere else. |
| [`src/domain/sla.ts`](src/domain/sla.ts) | The clock every screen runs on. 37 lines. |

## 2. The four decisions the product makes (10 minutes)

Each of these is a pure function, unit-testable, with a worked `@example`.
They correspond one-to-one with the four ways campus emergency response fails.

| Read | The decision it makes |
| --- | --- |
| [`src/domain/beacon.ts`](src/domain/beacon.ts) | **Where is it?** Derives the whole QR-anchor registry from campus footprints, and grades every location method honestly — QR anchor 99% with a floor, map tap 70%, raw GPS 40% and no floor at all. |
| [`src/domain/corroboration.ts`](src/domain/corroboration.ts) | **Is it real, and how bad?** Turns "21 reports at 96% confidence" into an automatic P2 → P0 escalation. Escalation is one-way by design; the comment explains why. |
| [`src/domain/queue.ts`](src/domain/queue.ts) | **What do I do first?** Ranks the dispatcher queue by *SLA pressure*, not arrival time or severity alone. The header comment explains why either of those alone starves someone. |
| [`src/domain/dispatch.ts`](src/domain/dispatch.ts) | **Who do I send?** Right unit first, then nearest, with a fallback rule and a human-readable reason attached to every recommendation. |

Then the two that turn history into action:

| Read | Why |
| --- | --- |
| [`src/domain/pulse.ts`](src/domain/pulse.ts) | Analytics that end in an instruction. `patrolRecommendations()` is the payoff; note that the baseline averages only *occupied* cells, because averaging in empty ones would make every cluster look apocalyptic. |
| [`src/domain/drill.ts`](src/domain/drill.ts) | Scenario playback and the graded after-action report — computed from the same timelines the control room shows, so every number is auditable. |

## 3. How it is wired (5 minutes)

| Read | Why |
| --- | --- |
| [`src/store/adapter.ts`](src/store/adapter.ts) | The entire persistence surface: four methods. In-memory locally, Upstash Redis when deployed. Swapping storage is an env var, not a code change. |
| [`src/lib/incident-service.ts`](src/lib/incident-service.ts) | The one place incidents are written. Every mutation appends to the timeline and publishes an event — that invariant is what makes the audit trail trustworthy. |
| [`src/app/api/events/route.ts`](src/app/api/events/route.ts) | SSE with deliberate stream rotation under the serverless timeout. `EventSource` resumes via `Last-Event-ID`, so a rotation is invisible. |
| [`src/app/api/incidents/[id]/route.ts`](src/app/api/incidents/[id]/route.ts) | A representative route: parse, validate, delegate, serialise. No business logic. Every route looks like this. |

## 4. The parts that win the pitch

| Read | Why |
| --- | --- |
| [`src/components/sentinel/DecoyCalculator.tsx`](src/components/sentinel/DecoyCalculator.tsx) | A working calculator hiding an armed silent-panic session. The PIN check runs *before* the arithmetic so a disarm looks exactly like pressing equals. |
| [`src/lib/drill-service.ts`](src/lib/drill-service.ts) | Drill steps execute through the same service functions the consoles use — a drill incident is a real incident flagged `isDrill`, not a parallel simulation. |
| [`src/domain/ext-allowlist.ts`](src/domain/ext-allowlist.ts) | The `/api/ext` proxy makes a server-side fetch to a URL the browser supplies, so the destination is allowlisted rather than trusted. |
| [`src/integrations/registry.ts`](src/integrations/registry.ts) | Pre-wired, empty integration slots. Mounting a module bought on the trading floor is one entry in `integrations.config.ts`. |
| [`src/domain/evacuation.ts`](src/domain/evacuation.ts) | Turns the map into an instruction. A muster point inside the hazard radius is discarded *before* proximity is considered. |
| [`src/domain/case-token.ts`](src/domain/case-token.ts) | VEIL: anonymous follow-up. Only `sha256(token)` is stored, and `toCaseStatus` is a deliberately narrow projection. |
| [`src/components/report/prepare-evidence.ts`](src/components/report/prepare-evidence.ts) | Re-encoding a photo through a canvas strips EXIF as a side effect — a privacy guarantee produced by the mechanism, not by a library. |
| [`src/domain/offline-queue.ts`](src/domain/offline-queue.ts) | Campus dead zones are where emergencies happen. Reports are held on the device and flushed on reconnect. |
| [`src/domain/broadcast-templates.ts`](src/domain/broadcast-templates.ts) | Authored EN/HI/OR broadcasts. Translations are written, not generated — a mistranslated evacuation instruction is worse than none. |
| [`src/components/nexbot/NexbotAvatar.tsx`](src/components/nexbot/NexbotAvatar.tsx) | The 3D robot that tracks your cursor. Layered `translateZ` planes, not a hosted scene, so it survives the wifi-off gate. |

---

## 5. The tests

`npm test` — 113 assertions over the pure layer, in under half a second. No
mocks, no test server, no DOM: that is the payoff for keeping `domain/` free of
I/O. Read these to see the rules stated as expectations:

| Read | The rule it pins down |
| --- | --- |
| [`src/domain/evacuation.test.ts`](src/domain/evacuation.test.ts) | A muster point on the far side of the fire is never chosen, even when nearest |
| [`src/domain/ext-allowlist.test.ts`](src/domain/ext-allowlist.test.ts) | The proxy blocks cloud metadata, non-http schemes, and lookalike hosts |
| [`src/domain/case-token.test.ts`](src/domain/case-token.test.ts) | A reporter's own case view leaks no incident id, description, or internal chatter |
| [`src/domain/corroboration.test.ts`](src/domain/corroboration.test.ts) | Escalation is one-way and needs volume *and* confidence |
| [`src/domain/offline-queue.test.ts`](src/domain/offline-queue.test.ts) | Corrupt device storage degrades to an empty queue, never a crash |
| [`src/domain/evidence.test.ts`](src/domain/evidence.test.ts) | A non-image payload dressed up as an attachment is refused |

## Directory map

```
src/
  domain/        Pure functions. No I/O, no framework imports. The thinking.
  lib/           Services: I/O, orchestration, zod schemas, the Claude client.
  store/         StorageAdapter + in-memory and Redis implementations.
  app/           Next.js App Router — 6 pages, 19 API routes. Routes stay thin.
  components/    UI, grouped by seat: control/ report/ respond/ analytics/
                 beacon/ sentinel/ ops/ landing/ nexbot/
  integrations/  Slots and registry for modules acquired on the trading floor.
  data/          Campus footprints and drill scenarios (generated / authored data).
```

## Conventions

- TypeScript `strict`, no `any` at any module boundary.
- Named exports everywhere except React pages and components.
- Files stay under ~200 lines; extract rather than nest.
- Comments explain **why**. Anything explaining *what* has been deleted.
- Every exported function carries JSDoc with a worked `@example`.

Reasoning behind the non-obvious calls — SSE over WebSockets, JSON store over
Postgres, client-driven drill ticks, canvas over three.js — is in
[`DECISIONS.md`](DECISIONS.md).
