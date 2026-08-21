import { CapabilityStrip } from '@/components/landing/CapabilityStrip'
import { FailurePoints } from '@/components/landing/FailurePoints'
import { Footer } from '@/components/landing/Footer'
import { Hero } from '@/components/landing/Hero'
import { LiveTour } from '@/components/landing/LiveTour'
import { Manifesto } from '@/components/landing/Manifesto'
import { ModuleGrid } from '@/components/landing/ModuleGrid'
import { NexbotShowcase } from '@/components/landing/NexbotShowcase'
import { SmoothScroll } from '@/components/landing/SmoothScroll'
import { Nexbot } from '@/components/nexbot/Nexbot'

/**
 * The AEGIS landing page: a cinematic scroll story built from the same design
 * tokens as the ops consoles it sells. Section order mirrors the pitch —
 * hook, problem, product, market, close.
 */
export default function LandingPage() {
  return (
    <SmoothScroll>
      <main>
        <Hero />
        <CapabilityStrip />
        <FailurePoints />
        <LiveTour />
        <ModuleGrid />
        <NexbotShowcase />
        <Manifesto />
      </main>
      <Footer />
      <Nexbot />
    </SmoothScroll>
  )
}
