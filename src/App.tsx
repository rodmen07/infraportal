import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminDashboardSection } from './features/admin/AdminDashboardSection'
import { useAdminDashboard } from './features/admin/useAdminDashboard'
import { SessionPanel } from './features/auth/SessionPanel'
import { useAuthSession } from './features/auth/useAuthSession'
import { ProgressHud } from './features/layout/ProgressHud'
import { SideNav } from './features/layout/SideNav'
import { useScrollSpy } from './features/layout/useScrollSpy'
import type { ScrollMenuItem } from './features/layout/useScrollSpy'
import { CelebrationOverlay } from './features/tasks/CelebrationOverlay'
import { writingTierForPoints } from './features/tasks/useTaskManager'
import { ChangelogSection } from './features/site/ChangelogSection'
import { FaqSection } from './features/site/FaqSection'
import { HomeSections } from './features/site/HomeSections'
import { HowItWorksSection } from './features/site/HowItWorksSection'
import { IntegrationsSection } from './features/site/IntegrationsSection'
import { KeyboardShortcutsSection } from './features/site/KeyboardShortcutsSection'
import { QuickStartSection } from './features/site/QuickStartSection'
import { RoadmapSection } from './features/site/RoadmapSection'
import { SiteHeader } from './features/site/SiteHeader'
import { StatsSection } from './features/site/StatsSection'
import { TechSummarySection } from './features/site/TechSummarySection'
import { useChangelogContent } from './features/site/useChangelogContent'
import { useFaqContent } from './features/site/useFaqContent'
import { useHomeSectionsContent } from './features/site/useHomeSectionsContent'
import { useRoadmapContent } from './features/site/useRoadmapContent'
import { useSiteContent } from './features/site/useSiteContent'
import { ActivityFeedSection } from './features/activity-feed/ActivityFeedSection'
import { TaskManagerSection } from './features/tasks/TaskManagerSection'
import { useTaskManager } from './features/tasks/useTaskManager'

function App() {
  const baseUrl = import.meta.env.BASE_URL
  const cmsHref = `${baseUrl}admin/`
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const content = useSiteContent(baseUrl)
  const homeSections = useHomeSectionsContent(baseUrl)
  const faqContent = useFaqContent(baseUrl)
  const changelogContent = useChangelogContent(baseUrl)
  const roadmapContent = useRoadmapContent(baseUrl)
  const {
    session,
    isAuthenticated,
    authLoading,
    authBusy,
    authError,
    subjectInput,
    setSubjectInput,
    passwordInput,
    setPasswordInput,
    signIn,
    createUsername,
    signInWithOAuth,
    signOut,
  } = useAuthSession()

  const isAdmin = Boolean(session?.roles?.includes('admin'))
  const {
    metrics,
    requestLogs,
    userActivity,
    loading: adminLoading,
    error: adminError,
    loadAdminData,
  } = useAdminDashboard(isAuthenticated && isAdmin)
  const {
    tasks,
    taskTitle,
    taskDifficulty,
    taskGoal,
    tasksLoading,
    taskError,
    submitting,
    workingTaskId,
    goalInput,
    plannedTaskDifficulty,
    plannedTaskCount,
    plannedTaskFeedback,
    plannedTasks,
    planning,
    creatingPlanTasks,
    deletingAllTasks,
    plannerStatus,
    storyPoints,
    goalProgress,
    pendingCount,
    clearingGoal,
    setTaskTitle,
    setTaskDifficulty,
    setTaskGoal,
    setGoalInput,
    setPlannedTaskDifficulty,
    setPlannedTaskCount,
    setPlannedTaskFeedback,
    loadTasks,
    handleCreateTask,
    handleSetTaskDifficulty,
    handleUpdateTaskStatus,
    handleToggleTask,
    handleDeleteTask,
    handleDeleteAllTasks,
    handleGeneratePlan,
    handleCreatePlannedTasks,
    handleResetGeneratedPlan,
    handleRemovePlannedTask,
    handleRegeneratePlan,
    handleClearPlanTasks,
    handleUpdateTaskTitle,
    handleUpdateTaskDueDate,
  } = useTaskManager(isAuthenticated)

  // Celebration state
  const [celebrationTrigger, setCelebrationTrigger] = useState(0)
  const [celebrationMessage, setCelebrationMessage] = useState('')
  const prevStoryPointsRef = useRef<number | null>(null)
  const prevTierRef = useRef<string | null>(null)
  const prevGoalProgressRef = useRef<string>('')

  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks])
  const hasAnyTask = tasks.length > 0
  const hasAiTask = tasks.some((t) => t.source === 'ai_generated')
  const hasCompletedTask = tasks.some((t) => t.completed)
  const completionPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0
  const pendingLabel = Math.max(tasks.length - completedCount, 0)

  // Fire celebration when tier increases or a goal reaches 100%
  useEffect(() => {
    if (tasksLoading) {
      // Initialize refs on first load without celebrating
      prevStoryPointsRef.current = storyPoints
      prevTierRef.current = writingTierForPoints(storyPoints)
      prevGoalProgressRef.current = JSON.stringify(goalProgress)
      return
    }

    const currentTier = writingTierForPoints(storyPoints)

    if (prevTierRef.current !== null && prevTierRef.current !== currentTier) {
      setCelebrationMessage(`Tier up! You reached ${currentTier}!`)
      setCelebrationTrigger((n) => n + 1)
    } else if (prevStoryPointsRef.current !== null && storyPoints > prevStoryPointsRef.current) {
      // Points increased but no tier change — still celebrate task completion
      setCelebrationMessage('')
      setCelebrationTrigger((n) => n + 1)
    }

    // Check for newly completed goals (100%)
    const prevGoals: typeof goalProgress = JSON.parse(prevGoalProgressRef.current || '[]')
    for (const current of goalProgress) {
      if (current.total > 0 && current.completed === current.total) {
        const prev = prevGoals.find((g) => g.goal === current.goal)
        if (!prev || prev.completed < prev.total) {
          setCelebrationMessage(`Goal complete: "${current.goal}"`)
          setCelebrationTrigger((n) => n + 1)
          break
        }
      }
    }

    prevStoryPointsRef.current = storyPoints
    prevTierRef.current = currentTier
    prevGoalProgressRef.current = JSON.stringify(goalProgress)
  }, [storyPoints, goalProgress, tasksLoading])

  const menuItems = useMemo<ScrollMenuItem[]>(() => {
    const items: ScrollMenuItem[] = [
      { id: 'hero', label: 'Overview' },
      { id: 'session', label: 'Session' },
      { id: 'quick-start', label: 'Quick Start' },
      { id: 'how-it-works', label: 'How It Works' },
      { id: 'task-manager', label: 'Task Manager' },
      { id: 'stats', label: 'Stats' },
      { id: 'sections', label: 'Highlights' },
      { id: 'integrations', label: 'Integrations' },
      { id: 'roadmap', label: 'Roadmap' },
    ]

    if (isAuthenticated) {
      items.splice(items.findIndex((i) => i.id === 'sections'), 0, {
        id: 'activity-feed',
        label: 'Activity Feed',
      })
    }

    if (isAuthenticated && isAdmin) {
      items.push({ id: 'admin-dashboard', label: 'Admin Dashboard' })
    }

    items.push({ id: 'changelog', label: 'Changelog' })
    items.push({ id: 'shortcuts', label: 'Shortcuts' })
    items.push({ id: 'tech-summary', label: 'Tech Summary' })
    items.push({ id: 'faq', label: 'FAQ' })
    items.push({ id: 'architecture-link', label: 'Architecture', isExternal: true, href: '#/architecture' })
    items.push({ id: 'api-link', label: 'API Reference', isExternal: true, href: '#/api' })

    if (isAuthenticated) {
      items.push({ id: 'accounts-link', label: 'Accounts', isExternal: true, href: '#/accounts' })
      items.push({ id: 'contacts-link', label: 'Contacts', isExternal: true, href: '#/contacts' })
    }

    if (isAuthenticated && isAdmin) {
      items.push({ id: 'cms-link', label: 'Open CMS', isExternal: true, href: cmsHref })
    }

    return items
  }, [cmsHref, isAdmin, isAuthenticated])

  const { activeSectionId, sectionStateClass, handleMenuJump } = useScrollSpy(menuItems)

  return (
    <>
    <CelebrationOverlay trigger={celebrationTrigger} message={celebrationMessage} />
    <main className="forge-grid relative min-h-screen bg-zinc-950 px-2 py-6 text-zinc-100 sm:px-4 sm:py-8 lg:px-8 xl:px-10 2xl:px-14">
      <div className="pointer-events-none absolute inset-0 overflow-clip">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[2200px] flex-col gap-6">
        <ProgressHud
          completionPercent={completionPercent}
          completedCount={completedCount}
          pendingLabel={pendingLabel}
          isAuthenticated={isAuthenticated}
          currentSubject={session?.subject || ''}
        />

        <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
          <SideNav menuItems={menuItems} activeSectionId={activeSectionId} onMenuJump={handleMenuJump} />

          <div className="space-y-6">
            <div id="hero" className={sectionStateClass('hero')}>
              <SiteHeader content={content} />
            </div>

            <div id="session" className={sectionStateClass('session')}>
              <SessionPanel
                isAuthenticated={isAuthenticated}
                authLoading={authLoading}
                authBusy={authBusy}
                authError={authError}
                subjectInput={subjectInput}
                passwordInput={passwordInput}
                currentSubject={session?.subject || ''}
                currentRoles={session?.roles || []}
                onSubjectInputChange={setSubjectInput}
                onPasswordInputChange={setPasswordInput}
                onSignIn={signIn}
                onCreateUsername={createUsername}
                onSignInWithGitHub={() => signInWithOAuth('github')}
                onSignInWithGoogle={() => signInWithOAuth('google')}
                onSignOut={signOut}
              />
            </div>

            <div id="quick-start" className={sectionStateClass('quick-start')}>
              <QuickStartSection
                isAuthenticated={isAuthenticated}
                hasAnyTask={hasAnyTask}
                hasAiTask={hasAiTask}
                hasCompletedTask={hasCompletedTask}
              />
            </div>

            <div id="how-it-works" className={sectionStateClass('how-it-works')}>
              <HowItWorksSection />
            </div>

            <div id="task-manager" className={sectionStateClass('task-manager')}>
              <TaskManagerSection
                authLocked={!isAuthenticated}
                pendingCount={pendingCount}
                storyPoints={storyPoints}
                goalProgress={goalProgress}
                tasksLoading={tasksLoading}
                taskError={taskError}
                goalInput={goalInput}
                plannedTaskDifficulty={plannedTaskDifficulty}
                plannedTaskCount={plannedTaskCount}
                plannedTaskFeedback={plannedTaskFeedback}
                planning={planning}
                creatingPlanTasks={creatingPlanTasks}
                deletingAllTasks={deletingAllTasks}
                plannerStatus={plannerStatus}
                plannedTasks={plannedTasks}
                taskTitle={taskTitle}
                taskDifficulty={taskDifficulty}
                taskGoal={taskGoal}
                submitting={submitting}
                tasks={tasks}
                workingTaskId={workingTaskId}
                clearingGoal={clearingGoal}
                onRefresh={loadTasks}
                onGoalInputChange={setGoalInput}
                onPlannedTaskDifficultyChange={setPlannedTaskDifficulty}
                onPlannedTaskCountChange={setPlannedTaskCount}
                onPlannedTaskFeedbackChange={setPlannedTaskFeedback}
                onGeneratePlan={handleGeneratePlan}
                onRegeneratePlan={handleRegeneratePlan}
                onRemovePlannedTask={handleRemovePlannedTask}
                onCreatePlannedTasks={handleCreatePlannedTasks}
                onTaskTitleChange={setTaskTitle}
                onTaskDifficultyChange={setTaskDifficulty}
                onTaskGoalChange={setTaskGoal}
                onCreateTask={handleCreateTask}
                onSetTaskDifficulty={handleSetTaskDifficulty}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onDeleteAllTasks={handleDeleteAllTasks}
                onUpdateTaskStatus={handleUpdateTaskStatus}
                onResetGeneratedPlan={handleResetGeneratedPlan}
                onClearPlanTasks={handleClearPlanTasks}
                onUpdateTaskTitle={handleUpdateTaskTitle}
                onUpdateTaskDueDate={handleUpdateTaskDueDate}
              />
            </div>

            <div id="stats" className={sectionStateClass('stats')}>
              <StatsSection
                isAuthenticated={isAuthenticated}
                isAdmin={isAdmin}
                tasks={tasks}
                storyPoints={storyPoints}
                pendingCount={pendingCount}
                metrics={metrics}
              />
            </div>

            {isAuthenticated && (
              <div id="activity-feed" className={sectionStateClass('activity-feed')}>
                <ActivityFeedSection
                  tasks={tasks}
                  token={session?.accessToken ?? ''}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            )}

            <div id="sections" className={sectionStateClass('sections')}>
              <HomeSections content={homeSections} />
            </div>

            <div id="integrations" className={sectionStateClass('integrations')}>
              <IntegrationsSection />
            </div>

            <div id="roadmap" className={sectionStateClass('roadmap')}>
              <RoadmapSection content={roadmapContent} />
            </div>

            {isAuthenticated && isAdmin && (
              <div id="admin-dashboard" className={sectionStateClass('admin-dashboard')}>
                <AdminDashboardSection
                  loading={adminLoading}
                  error={adminError}
                  metrics={metrics}
                  requestLogs={requestLogs}
                  userActivity={userActivity}
                  onRefresh={() => {
                    void loadAdminData()
                  }}
                />
              </div>
            )}

            <div id="changelog" className={sectionStateClass('changelog')}>
              <ChangelogSection content={changelogContent} />
            </div>

            <div id="shortcuts" className={sectionStateClass('shortcuts')}>
              <KeyboardShortcutsSection />
            </div>

            <div id="tech-summary" className={sectionStateClass('tech-summary')}>
              <TechSummarySection />
            </div>

            <div id="faq" className={sectionStateClass('faq')}>
              <FaqSection content={faqContent} />
            </div>
          </div>
        </div>

        {showBackToTop && (
          <button
            type="button"
            className="fixed bottom-6 right-6 z-50 rounded-full border border-zinc-400/40 bg-zinc-900/85 px-4 py-3 text-xs font-semibold text-zinc-100 shadow-lg shadow-black/40 backdrop-blur transition hover:-translate-y-0.5 hover:bg-zinc-800"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            ↑ Top
          </button>
        )}
      </div>
    </main>
    </>
  )
}

export default App
