import { describeSlaClock } from '@/domain/queue'
import { readSla } from '@/domain/sla'
import type { Incident, Responder } from '@/domain/types'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { Chip, Panel, Stat } from '@/components/ui/Panel'

/** Enough of the board to stay oriented without becoming the control room. */
const BOARD_ROWS = 6

interface ContextRailProps {
  responders: readonly Responder[]
  /** Everything still open, newest ordering left to the caller. */
  openQueue: readonly Incident[]
  you: Responder | null
  /** True while this responder has work, which is when tracking runs. */
  tracking: boolean
  resolvedToday: number
  now: Date
  onSignIn: (responderId: string) => void
}

/**
 * Everything around the assignment: who you are, how the shift is going, and
 * what else is open.
 *
 * Deliberately a rail rather than a second console. A responder needs enough
 * of the board to stay oriented — and not so much that they start dispatching
 * themselves, which is the control room's job.
 */
export function ContextRail({
  responders,
  openQueue,
  you,
  tracking,
  resolvedToday,
  now,
  onSignIn,
}: ContextRailProps) {
  const available = responders.filter((item) => item.status === 'available').length

  return (
    <div className="flex flex-col gap-4">
      <Panel label="Signed in as">
        <div className="p-4">
          <select
            value={you?.id ?? ''}
            onChange={(event) => onSignIn(event.target.value)}
            className="tap w-full rounded-lg border border-ops-border bg-ops-bg px-3 py-2.5 text-[13px] text-ops-text focus:border-ops-accent/50 focus:outline-none"
          >
            {responders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {item.unit}
              </option>
            ))}
          </select>

          {you && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip tone={you.status === 'available' ? 'good' : 'accent'}>{you.status}</Chip>
              <Chip>{you.unit}</Chip>
              <Chip title="Position streams only while you have an assignment">
                {tracking ? 'tracking on' : 'tracking off'}
              </Chip>
            </div>
          )}
        </div>
      </Panel>

      <Panel label="Shift at a glance" spotlight>
        <div className="grid grid-cols-3 gap-3 p-4">
          <Stat value={openQueue.length} label="open board" tone={openQueue.length ? 'warn' : 'good'} />
          <Stat value={available} label="units free" tone="good" />
          <Stat value={resolvedToday} label="resolved" />
        </div>
      </Panel>

      <Panel
        label="Board"
        aside={<Chip tone={openQueue.length ? 'warn' : 'good'}>{openQueue.length} open</Chip>}
      >
        {openQueue.length === 0 ? (
          <p className="px-4 py-5 text-[12px] text-ops-muted">
            Board clear. Every SLA clock is stopped.
          </p>
        ) : (
          <ul className="divide-y divide-ops-border/60">
            {openQueue.slice(0, BOARD_ROWS).map((incident) => {
              const sla = readSla(incident, now)
              const mine = you !== null && incident.assignedResponderIds.includes(you.id)

              return (
                <li key={incident.id} className={`px-4 py-2.5 ${mine ? 'bg-ops-accent/5' : ''}`}>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={incident.severity} compact />
                    <span className="ops-label ml-auto text-ops-faint">
                      {describeSlaClock(sla.remainingMinutes)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[12px] text-ops-text">{incident.title}</p>
                  <p className="truncate text-[11px] text-ops-faint">{incident.location.label}</p>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
