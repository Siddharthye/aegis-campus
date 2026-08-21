# Engineering Decisions

Why AEGIS is built the way it is. Each entry is the question a reviewer would
ask, answered the way we'd answer in person.

## Why SSE instead of WebSockets?

Every live surface (control room, alerts, fusion board) is server→client
one-way. SSE gives us that over plain HTTP with automatic reconnection and
`Last-Event-ID` resume built into the browser — no socket server, no extra
infra, works through any proxy. Our streams deliberately self-rotate under the
serverless function timeout; `EventSource` resumes seamlessly, so a Vercel
deployment behaves identically to localhost.

## Why a JSON/Redis storage adapter instead of Postgres?

Two runtimes, one interface (`src/store/adapter.ts`, four methods):

- **Local:** in-memory + best-effort JSON persistence. A judge or module buyer
  clones and runs with zero setup — no database, no account, no migration.
- **Deployed:** Upstash Redis over HTTP, because serverless memory dies between
  invocations.

A Postgres adapter is a drop-in later. For a 3-day product with demo-sized
data, an external database adds setup cost and demo risk while proving nothing.

## Why is escalation evaluated lazily instead of on timers?

`setTimeout` ladders silently never fire on serverless — the process is gone
after the response. Escalation state is therefore computed on every read from
`createdAt` + the ladder definition, and fired exactly once via a recorded
step index. Same behaviour locally and deployed, no background workers.

## Why does the drill engine tick from the client?

Same serverless constraint: a 90-second server loop would exceed function
limits. `POST /api/drill/tick` is idempotent and executes whatever steps have
come due on the drill clock; the control room drives it. Deterministic,
pausable, and it cannot outlive a function.

## Why a hand-rolled canvas hologram instead of three.js?

Fourteen extruded buildings don't need a WebGL scene graph. The 2D-canvas
isometric projection is ~200 lines we fully control, ships zero extra
kilobytes, hits 60fps on weak hardware, and — because it renders
`src/data/campus.ts`, the same dataset the ATLAS map uses — the marketing hero
literally renders the product's data.

## Why do pages fetch through the API instead of reading the store?

On Vercel, page rendering and route handlers are deployed as *separate*
serverless functions. They therefore do not share the in-memory store: a
server component that calls the service layer directly finds an empty store in
production even though `/api/...` answers correctly for the same id. The drill
after-action page hit exactly this and 404'd in production while passing
locally, where one process holds everything.

So pages read through the public HTTP API. That also keeps us honest — every
screen consumes the same endpoints a buyer would integrate against, which is
the dogfood test we apply to the sold modules. (With Upstash configured both
paths share durable storage and either would work; the HTTP path is correct
under both.)

## Why no OAuth?

Roles (reporter / dispatcher / responder / admin) are demo-switchable
identities. Real auth earns zero marks in a 5-minute pitch and adds a failure
mode on venue wifi. The interesting auth work — anonymous reporting with
one-way case tokens, PIN-guarded SENTINEL disarm — is where identity actually
matters in this domain, and that we did build.

## Why does location carry a confidence field?

Because pretending GPS works indoors is how campus safety products fail.
Every position records how it was obtained (floor-plan pick 85% / map tap
70% / GPS 40%) and the UI shows it honestly. Dispatchers make better decisions when
the system admits what it doesn't know.

## Why are the sellable modules separate repos with duplicated helpers?

SIREN / ATLAS / FUSION are sold on the HACQUIRE floor as standalone products.
A shared internal package would make them unsellable (buyers would inherit our
monorepo), so each carries its own copy of the small helpers it needs. The
duplication is the product boundary — and AEGIS consumes them only over their
public HTTP APIs, which is the proof they really are standalone.

## Why is the LLM optional everywhere it appears?

`/api/triage` uses Claude when a key exists and a deterministic rules engine
otherwise — same response shape, plus an `engine` field so the UI is honest
about which answered. NEXBOT answers from the live store with no model at all.
The demo must survive a venue with no wifi; anything less is a gamble we don't
need to take.

## Why was BEACON dropped for SIGHTLINE?

BEACON's premise was printed QR anchors giving room-level location. It solved
a real problem for a fire or a collapse, but for the case that actually drives
a campus safety app — being followed at night — it asked the wrong thing of the
wrong person: stop, find a poster, scan it. Nobody does that.

SIGHTLINE answers the question a person actually has at 10pm: which way should
I walk. Reports already arrive one at a time, each to the control room, so the
place that keeps producing them stays invisible to the next person walking
through it. `src/domain/risk-map.ts` clusters them by place and three-hour band
and scores tonight's routes against the patterns live at that hour.

Two rules matter more than the clustering:

- **A pattern needs at least two distinct reporters.** One account filing four
  reports about a place is not evidence about the place. Without this rule the
  feature is a tool for rerouting strangers away from somewhere one person
  dislikes. Anonymous reports still count as distinct people — anonymity must
  not collapse six victims into one unreliable voice.
- **Unlit routes carry a standing penalty even with nothing reported.** Nobody
  files a report about a light that was already out, so absence of reports on a
  dark path is not evidence of quiet. The UI labels these `Unlit`, not
  `Some reports`, because the reason text beside it says no reports exist and
  the two must not contradict each other.

Nothing is ever called safe. The bands are Quiet, Unlit, Some reports, and
Avoid if you can, and every route is listed — the shorter way is never hidden,
because that choice belongs to the person walking.

## Why isn't SIGHTLINE just a live location share?

A live location share tells one trusted person where you are. It cannot tell
you where not to go, because it has no access to what anyone else reported.
SIGHTLINE's whole value is the part a phone-to-phone share structurally cannot
do: aggregate across reporters who have never met.
