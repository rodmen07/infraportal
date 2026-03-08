import { ChangelogSection } from '../features/site/ChangelogSection'
import { RoadmapSection } from '../features/site/RoadmapSection'
import { TechSummarySection } from '../features/site/TechSummarySection'
import { useChangelogContent } from '../features/site/useChangelogContent'
import { useRoadmapContent } from '../features/site/useRoadmapContent'
import { PageLayout } from './PageLayout'

export function UpdatesPage() {
  const baseUrl = import.meta.env.BASE_URL
  const changelogContent = useChangelogContent(baseUrl)
  const roadmapContent = useRoadmapContent(baseUrl)

  return (
    <PageLayout title="Updates">
      <RoadmapSection content={roadmapContent} />
      <ChangelogSection content={changelogContent} />
      <TechSummarySection />
    </PageLayout>
  )
}
