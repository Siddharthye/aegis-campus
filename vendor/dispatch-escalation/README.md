# Responder escalation ladder — acquired module

**Asset:** DispatchGrid — Responder Assignment & Escalation Engine
**Seller:** https://github.com/nirmalyajena01-lgtm/dispatchgrid
**Acquired by:** Team PROMPT & PRAY (HA-040-7800)
**Licence:** MIT

## What was bought, and what AEGIS was missing

DispatchGrid is a dispatch engine: matching, acknowledgement clocks, an
escalation ladder, and a proof-grade timeline.

AEGIS already matched responders and clocked incidents, so most of that
overlapped. What it did **not** have is the idea the module is built around:

> A guard whose phone is in a drawer looks identical to a guard running
> towards a fire — until the clock runs out.

AEGIS assigned a responder and then assumed they were on their way. An
unacknowledged assignment was a neutral state. DispatchGrid treats it as an
active failure, and that is the part worth owning.

## What was integrated

Their engine is FastAPI over Postgres, so the rules were integrated rather
than the runtime — `src/domain/dispatch-escalation.ts`:

| Theirs | In AEGIS |
| --- | --- |
| `SLA_BY_BAND` over a 0–100 score | `DEADLINES` over P0–P3, same numbers |
| `ESCALATION_LADDER` | unchanged: responder → supervisor → warden → chief |
| `next_tier()` | `nextTier()` |
| `band()` | not needed — AEGIS severities are already the four bands |

Their acknowledgement deadlines are carried across exactly: **45s** for a P0,
90s, 300s, 900s. `src/domain/dispatch-escalation.test.ts` asserts those
numbers directly, so a future edit cannot quietly loosen them.

## Where it shows

The control room's "Units en route" panel. Once a unit is dispatched the
acknowledgement clock runs, and if it expires the panel says who to pull in:

> No acknowledgement after 300s — pulling in the supervisor.

One judgement call of our own: **movement counts as acknowledgement.** A
responder who is en route or on scene has plainly seen the job, whatever
button they did or did not press, so only genuine silence escalates.

## Not integrated

Their same-gender / counsellor routing for harassment is a hard filter worth
having, but AEGIS's responder records carry no gender or counsellor skill, so
adopting it would mean inventing data about real people. `requiresSpecialistRouting`
marks the seam; the roster has to grow before the rule can mean anything.
