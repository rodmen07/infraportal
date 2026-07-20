import { PageLayout } from './PageLayout'
import { AboutHero } from '../features/site/AboutHero'
import { AboutSection } from '../features/site/AboutSection'
import { HomeSections } from '../features/site/HomeSections'
import { ContactCTA } from '../features/site/ContactCTA'
import { useHomeSectionsContent } from '../features/site/useHomeSectionsContent'

export function AboutPage() {
  const baseUrl = import.meta.env.BASE_URL
  const homeSections = useHomeSectionsContent(baseUrl)

  return (
    <PageLayout>
      <AboutHero />
      <AboutSection />
      <HomeSections content={homeSections} />
      <ContactCTA />
    </PageLayout>
  )
}
