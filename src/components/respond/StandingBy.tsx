import { describeSlaClock } from '@/domain/queue'
import { readSla } from '@/domain/sla'
import { estimateArrival } from '@/domain/dispatch'
import type { Incident, Responder } from '@/domain/types'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { StatusBadge } from '@/components/ops/StatusBadge'
import { Chip, MiniBar, Panel } from '@/components/ui/Panel'

interface StandingByProps {
  responders: readonly Responder[]
  /** Open incidents with nobody on them yet. */
  unassigned: readonly Incident[]
  /** Most recently closed, newest first. */
  recent: readonly Incident[]
  /** Whoever is reading — used to mark their own row and measure distance. */
  you: Responder | null
  now: Date
}

/**
 * What a responder sees with no assignment.
 *
 * Standing by is exactly when someone has time to read the board, so the space
 * an assignment would fill shows the board instead of an empty state. Every
 * unassigned incident carries the distance from where this responder actually
 * is, because the useful question while waiting is which one they would be
 * sent to.
 */
export function StandingBy({ responders, unassigned, recent, you, now }: StandingByProps) {
  return (
    <>
      <Panel label="Standing by" tone="default" spotlight aside={<Chip tone="good">available</Chip>}>
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border border-emerald-400/40 bg-emerald-400/10">
            <span className="siren-pulse size-2 rounded-full bg-emerald-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-ops-text">No active assignment</p>
            <p className="text-[12px] leading-relaxed text-ops-muted">
              You appear in dispatch recommendations while available, ranked by unit first and then
              distance. Anything matching you lands here instantly.
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        label="Unassigned on the board"
        aside={<Chip tone={unassigned.length ? 'warn' : 'good'}>{unassigned.length}</Chip>}
      >
        {unassigned.length === 0 ? (
          <p className="px-4 py-6 text-[12px] leading-relaxed text-ops-muted">
            Every open incident already has a unit on it. Nothing is waiting.
          </p>
        ) : (
          <ul className="divide-y divide-ops-border/60">
            {unassigned.map((incident) => {
              const sla = readSla(incident, now)
              const distance = you ? estimateArrival(you.location, incident.location) : null

              return (
                <li key={incident.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={incident.severity} compact />
                    <StatusBadge status={incident.status} />
                    <span className="ops-label ml-auto text-ops-faint">
                      {describeSlaClock(sla.remainingMinutes)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-ops-text">{incident.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-ops-muted">
                    <span>{incident.location.label}</span>
                    {distance && (
                      <span className="text-ops-accent">
                        {distance.distanceM}m · {distance.etaMinutes}m out
                      </span>
                    )}
                  </p>
                  <div className="mt-2">
                    <MiniBar
                      value={Math.min(sla.elapsedMinutes, sla.targetMinutes)}
                      max={sla.targetMinutes}
                      tone={sla.breached ? 'danger' : 'accent'}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel label="Unit roster" aside={<Chip>{responders.length}</Chip>}>
          <ul className="divide-y divide-ops-border/60">
            {responders.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    member.status === 'available' ? 'bg-emerald-400' : 'bg-ops-accent'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-ops-text">
                    {member.name}
                    {member.id === you?.id && <span className="ml-1.5 text-ops-accent">(you)</span>}
                  </p>
                  <p className="ops-label text-ops-faint">{member.unit}</p>
                </div>
                <span className="ops-label shrink-0 text-ops-muted">{member.status}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel label="Recently resolved" aside={<Chip tone="good">{recent.length}</Chip>}>
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-ops-muted">Nothing resolved yet this shift.</p>
          ) : (
            <ul className="divide-y divide-ops-border/60">
              {recent.map((incident) => (
                <li key={incident.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={incident.severity} compact />
                    <span className="ops-label ml-auto text-emerald-400">resolved</span>
                  </div>
                  <p className="mt-1 truncate text-[12px] text-ops-text">{incident.title}</p>
                  <p className="truncate text-[11px] text-ops-faint">{incident.location.label}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
