import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ServiceWorkerRegistrar } from '@/components/ops/ServiceWorkerRegistrar'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { Dock } from '@/components/ui/Dock'
import './globals.css'

/* next/font downloads at build time and self-hosts — no runtime font requests,
   so typography survives a venue with no wifi. */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' })

export const metadata: Metadata = {
  title: 'AEGIS — Campus Emergency Response OS',
  description:
    'Report in three taps. Locate to the room. Fuse fifty duplicate reports into one incident. Dispatch the nearest responder with a live SLA clock. Every second, accounted for.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'AEGIS', statusBarStyle: 'black-translucent' },
}

/* Installable as a home-screen app, so a student reaches the report screen in
   one tap and it still opens where there is no signal. */
export const viewport: Viewport = {
  themeColor: '#05070d',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen antialiased">
        {children}
        <Dock />
        <CommandPalette />
        {/* Static film grain over everything — texture, not animation. */}
        <div aria-hidden className="grain-overlay print-hide" />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
