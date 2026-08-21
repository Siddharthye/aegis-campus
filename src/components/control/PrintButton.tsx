'use client'

/**
 * Hands the document to the browser's own print dialogue, where "Save as PDF"
 * is a destination. That is why AEGIS ships no PDF library: the capability is
 * already installed on every machine a buyer owns.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hide rounded-md border border-ops-accent/40 bg-ops-accent/10 px-3 py-1.5 text-[12px] font-medium text-ops-accent transition-colors hover:bg-ops-accent/20"
    >
      Print / Save PDF
    </button>
  )
}
