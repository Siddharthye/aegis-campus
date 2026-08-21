'use client'

import { useRef, useState } from 'react'
import { MAX_EVIDENCE_ITEMS, describeByteSize, type EvidenceItem } from '@/domain/evidence'
import { prepareEvidence } from './prepare-evidence'

interface EvidencePickerProps {
  evidence: EvidenceItem[]
  onChange: (evidence: EvidenceItem[]) => void
}

/**
 * Optional photo attachment on the report flow.
 *
 * Sits on the review step, never in the fast path — someone reporting a fire
 * should be able to send in three taps without ever meeting a file picker.
 */
export function EvidencePicker({ evidence, onChange }: EvidencePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [rejected, setRejected] = useState(false)

  const addFiles = async (files: FileList) => {
    setBusy(true)
    setRejected(false)

    try {
      const room = MAX_EVIDENCE_ITEMS - evidence.length
      const prepared = await Promise.all(Array.from(files).slice(0, room).map(prepareEvidence))
      const accepted = prepared.filter((item): item is EvidenceItem => item !== null)

      if (accepted.length < prepared.length) setRejected(true)
      if (accepted.length > 0) onChange([...evidence, ...accepted])
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const atCapacity = evidence.length >= MAX_EVIDENCE_ITEMS

  return (
    <div className="mt-3 border-t border-ops-border pt-3">
      <p className="ops-label text-ops-muted">Photo (optional)</p>

      {evidence.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {evidence.map((item) => (
            <li key={item.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a browser-generated data: URL; next/image cannot optimise it. */}
              <img
                src={item.dataUrl}
                alt="Attached evidence"
                className="size-20 rounded-md border border-ops-border object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(evidence.filter((other) => other.id !== item.id))}
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-ops-border bg-ops-panel text-[11px] text-ops-muted transition-colors hover:text-sev-p0"
              >
                ×
              </button>
              <span className="ops-label mt-0.5 block text-center text-ops-faint">
                {describeByteSize(item.byteSize)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!atCapacity && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files)
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="mt-2 rounded-md border border-ops-border px-3 py-1.5 text-[12px] text-ops-muted transition-colors hover:border-ops-accent/40 hover:text-ops-text disabled:opacity-50"
          >
            {busy ? 'Processing…' : evidence.length === 0 ? 'Add a photo' : 'Add another'}
          </button>
        </>
      )}

      {rejected && (
        <p className="mt-1.5 text-[11px] text-sev-p1">
          One or more files were skipped — images only, and each must fit after compression.
        </p>
      )}

      <p className="mt-1.5 text-[11px] leading-relaxed text-ops-faint">
        Photos are resized and re-encoded on your device before sending, which removes the
        location and camera data your phone embeds. Only the picture itself leaves this screen.
      </p>
    </div>
  )
}
