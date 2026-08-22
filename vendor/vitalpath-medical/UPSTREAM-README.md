# VitalPath — Medical Emergency Intake & Triage

The medical path, pulled out of the general incident reporter and given its own
questions, its own clock, and its own protocol.

> **VitalPath does not diagnose anyone.** It decides how fast someone should be
> reached and who should reach them. Every response it produces begins by
> telling the reporter to call emergency services. It is a dispatch-priority
> tool, not a clinical one.

## Why this is a separate module

A general "report an incident" form is the wrong shape for a medical
emergency. "Describe what happened" is a free-text box that a panicking
nineteen-year-old fills with *"pls come fast"* — which tells a duty officer
nothing about how fast is fast enough.

VitalPath asks four structured questions instead, in the order that changes the
answer most:

1. Is the person **responsive**?
2. Are they **breathing normally**?
3. Is there **severe bleeding**?
4. How many people are affected?

Those four answers separate *"someone fainted and is already sitting up"* from
*"someone is unresponsive and not breathing"* in about eight seconds, without
asking anyone to describe a symptom they cannot name.

## Who buys this without owning a campus

| | |
|---|---|
| **Buyer** | Hospitals, event medical teams, factories, gyms, schools, stadiums |
| **Sold as** | Metered API + embeddable intake widget |
| **Pricing** | INR 6 per triaged report; INR 90k/yr self-hosted |
| **Moat** | Structured red-flag intake + AED proximity in one call |

Any organisation that has first-aiders and a duty roster has this problem.
Nothing in the module mentions a campus.

## The protocol

Priority is a **rule cascade**, not a score, because in a medical context the
worst single finding must decide the outcome — averaging is wrong here. A
person who is not breathing is P0 no matter what else is true.

| Priority | Meaning | Reach target |
|---|---|---|
| **P0** | Immediately life-threatening | 3 minutes |
| **P1** | Serious, time-critical | 8 minutes |
| **P2** | Urgent but stable | 20 minutes |
| **P3** | Non-urgent | 60 minutes |

Red flags that force P0: unresponsive, not breathing or gasping, severe
bleeding that will not stop, drowning, electrocution, anaphylaxis.

Every result carries `reasons` — the exact findings that produced the
priority — so a duty officer can see why and overrule it.

## AED proximity

The same call returns the nearest defibrillator and first-aid post to the
reported location, because the two useful minutes in a cardiac arrest are the
ones spent walking to the wrong floor. Locations resolve from the same anchor
codes the intake uses.

## Bystander guidance

Deliberately limited to **logistics, not treatment**:

- Call 112 and follow the operator — they are trained and you are not
- Send someone to the entrance to guide responders in
- Unlock the door, clear the corridor
- Do not move the person unless they are in immediate danger
- Stay with them until help arrives

There are no clinical instructions in this module. Anything a bystander should
do to a patient comes from the 112 operator on the phone, in real time, from a
person qualified to give it.

## Quick start

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
# docs at http://localhost:8000/docs
```

```bash
curl -X POST localhost:8000/v1/medical/reports \
  -H 'content-type: application/json' \
  -d '{"responsive":false,"breathing":"absent","bleeding":"none",
       "anchor_code":"AB-3F-304","people_affected":1}'
```

## API

| Method | Path | Does |
|---|---|---|
| `POST` | `/v1/medical/reports` | Structured intake, returns priority + reasons |
| `GET` | `/v1/medical/reports/{id}` | Retrieve a triaged report |
| `POST` | `/v1/medical/reports/{id}/override` | Clinician or duty officer overrides |
| `GET` | `/v1/guidance/{priority}` | Bystander logistics for that priority |
| `GET` | `/v1/aed/nearest` | Nearest defibrillator and first-aid post |
| `GET` | `/v1/protocol` | The full rule cascade, as data |
| `GET` | `/healthz` | Liveness |

## Integrating with a wider platform

VitalPath emits a priority; it does not dispatch, alert or store history. Feed
`priority` to whatever assignment engine you already run. In Aegis it maps to
SignalKit severity like this:

| VitalPath | Severity |
|---|---|
| P0 | 95 |
| P1 | 78 |
| P2 | 55 |
| P3 | 30 |

The mapping lives in `app/protocol.py` as `SEVERITY_MAP` so a different host
platform can change it in one place.

## Licence

MIT.
