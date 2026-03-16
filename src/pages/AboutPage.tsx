import { PageLayout } from './PageLayout'
import { AboutSection } from '../features/site/AboutSection'
import { HomeSections } from '../features/site/HomeSections'
import { useHomeSectionsContent } from '../features/site/useHomeSectionsContent'

export function AboutPage() {
  const baseUrl = import.meta.env.BASE_URL
  const homeSections = useHomeSectionsContent(baseUrl)

  return (
    <PageLayout>
      <AboutSection />
      <HomeSections content={homeSections} />
    </PageLayout>
  )
}
