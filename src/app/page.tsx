import { CapabilityStrip } from '@/components/landing/CapabilityStrip'
import { FailurePoints } from '@/components/landing/FailurePoints'
import { Footer } from '@/components/landing/Footer'
import { Hero } from '@/components/landing/Hero'
import { LiveTour } from '@/components/landing/LiveTour'
import { Manifesto } from '@/components/landing/Manifesto'
import { ModuleGrid } from '@/components/landing/ModuleGrid'
import { NexbotShowcase } from '@/components/landing/NexbotShowcase'
import { SmoothScroll } from '@/components/landing/SmoothScroll'
import { CustomCursor } from '@/components/ui/CustomCursor'
import { LiquidGradient } from '@/components/ui/LiquidGradient'

/**
 * The AEGIS landing page: a cinematic scroll story built from the same design
 * tokens as the ops consoles it sells. Section order mirrors the pitch —
 * hook, problem, product, market, close.
 */
export default function LandingPage() {
  return (
    <SmoothScroll>
      {/* One WebGL instance for the whole page, fixed behind everything.
          z-0 rather than negative: the body's opaque background paints over
          negative-z children, which would bury the canvas entirely. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-60">
        <LiquidGradient className="h-full w-full" />
      </div>
      <CustomCursor />
      <main className="relative z-10">
        <Hero />
        <CapabilityStrip />
        <FailurePoints />
        <LiveTour />
        <ModuleGrid />
        <NexbotShowcase />
        <Manifesto />
      </main>
      <Footer />
    </SmoothScroll>
  )
}
