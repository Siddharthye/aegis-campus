import type { BlockKind } from '@/data/campus25'
import { BLOCK_STYLE } from './BlocksLayer'

const LEGEND_KINDS: BlockKind[] = ['academic', 'admin', 'amenity', 'utility']

/** Without this the coloured marks are decoration, not information. */
export function MapLegend({ showRisk }: { showRisk: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-lg border border-ops-border/60 bg-ops-bg/40 px-3 py-2">
      {LEGEND_KINDS.map((kind) => (
        <LegendItem key={kind} label={BLOCK_STYLE[kind].label}>
          <span
            className="size-2.5 rounded-[2px] border"
            style={{ background: BLOCK_STYLE[kind].fill, borderColor: BLOCK_STYLE[kind].stroke }}
          />
        </LegendItem>
      ))}

      <LegendItem label="Gate">
        <span className="size-2.5 rounded-[2px] border border-ops-accent bg-[#0a1a28]" />
      </LegendItem>
      <LegendItem label="Muster point">
        <span className="size-2.5 rounded-full border border-emerald-400/60 bg-emerald-400/20" />
      </LegendItem>
      <LegendItem label="Quiet route">
        <span className="h-[3px] w-5 rounded-full bg-emerald-400" />
      </LegendItem>

      {/* Only once a risk snapshot has loaded: a key to colours that are not
          on the map yet is a key to nothing. */}
      {showRisk && (
        <>
          <LegendItem label="Some reports">
            <span className="h-[3px] w-5 rounded-full bg-sev-p2" />
          </LegendItem>
          <LegendItem label="Avoid if you can">
            <span className="h-[3px] w-5 rounded-full bg-sev-p0" />
          </LegendItem>
          <LegendItem label="Reported-risk area">
            <span className="size-2.5 rounded-full bg-sev-p0/40" />
          </LegendItem>
        </>
      )}

      <LegendItem label="Unlit (dashed)">
        <span className="h-[3px] w-5 rounded-full bg-sev-p1/70" />
      </LegendItem>
      <LegendItem label="Live walk">
        <span className="size-2.5 rounded-full bg-ops-accent" />
      </LegendItem>
    </div>
  )
}

function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {children}
      <span className="ops-label text-ops-faint">{label}</span>
    </span>
  )
}
