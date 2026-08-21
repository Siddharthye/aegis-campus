import { readSla } from '@/domain/sla'
import type { Incident, Responder } from '@/domain/types'

export interface AskResult {
  text: string
  /** App route worth jumping to for this answer, if any. */
  navigate?: string
  /** Incident the answer centres on, if any. */
  incidentId?: string
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

const line = (incident: Incident) =>
  `• ${incident.severity} ${incident.title} · ${incident.status} · ${incident.location.label} · ${fmtTime(incident.createdAt)}`

/**
 * Local NEXBOT — answers computed from the live incident store, no external
 * model required. Pattern reused from our TOWERZ project (NexbotChat): keyword
 * routing over live state, with navigate chips for follow-through.
 *
 * Deliberately offline-first: the assistant must work in a demo with wifi off.
 *
 * @example
 * askNexbot('what needs attention', incidents, responders)
 * // => { text: 'Priority attention:\n• P0 …', navigate: '/control' }
 */
export function askNexbot(
  raw: string,
  incidents: readonly Incident[],
  responders: readonly Responder[],
): AskResult {
  const q = raw.trim().toLowerCase()
  const now = new Date()
  const open = incidents.filter((incident) => incident.status !== 'resolved')

  if (!q) {
    return {
      text: 'Ask about open incidents, SLA breaches, responders, a category (fire, medical, harassment), or say "brief".',
    }
  }

  // Direct incident id, e.g. "inc-a1b2c3d4"
  const idMatch = q.match(/inc-[a-z0-9-]+/)
  if (idMatch) {
    const incident = incidents.find((item) => item.id === idMatch[0])
    if (incident) return explainIncident(incident, now)
    return { text: `No incident ${idMatch[0]} on the board.` }
  }

  if (/breach|sla|late|overdue/.test(q)) {
    const breached = open.filter((incident) => readSla(incident, now).breached)
    if (breached.length === 0) {
      return { text: 'No open incidents are past their SLA target. Clocks are green.' }
    }
    return {
      text: `SLA breaches (${breached.length}):\n${breached.map(line).join('\n')}`,
      navigate: '/control',
      incidentId: breached[0]?.id,
    }
  }

  if (/attention|priority|urgent|worst|critical|p0/.test(q)) {
    const ranked = [...open].sort((a, b) => a.severity.localeCompare(b.severity))
    if (ranked.length === 0) return { text: 'Nothing open. The campus is quiet.' }
    return {
      text: `Priority attention:\n${ranked.slice(0, 5).map(line).join('\n')}`,
      navigate: '/control',
      incidentId: ranked[0]?.id,
    }
  }

  if (/responder|unit|who.*(free|available)|staff|team/.test(q)) {
    const free = responders.filter((responder) => responder.status === 'available')
    const busy = responders.filter((responder) => responder.status !== 'available')
    return {
      text:
        `Responders: ${free.length} available of ${responders.length}.\n` +
        free.map((r) => `• ${r.name} (${r.unit}) — available`).join('\n') +
        (busy.length > 0
          ? `\n${busy.map((r) => `• ${r.name} (${r.unit}) — ${r.status}`).join('\n')}`
          : ''),
      navigate: '/control',
    }
  }

  const category = (['fire', 'medical', 'harassment', 'infrastructure', 'security'] as const).find(
    (candidate) => q.includes(candidate),
  )
  if (category) {
    const matching = incidents.filter((incident) => incident.category === category).slice(0, 5)
    if (matching.length === 0) return { text: `No ${category} incidents on the board.` }
    return {
      text: `${category.toUpperCase()} incidents:\n${matching.map(line).join('\n')}`,
      incidentId: matching[0]?.id,
      navigate: '/control',
    }
  }

  if (/anonym|veil|privacy/.test(q)) {
    const anonymous = incidents.filter((incident) => incident.reporterId === null)
    return {
      text:
        `${anonymous.length} incident(s) were reported anonymously. AEGIS stores no identity for them — ` +
        `follow-ups happen through one-way case tokens, and every evidence access is audit-logged.`,
    }
  }

  if (/drill|simulate|scenario/.test(q)) {
    return {
      text: 'Drill mode replays a scripted campus emergency end-to-end — reports, fusion, dispatch, resolution — deterministically and offline. Open the control room and press RUN DRILL.',
      navigate: '/control',
    }
  }

  if (/report|how do i|help/.test(q)) {
    return {
      text: 'To report: three taps — category, location (scan a BEACON QR for room-level accuracy), send. For silent emergencies, triple-tap the shield to arm SENTINEL.',
      navigate: '/report',
    }
  }

  // Default: the briefing.
  const p0 = open.filter((incident) => incident.severity === 'P0').length
  const breached = open.filter((incident) => readSla(incident, now).breached).length
  const free = responders.filter((responder) => responder.status === 'available').length
  return {
    text:
      `Campus briefing @ ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}\n` +
      `• Open incidents: ${open.length} (${p0} at P0)\n` +
      `• SLA breaches: ${breached}\n` +
      `• Responders free: ${free}/${responders.length}\n` +
      `Try: "what needs attention" · "sla breaches" · "who is free" · "fire" · an incident id.`,
    navigate: '/control',
  }
}

function explainIncident(incident: Incident, now: Date): AskResult {
  const sla = readSla(incident, now)
  const clock = sla.breached
    ? `SLA BREACHED by ${Math.abs(Math.round(sla.remainingMinutes))}m`
    : `${Math.max(0, Math.round(sla.remainingMinutes))}m left on SLA`

  return {
    text:
      `${incident.severity} · ${incident.title}\n` +
      `• Status: ${incident.status} · ${clock}\n` +
      `• Where: ${incident.location.label} (${Math.round(incident.location.confidence * 100)}% via ${incident.location.method})\n` +
      `• Corroboration: ${incident.reportCount} report(s), ${Math.round(incident.confidence * 100)}% confidence\n` +
      `• Timeline: ${incident.timeline.map((step) => step.action).join(' → ')}`,
    incidentId: incident.id,
    navigate: '/control',
  }
}
