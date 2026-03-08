import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminDashboardSection } from '../features/admin/AdminDashboardSection'
import { useAdminDashboard } from '../features/admin/useAdminDashboard'
import { SessionPanel } from '../features/auth/SessionPanel'
import { useAuthSession } from '../features/auth/useAuthSession'
import { TopNav } from '../features/layout/TopNav'
import { VerticalProgress } from '../features/layout/VerticalProgress'
import { ActivityFeedSection } from '../features/activity-feed/ActivityFeedSection'
import { QuickStartSection } from '../features/site/QuickStartSection'
import { StatsSection } from '../features/site/StatsSection'
import { CelebrationOverlay } from '../features/tasks/CelebrationOverlay'
import { TaskManagerSection } from '../features/tasks/TaskManagerSection'
import { useTaskManager, writingTierForPoints } from '../features/tasks/useTaskManager'

export function TasksPage() {
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
    handleUpdateTaskLabels,
  } = useTaskManager(isAuthenticated)

  // Celebration state
  const [celebrationTrigger, setCelebrationTrigger] = useState(0)
  const [celebrationMessage, setCelebrationMessage] = useState('')
  const prevStoryPointsRef = useRef<number | null>(null)
  const prevTierRef = useRef<string | null>(null)
  const prevGoalProgressRef = useRef<string>('')

  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks])
  const hasAnyTask = tasks.length > 0
  const hasAiTask = tasks.some((t) => t.source === 'ai_generated')
  const hasCompletedTask = tasks.some((t) => t.completed)
  const completionPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0
  const pendingLabel = Math.max(tasks.length - completedCount, 0)

  useEffect(() => {
    if (tasksLoading) {
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
      setCelebrationMessage('')
      setCelebrationTrigger((n) => n + 1)
    }

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
          <TopNav />

          <div className="grid gap-5 xl:grid-cols-[120px_minmax(0,1fr)]">
            {/* Vertical progress — left side, replaces SideNav */}
            <div className="hidden xl:block">
              <div className="sticky top-24">
                <VerticalProgress
                  completionPercent={completionPercent}
                  completedCount={completedCount}
                  pendingLabel={pendingLabel}
                  isAuthenticated={isAuthenticated}
                  currentSubject={session?.subject || ''}
                />
              </div>
            </div>

            {/* Main content */}
            <div className="space-y-6">
              {!isAuthenticated ? (
                <div className="rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
                  <p className="mb-1 text-center text-lg font-semibold text-zinc-100">Sign in to manage tasks</p>
                  <p className="mb-6 text-center text-sm text-zinc-400">
                    Create a username to get started — no email or password required.
                  </p>
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
              ) : (
                <>
                  <QuickStartSection
                    isAuthenticated={isAuthenticated}
                    hasAnyTask={hasAnyTask}
                    hasAiTask={hasAiTask}
                    hasCompletedTask={hasCompletedTask}
                  />

                  <TaskManagerSection
                    authLocked={false}
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
                    onUpdateTaskLabels={handleUpdateTaskLabels}
                  />

                  <StatsSection
                    isAuthenticated={isAuthenticated}
                    isAdmin={isAdmin}
                    tasks={tasks}
                    storyPoints={storyPoints}
                    pendingCount={pendingCount}
                    metrics={metrics}
                  />

                  <ActivityFeedSection
                    tasks={tasks}
                    token={session?.accessToken ?? ''}
                    isAuthenticated={isAuthenticated}
                  />

                  {isAdmin && (
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
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
