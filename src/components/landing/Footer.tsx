import Link from 'next/link'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/report', label: 'Report an incident' },
      { href: '/control', label: 'Control room' },
      { href: '/respond', label: 'Responder view' },
      { href: '/analytics', label: 'PULSE analytics' },
      { href: '/beacon', label: 'BEACON anchor sheets' },
      { href: '/case', label: 'Check a case' },
    ],
  },
  {
    // Repo links, not localhost: a footer on a deployed site must not point at
    // a port only the developer has running.
    title: 'Modules for sale',
    links: [
      { href: 'https://github.com/Siddharthye/siren-alerts', label: 'SIREN — alerts' },
      { href: 'https://github.com/Siddharthye/atlas-incident-map', label: 'ATLAS — map + triage' },
      { href: 'https://github.com/Siddharthye/fusion-reports', label: 'FUSION — report fusion' },
      { href: '/wanted', label: 'What we will buy' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-ops-border/60 bg-ops-bg/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-mono text-sm font-bold tracking-widest">AEGIS</p>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ops-muted">
            Campus Emergency Response OS. Built for HACQUIRE 2026 by Team PROMPT &amp; PRAY —
            and built to be bought: three of its six modules are listed on the floor.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title}>
            <p className="ops-label text-ops-faint">{column.title}</p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-ops-muted transition-colors hover:text-ops-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-ops-border/40 pb-24">
        <p className="ops-label mx-auto max-w-6xl px-6 py-5 text-ops-faint">
          HA-040-7800 · BUILD. BUY. SELL. EXIT.
        </p>
      </div>
    </footer>
  )
}
