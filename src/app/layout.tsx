import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

/* next/font downloads at build time and self-hosts — no runtime font requests,
   so typography survives a venue with no wifi. */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' })

export const metadata: Metadata = {
  title: 'AEGIS — Campus Emergency Response OS',
  description:
    'Report in three taps. Locate to the room. Fuse fifty duplicate reports into one incident. Dispatch the nearest responder with a live SLA clock. Every second, accounted for.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
