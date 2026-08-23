import { estimateArrival } from '@/domain/dispatch'
import type { Incident, Responder } from '@/domain/types'
import { Chip, Panel } from '@/components/ui/Panel'

interface CrewPanelProps {
  incident: Incident
  crew: readonly Responder[]
  /** Marks whichever row is the person reading the screen. */
  youId: string | null
}

/**
 * Who else is coming, and how far out they are.
 *
 * A responder walking into an incident alone behaves differently from one who
 * knows two more units are ninety seconds behind them, so this sits beside the
 * assignment rather than behind a tab.
 */
export function CrewPanel({ incident, crew, youId }: CrewPanelProps) {
  const onScene = incident.status === 'on-scene'

  return (
    <Panel label="Crew on this incident" aside={<Chip tone="accent">{crew.length}</Chip>}>
      <ul className="divide-y divide-ops-border/60">
        {crew.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className={`size-1.5 shrink-0 rounded-full ${onScene ? 'bg-emerald-400' : 'siren-pulse bg-ops-accent'}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-ops-text">
                {member.name}
                {member.id === youId && <span className="ml-1.5 text-ops-accent">(you)</span>}
              </p>
              <p className="ops-label text-ops-faint">{member.unit}</p>
            </div>
            <span className="ops-label shrink-0 text-ops-muted">
              {onScene ? 'on scene' : `${estimateArrival(member.location, incident.location).etaMinutes}m out`}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
