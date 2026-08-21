#!/usr/bin/env bash
# AEGIS smoke test — exercises the whole pipeline over HTTP.
#
# This doubles as documentation: every call below is one you can copy into your
# own client. Run `npm run dev` in another terminal first.
#
#   ./smoke.sh [base-url]     # default http://localhost:3000

set -euo pipefail
BASE="${1:-http://localhost:3000}"

say() { printf '\n\033[36m▸ %s\033[0m\n' "$1"; }
json() { python -c 'import json,sys; print(json.dumps(json.load(sys.stdin), indent=2)[:600])'; }

say "Health — which storage backend is live?"
curl -sf "$BASE/api/health" | json

say "Stats — headline numbers for the control room"
curl -sf "$BASE/api/stats" | json

say "Triage — free text in, category + severity out"
curl -sf -X POST "$BASE/api/triage" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Thick smoke spreading from the chemistry lab, someone may be trapped"}' | json

say "BEACON — the QR anchor registry (Block C only)"
curl -sf "$BASE/api/beacon/anchors?buildingId=block-c" \
  | python -c 'import json,sys; d=json.load(sys.stdin); print(d["count"], "anchors"); [print(" ", a["id"], "-", a["label"]) for a in d["anchors"][:4]]'

say "File an incident located by QR anchor (99% confidence, floor known)"
INCIDENT=$(curl -sf -X POST "$BASE/api/incidents" \
  -H 'Content-Type: application/json' \
  -d '{
        "category": "fire",
        "severity": "P2",
        "title": "Smoke in the east stairwell",
        "description": "Haze and a burning smell on the third-floor landing.",
        "location": {
          "lat": 20.3536, "lng": 85.8189,
          "label": "Block C · Floor 3 · Stairwell",
          "method": "qr-anchor", "confidence": 0.99,
          "floor": 3, "buildingId": "block-c"
        },
        "reporterId": "student-2214"
      }')
INCIDENT_ID=$(echo "$INCIDENT" | python -c 'import json,sys; print(json.load(sys.stdin)["incident"]["id"])')
echo "  created $INCIDENT_ID"

say "Dispatch recommendations — right unit first, then nearest, with reasons"
curl -sf "$BASE/api/incidents/$INCIDENT_ID" \
  | python -c 'import json,sys; d=json.load(sys.stdin); [print(" ", r["responder"]["name"], "|", r["reason"], "| ETA", r["etaMinutes"], "min") for r in d["recommendations"][:3]]'

say "Geofenced broadcast — delivered by SIREN, audited here"
curl -sf -X POST "$BASE/api/incidents/$INCIDENT_ID/broadcast" \
  -H 'Content-Type: application/json' \
  -d '{"message":"Evacuate via the west stairwell. Do not use lifts."}' > /dev/null
echo "  broadcast recorded"

say "SENTINEL — arm a silent panic session"
ARM=$(curl -sf -X POST "$BASE/api/sentinel/arm" \
  -H 'Content-Type: application/json' \
  -d '{"lat":20.3536,"lng":85.8195}')
SESSION_ID=$(echo "$ARM" | python -c 'import json,sys; print(json.load(sys.stdin)["sessionId"])')
PIN=$(echo "$ARM" | python -c 'import json,sys; print(json.load(sys.stdin)["pin"])')
echo "  session $SESSION_ID armed (PIN shown once: $PIN)"

curl -sf -X POST "$BASE/api/sentinel/ping" \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SESSION_ID\",\"lat\":20.3537,\"lng\":85.8196}" > /dev/null
echo "  location breadcrumb accepted"

say "Control-room view of that session — note there is no PIN hash in it"
curl -sf "$BASE/api/sentinel/sessions?active=true" | json

say "A wrong PIN and a right one are indistinguishable in shape"
curl -sf -X POST "$BASE/api/sentinel/disarm" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SESSION_ID\",\"pin\":\"0000\"}"
echo "  ← wrong PIN"
curl -sf -X POST "$BASE/api/sentinel/disarm" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SESSION_ID\",\"pin\":\"$PIN\"}"
echo "  ← correct PIN"

say "DRILL — run a scripted emergency at 8× and grade it"
DRILL_ID=$(curl -sf -X POST "$BASE/api/drill" \
  -H 'Content-Type: application/json' \
  -d '{"scenario":"blockc-fire","speed":8}' \
  | python -c 'import json,sys; print(json.load(sys.stdin)["run"]["id"])')
echo "  started $DRILL_ID"

for _ in $(seq 1 15); do
  DONE=$(curl -sf -X POST "$BASE/api/drill/tick" \
    -H 'Content-Type: application/json' \
    -d "{\"drillId\":\"$DRILL_ID\"}" \
    | python -c 'import json,sys; print(json.load(sys.stdin)["run"]["done"])')
  [ "$DONE" = "True" ] && break
  sleep 1
done

say "After-action report"
curl -sf "$BASE/api/drill/$DRILL_ID/report" | json

say "PULSE — analytics that end in an instruction"
curl -sf "$BASE/api/pulse" \
  | python -c 'import json,sys; d=json.load(sys.stdin); [print(" ", p["headline"]) for p in d["patrols"][:3]]'

say "Clean up the drill"
curl -sf -X DELETE "$BASE/api/drill" > /dev/null
echo "  drill incidents cleared"

printf '\n\033[32m✓ All checks passed.\033[0m\n'
