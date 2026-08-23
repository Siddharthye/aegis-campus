import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { ServiceWorkerRegistrar } from '@/components/ops/ServiceWorkerRegistrar'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { Dock } from '@/components/ui/Dock'
import { IdentityGate } from '@/components/ui/IdentityGate'
import './globals.css'

/* next/font downloads at build time and self-hosts — no runtime font requests,
   so typography survives a venue with no wifi. */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' })
/* Display face for marketing headlines only; ops screens stay on Inter. */
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' })

const DESCRIPTION =
  'Report in three taps. Locate to the room. Fuse fifty duplicate reports into one incident. Dispatch the nearest responder with a live SLA clock. Every second, accounted for.'

export const metadata: Metadata = {
  /* Absolute URLs for the share card. Without this the generated Open Graph
     image resolves relative and most scrapers drop it. */
  metadataBase: new URL('https://aegis-campus.vercel.app'),
  title: {
    default: 'AEGIS — Campus Emergency Response OS',
    /* Inner pages set a bare name; the product name is appended here rather
       than repeated in ten files. */
    template: '%s — AEGIS',
  },
  description: DESCRIPTION,
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'AEGIS', statusBarStyle: 'black-translucent' },
  /* This link gets pasted into chats and submission forms far more than it
     gets typed, so the card it unfurls into is part of the product. */
  openGraph: {
    type: 'website',
    siteName: 'AEGIS',
    title: 'AEGIS — Campus Emergency Response OS',
    description: DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AEGIS — Campus Emergency Response OS',
    description: DESCRIPTION,
  },
}

/* Installable as a home-screen app, so a student reaches the report screen in
   one tap and it still opens where there is no signal. */
export const viewport: Viewport = {
  themeColor: '#08070c',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen antialiased">
        {/* First stop in the tab order. Every screen carries a dock, a
            command palette and a header before its content, which is a long
            way to tab past on each page. Hidden until focused. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:border focus:border-ops-accent/40 focus:bg-ops-panel focus:px-4 focus:py-2.5 focus:text-[13px] focus:font-semibold focus:text-ops-accent"
        >
          Skip to content
        </a>
        {children}
        <Dock />
        <IdentityGate />
        <CommandPalette />
        {/* Static film grain over everything — texture, not animation. */}
        <div aria-hidden className="grain-overlay print-hide" />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
