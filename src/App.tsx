import { useEffect } from 'react'
import TopNav from './features/layout/TopNav'
import { SideNav } from './features/layout/SideNav'
import { FocusCard } from './features/layout/FocusCard'
import { HowItWorksSection } from './features/site/HowItWorksSection'
import { BuildStatusSection } from './features/site/BuildStatusSection'
import { AskAISection } from './features/site/AskAISection'
import { MedallionDemo } from './features/site/MedallionDemo'
import { HeroSection } from './features/site/HeroSection'
import { ContactCTA } from './features/site/ContactCTA'
import { useSiteContent } from './features/site/useSiteContent'

function App() {
  const baseUrl = import.meta.env.BASE_URL
  const content = useSiteContent(baseUrl)

  useEffect(() => {
    let rafId = 0
    let isSnapping = false

    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    function snapTo(targetY: number) {
      const startY = window.scrollY
      const distance = targetY - startY
      if (Math.abs(distance) < 4) return
      const duration = 850
      const startTime = performance.now()
      isSnapping = true
      cancelAnimationFrame(rafId)
      function step(now: number) {
        const t = Math.min((now - startTime) / duration, 1)
        window.scrollTo(0, startY + distance * easeInOutCubic(t))
        if (t < 1) {
          rafId = requestAnimationFrame(step)
        } else {
          isSnapping = false
        }
      }
      rafId = requestAnimationFrame(step)
    }

    function findNearest(): HTMLElement | null {
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>('.focus-card-section')
      )
      if (!sections.length) return null
      const mid = window.innerHeight / 2
      return sections.reduce((best, el) => {
        const r = el.getBoundingClientRect()
        const br = best.getBoundingClientRect()
        const d = Math.abs(r.top + r.height / 2 - mid)
        const bd = Math.abs(br.top + br.height / 2 - mid)
        return d < bd ? el : best
      })
    }

    function onScrollEnd() {
      if (isSnapping) return
      const el = findNearest()
      if (!el) return
      const r = el.getBoundingClientRect()
      const target = window.scrollY + (r.top + r.height / 2 - window.innerHeight / 2)
      snapTo(target)
    }

    // scrollend fires after all momentum has settled — ideal for snap-on-release
    window.addEventListener('scrollend', onScrollEnd, { passive: true })
    return () => {
      window.removeEventListener('scrollend', onScrollEnd)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <main className="forge-grid relative bg-zinc-950 px-2 text-zinc-100 sm:px-4 lg:px-8 lg:pl-64 xl:px-10 2xl:px-14">
      <SideNav />

      <div className="pointer-events-none fixed inset-0 overflow-clip">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />
      </div>

      {/* perspective here = shared vanishing point for all FocusCards (one cylinder) */}
      <div
        className="relative mx-auto flex w-full max-w-5xl flex-col"
        style={{ perspective: '1200px' }}
      >
        <div className="lg:hidden py-4">
          <TopNav />
        </div>
        <FocusCard>
          <HeroSection content={content} />
        </FocusCard>
        <FocusCard>
          <MedallionDemo defaultLayer="gold" />
        </FocusCard>
        <FocusCard>
          <BuildStatusSection />
        </FocusCard>
        <FocusCard>
          <AskAISection />
        </FocusCard>
        <FocusCard>
          <HowItWorksSection />
        </FocusCard>
        <FocusCard>
          <ContactCTA />
        </FocusCard>
      </div>
    </main>
  )
}

export default App
