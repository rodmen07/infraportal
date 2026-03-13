import TopNav from './features/layout/TopNav'
import { SideNav } from './features/layout/SideNav'
import { HomeSections } from './features/site/HomeSections'
import { HowItWorksSection } from './features/site/HowItWorksSection'
import { BuildStatusSection } from './features/site/BuildStatusSection'
import { MedallionDemo } from './features/site/MedallionDemo'
import { HeroSection } from './features/site/HeroSection'
import { AboutSection } from './features/site/AboutSection'
import { ContactCTA } from './features/site/ContactCTA'
import { useHomeSectionsContent } from './features/site/useHomeSectionsContent'
import { useSiteContent } from './features/site/useSiteContent'

function App() {
  const baseUrl = import.meta.env.BASE_URL
  const content = useSiteContent(baseUrl)
  const homeSections = useHomeSectionsContent(baseUrl)

  return (
    <main className="forge-grid relative min-h-screen bg-zinc-950 px-2 py-6 text-zinc-100 sm:px-4 sm:py-8 lg:px-8 lg:pl-64 xl:px-10 2xl:px-14">
      <SideNav />

      <div className="pointer-events-none absolute inset-0 overflow-clip">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="lg:hidden">
          <TopNav />
        </div>
        <HeroSection content={content} />
        <HomeSections content={homeSections} />
        <AboutSection />
        <HowItWorksSection />
        <MedallionDemo defaultLayer="gold" />
        <BuildStatusSection />
        <ContactCTA />
      </div>
    </main>
  )
}

export default App
