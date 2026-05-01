import TopNav from './features/layout/TopNav'
import { SideNav } from './features/layout/SideNav'
import { FocusCard } from './features/layout/FocusCard'
import { HowItWorksSection } from './features/site/HowItWorksSection'
import { AskAISection } from './features/site/AskAISection'
import { MedallionDemo } from './features/site/MedallionDemo'
import { HeroSection } from './features/site/HeroSection'
import { ContactCTA } from './features/site/ContactCTA'
import { useSiteContent } from './features/site/useSiteContent'

function App() {
  const baseUrl = import.meta.env.BASE_URL
  const content = useSiteContent(baseUrl)

  return (
    <main className="relative flex min-h-screen bg-zinc-950 text-zinc-100 lg:pl-64">
      <SideNav />

      <div className="pointer-events-none fixed inset-0 overflow-clip">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl flex-1 px-2 py-4 sm:px-4 lg:px-8 xl:px-10 2xl:px-14">
        <div className="lg:hidden py-4">
          <TopNav />
        </div>
        <FocusCard>
          <HeroSection content={content} />
        </FocusCard>
        <FocusCard>
          <AskAISection />
        </FocusCard>
        <FocusCard>
          <HowItWorksSection />
        </FocusCard>
        <FocusCard>
          <MedallionDemo defaultLayer="gold" />
        </FocusCard>
        <FocusCard>
          <ContactCTA />
        </FocusCard>
      </div>
    </main>
  )
}

export default App
