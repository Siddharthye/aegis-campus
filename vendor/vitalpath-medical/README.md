# Medical red-flag triage — acquired module

**Asset:** VitalPath — Medical Emergency Intake & Triage
**Seller:** https://github.com/nirmalyajena01-lgtm/medicalemergency (`vitalpath-medical`)
**Acquired by:** Team PROMPT & PRAY (HA-040-7800)

## What was bought

Structured medical intake. A general "describe what happened" box is the wrong
shape for a medical emergency — it is a field a frightened nineteen-year-old
fills with *"pls come fast"*, which tells a duty officer nothing about how fast
is fast enough.

VitalPath asks four questions instead: responsive, breathing, bleeding, how
many people. Those four answers separate *"someone fainted and is sitting up"*
from *"someone is unresponsive and not breathing"* in about eight seconds.

**It does not diagnose anyone.** It decides how fast someone should be reached
and who should reach them.

## How it is integrated

Their service is FastAPI, so the protocol was ported rather than called.
`app/protocol.py` is vendored here unmodified beside our port in
`src/domain/medical-triage.ts`.

| Theirs | In AEGIS |
| --- | --- |
| `triage()` rule cascade | `triageMedical()`, rule for rule |
| `REACH_TARGET` | unchanged: 180 / 480 / 1200 / 3600 seconds |
| `P0/P1/P2_FINDINGS` | unchanged |
| `required_skills()` | `requiredSkills()` |
| `SEVERITY_MAP` to 1–100 | not needed — AEGIS is already P0–P3 |
| `POST /v1/reports` | `POST /api/intake/medical` |

It is a **cascade, not a weighted score**, and that is the point: the single
worst finding decides the outcome. A person who is not breathing is P0 however
reassuring every other answer looks, because averaging would let mild findings
dilute a fatal one. `src/domain/medical-triage.test.ts` asserts exactly that.

Two of their judgements worth keeping in view:

- **Gasping counts as not breathing.** Agonal breathing looks like breathing to
  a bystander and is not.
- **Unknowns are risk, never reassurance.** A reporter who cannot tell whether
  someone is breathing is describing a worse situation than one who can confirm
  that they are, so that report is raised, not lowered.

## Where it lands

`POST /api/intake/medical` triages the answers and files the result into the
same pipeline as every other report — so it fuses with duplicates, ranks by SLA
pressure, and dispatches. The reasons that produced the priority are written
into the incident description, so a duty officer can see why and overrule it.
