import { useEffect, useMemo, useState } from 'react'
import { AdminDashboardSection } from './features/admin/AdminDashboardSection'
import { useAdminDashboard } from './features/admin/useAdminDashboard'
import { SessionPanel } from './features/auth/SessionPanel'
import { useAuthSession } from './features/auth/useAuthSession'
import { ProgressHud } from './features/layout/ProgressHud'
import { SideNav } from './features/layout/SideNav'
import { useScrollSpy } from './features/layout/useScrollSpy'
import type { ScrollMenuItem } from './features/layout/useScrollSpy'
import { FaqSection } from './features/site/FaqSection'
import { HomeSections } from './features/site/HomeSections'
import { HowItWorksSection } from './features/site/HowItWorksSection'
import { QuickStartSection } from './features/site/QuickStartSection'
import { SiteHeader } from './features/site/SiteHeader'
import { useFaqContent } from './features/site/useFaqContent'
import { useHomeSectionsContent } from './features/site/useHomeSectionsContent'
import { useSiteContent } from './features/site/useSiteContent'
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
  const {
    session,
    isAuthenticated,
    authLoading,
    authBusy,
    authError,
    subjectInput,
    setSubjectInput,
    signIn,
    signInAdmin,
    createUsername,
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
  } = useTaskManager(isAuthenticated)

  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks])
  const hasAnyTask = tasks.length > 0
  const hasAiTask = tasks.some((t) => t.source === 'ai_generated')
  const hasCompletedTask = tasks.some((t) => t.completed)
  const completionPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0
  const pendingLabel = Math.max(tasks.length - completedCount, 0)

  const menuItems = useMemo<ScrollMenuItem[]>(() => {
    const items: ScrollMenuItem[] = [
      { id: 'hero', label: 'Overview' },
      { id: 'quick-start', label: 'Quick Start' },
      { id: 'session', label: 'Session' },
      { id: 'how-it-works', label: 'How It Works' },
      { id: 'sections', label: 'Highlights' },
    ]

    if (isAuthenticated && isAdmin) {
      items.push({ id: 'admin-dashboard', label: 'Admin Dashboard' })
    }

    items.push({ id: 'task-manager', label: 'Task Manager' })
    items.push({ id: 'faq', label: 'FAQ' })

    if (isAuthenticated && isAdmin) {
      items.push({ id: 'cms-link', label: 'Open CMS', isExternal: true, href: cmsHref })
    }

    return items
  }, [cmsHref, isAdmin, isAuthenticated])

  const { activeSectionId, sectionStateClass, handleMenuJump } = useScrollSpy(menuItems)

  return (
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

            <div id="quick-start" className={sectionStateClass('quick-start')}>
              <QuickStartSection
                isAuthenticated={isAuthenticated}
                hasAnyTask={hasAnyTask}
                hasAiTask={hasAiTask}
                hasCompletedTask={hasCompletedTask}
              />
            </div>

            <div id="session" className={sectionStateClass('session')}>
              <SessionPanel
                isAuthenticated={isAuthenticated}
                authLoading={authLoading}
                authBusy={authBusy}
                authError={authError}
                subjectInput={subjectInput}
                currentSubject={session?.subject || ''}
                currentRoles={session?.roles || []}
                onSubjectInputChange={setSubjectInput}
                onSignIn={signIn}
                onSignInAdmin={signInAdmin}
                onCreateUsername={createUsername}
                onSignOut={signOut}
              />
            </div>

            <div id="how-it-works" className={sectionStateClass('how-it-works')}>
              <HowItWorksSection />
            </div>

            <div id="sections" className={sectionStateClass('sections')}>
              <HomeSections content={homeSections} />
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
              />
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
  )
}

export default App
