import { PageLayout } from './PageLayout'

interface GuideSection {
  id: string
  icon: string
  heading: string
  content: string[]
  tips?: string[]
}

const SECTIONS: GuideSection[] = [
  {
    id: 'getting-started',
    icon: '🔑',
    heading: 'Getting started',
    content: [
      'Open the Session panel and enter a username. Usernames are short, memorable identifiers — no email or password needed. Click Sign In to create or resume your workspace.',
      'Your story points and tier progress are stored against your username in the browser. Signing in with the same username on any device restores your progress as long as the local storage is intact.',
    ],
    tips: [
      'Pick a username you\'ll remember — it\'s how your progress is identified.',
      'Admin accounts have an additional Sign In Admin button. Admin access unlocks the dashboard and CMS.',
    ],
  },
  {
    id: 'ai-planner',
    icon: '🤖',
    heading: 'AI planner',
    content: [
      'The AI planner turns a short-term goal into a focused, actionable task list. Type your goal (up to 500 characters) in the Goal field, pick a default difficulty, then click Generate.',
      'The planner sends your goal plus your existing task titles to the AI so it can avoid duplicates and stay contextually aware. A preview list appears — review it before committing. Nothing is saved until you click Create All Planned Tasks.',
      'If the plan isn\'t right, click Discard and try rephrasing your goal. The planner is good at concrete, time-boxed goals like "Prepare Q3 report" or "Refactor the auth module".',
    ],
    tips: [
      'Be specific. "Write the onboarding section of the user guide" works better than "write docs".',
      'Set a goal name in the Goal field before generating — tasks will be grouped under that goal in the Goal Tracking panel.',
      'Hit rate limits? Wait a moment and try again — the planner has per-user rate limiting to keep things fair.',
    ],
  },
  {
    id: 'managing-tasks',
    icon: '📋',
    heading: 'Managing tasks',
    content: [
      'Every task has a title, difficulty (1–6 SP), optional goal, and a status (To Do, In Progress, Done). You can create tasks manually using the form at the top of the Task Manager.',
      'Switch between Board view (Kanban) and List view using the toggle. The board lets you drag cards between columns. The list view is better for scanning many tasks at once.',
      'Mark a task Done by dragging it to the Done column, using the status dropdown, or clicking the toggle. Completing a task awards its difficulty rating in story points.',
    ],
    tips: [
      'Completed tasks show a strikethrough and move to Done — they still count toward goal progress.',
      'AI-generated tasks show a purple "AI" badge so you can tell them apart from manual ones.',
      'Delete individual tasks with the trash icon, or use Delete All to wipe the board and start fresh.',
    ],
  },
  {
    id: 'goal-tracking',
    icon: '🎯',
    heading: 'Goal tracking',
    content: [
      'Any task with a goal assigned shows up in the Goal Tracking panel at the bottom of the Task Manager. Each goal shows a progress bar (completed / total tasks) and how many AI-generated tasks remain.',
      'Click Clear AI (N) next to a goal to remove only that goal\'s AI-generated tasks. Manually created tasks for the same goal are unaffected. This is useful when priorities shift mid-sprint.',
    ],
    tips: [
      'Use consistent goal names — "Q3 Report" and "q3 report" are treated as separate goals.',
      'Goal progress bars fill in real time as you complete tasks — no page refresh needed.',
    ],
  },
  {
    id: 'story-points-tiers',
    icon: '⚡',
    heading: 'Story points & tiers',
    content: [
      'Completing a task awards story points equal to its difficulty rating. For example, completing a difficulty-4 task earns 4 SP. Points accumulate per username across sessions.',
      'There are five writing tiers: Poem (0 SP), Paragraph (6 SP), Short Story (15 SP), Novel (30 SP), and Epic (50 SP). Your current tier and total points appear in the progress bar at the top of the page.',
      'Accepting an AI-generated plan for the first time also earns a one-time bonus. The more ambitious your goals, the faster you\'ll climb.',
    ],
    tips: [
      'Rate tasks honestly. A task that takes you three hours is not a 1.',
      'Visit the Tiers page for the full difficulty table and tier descriptions.',
    ],
  },
  {
    id: 'cms',
    icon: '🛠️',
    heading: 'Content management (admin)',
    content: [
      'Admins can edit the site header, Highlights cards, and FAQ through the CMS at /admin. The CMS uses Decap CMS backed by the same repository. Changes are written to JSON files in the public/content directory.',
      'After saving in the CMS, a page reload will pick up the latest content. In a CI/CD pipeline, CMS saves trigger a build and redeploy automatically.',
    ],
    tips: [
      'Only users with the admin role can see the Open CMS link in the side nav and access the Admin Dashboard.',
    ],
  },
]

export function GuidePage() {
  return (
    <PageLayout title="TaskForge Guide">
      {/* Table of contents */}
      <section className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Contents</h2>
        <ul className="space-y-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#guide-${s.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800/60 hover:text-white"
              >
                <span>{s.icon}</span>
                {s.heading}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Guide sections */}
      {SECTIONS.map((s) => (
        <section
          key={s.id}
          id={`guide-${s.id}`}
          className="scroll-mt-6 rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <span>{s.icon}</span>
            {s.heading}
          </h2>
          <div className="space-y-3">
            {s.content.map((para) => (
              <p key={para} className="text-sm leading-relaxed text-zinc-300">
                {para}
              </p>
            ))}
          </div>
          {s.tips && (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/8 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">Tips</p>
              <ul className="space-y-1.5">
                {s.tips.map((tip) => (
                  <li key={tip} className="flex gap-2 text-sm text-zinc-300">
                    <span className="mt-0.5 shrink-0 text-amber-400">›</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}

      {/* Back CTA */}
      <div className="text-center">
        <a
          href="#/"
          className="inline-block rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100"
        >
          ← Back to home
        </a>
      </div>
    </PageLayout>
  )
}
