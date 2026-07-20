import { PageLayout } from './PageLayout'
import { AboutHero } from '../features/site/AboutHero'
import { AboutSection } from '../features/site/AboutSection'
import { HomeSections } from '../features/site/HomeSections'
import { ContactCTA } from '../features/site/ContactCTA'
import { MotionPreferenceToggle } from '../features/site/MotionPreferenceToggle'
import { useHomeSectionsContent } from '../features/site/useHomeSectionsContent'

export function AboutPage() {
  const baseUrl = import.meta.env.BASE_URL
  const homeSections = useHomeSectionsContent(baseUrl)

  return (
    <PageLayout>
      <AboutHero />
      <AboutSection />
      {/* v1.18.3 (D6): relocated from the hero slide-over, see MotionPreferenceToggle.tsx */}
      <MotionPreferenceToggle />
      <HomeSections content={homeSections} />
      <ContactCTA />
    </PageLayout>
  )
}
