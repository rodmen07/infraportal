import { useEffect, useState } from 'react'
import { AdminDashboardSection } from './features/admin/AdminDashboardSection'
import { CelebrationOverlay } from './components/CelebrationOverlay'
import { useAdminDashboard } from './features/admin/useAdminDashboard'
import { SessionPanel } from './features/auth/SessionPanel'
import { useAuthSession } from './features/auth/useAuthSession'
import { GoalDiagramsSection } from './features/plans/GoalDiagramsSection'
import { FaqSection } from './features/site/FaqSection'
import { HomeSections } from './features/site/HomeSections'
import { SiteHeader } from './features/site/SiteHeader'
import { useFaqContent } from './features/site/useFaqContent'
import { useHomeSectionsContent } from './features/site/useHomeSectionsContent'
import { useSiteContent } from './features/site/useSiteContent'
import { TaskManagerSection } from './features/tasks/TaskManagerSection'
import { useTaskManager } from './features/tasks/useTaskManager'

function App() {
  const baseUrl = import.meta.env.BASE_URL
  const dashboardHash = '#admin-dashboard'
  const dashboardHref = `${baseUrl}${dashboardHash}`
  const cmsHref = `${baseUrl}admin/`
  const homeHref = baseUrl
  const [currentHash, setCurrentHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
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
    plannedTasks,
    planning,
    creatingPlanTasks,
    deletingAllTasks,
    plannerStatus,
    goalPlans,
    celebrationToken,
    forgedPoints,
    gemCounts,
    goalProgress,
    pendingCount,
    setTaskTitle,
    setTaskDifficulty,
    setTaskGoal,
    setGoalInput,
    setPlannedTaskDifficulty,
    loadTasks,
    handleCreateTask,
    handleSetTaskDifficulty,
    handleToggleTask,
    handleDeleteTask,
    handleDeleteAllTasks,
    handleGeneratePlan,
    handleCreatePlannedTasks,
    handleResetGeneratedPlan,
  } = useTaskManager(isAuthenticated)

  const boardGoal = goalPlans[0]?.goal || 'Current Task Path'

  return (
    <main className="forge-grid relative min-h-screen overflow-hidden bg-zinc-950 px-2 py-6 text-zinc-100 sm:px-4 sm:py-8 lg:px-8 xl:px-10 2xl:px-14">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />
      <CelebrationOverlay trigger={celebrationToken} />

      <div className="relative mx-auto flex w-full max-w-[2200px] flex-col gap-6">
        <SiteHeader
          content={content}
        />

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

        <HomeSections content={homeSections} />

        {isAuthenticated && isAdmin && (
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
        )}

        <div className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <TaskManagerSection
              authLocked={!isAuthenticated}
              pendingCount={pendingCount}
              forgedPoints={forgedPoints}
              gemCounts={gemCounts}
              goalProgress={goalProgress}
              tasksLoading={tasksLoading}
              taskError={taskError}
              goalInput={goalInput}
              plannedTaskDifficulty={plannedTaskDifficulty}
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
              onRefresh={loadTasks}
              onGoalInputChange={setGoalInput}
              onPlannedTaskDifficultyChange={setPlannedTaskDifficulty}
              onGeneratePlan={handleGeneratePlan}
              onCreatePlannedTasks={handleCreatePlannedTasks}
              onTaskTitleChange={setTaskTitle}
              onTaskDifficultyChange={setTaskDifficulty}
              onTaskGoalChange={setTaskGoal}
              onCreateTask={handleCreateTask}
              onSetTaskDifficulty={handleSetTaskDifficulty}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onDeleteAllTasks={handleDeleteAllTasks}
              onResetGeneratedPlan={handleResetGeneratedPlan}
            />
          </div>
          <div className="xl:col-span-4">
            <GoalDiagramsSection goal={boardGoal} tasks={tasks} />
          </div>
        </div>

        <FaqSection content={faqContent} />

        {isAuthenticated && isAdmin && (
          <section className="forge-panel rounded-3xl border border-indigo-300/20 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Admin Navigation</p>
            <div className="flex flex-wrap items-center gap-2">
              {currentHash !== dashboardHash && (
                <a
                  href={dashboardHref}
                  className="rounded-xl border border-zinc-500/40 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
                >
                  Open Dashboard
                </a>
              )}
              <a
                href={cmsHref}
                className="rounded-xl border border-zinc-500/40 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
              >
                Open CMS
              </a>
              {currentHash === dashboardHash && (
                <a
                  href={homeHref}
                  className="rounded-xl border border-zinc-500/40 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
                >
                  Back to Main Page
                </a>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

export default App
