import { CelebrationOverlay } from './components/CelebrationOverlay'
import { useAuthSession } from './features/auth/useAuthSession'
import { GoalDiagramsSection } from './features/plans/GoalDiagramsSection'
import { SiteHeader } from './features/site/SiteHeader'
import { useSiteContent } from './features/site/useSiteContent'
import { TaskManagerSection } from './features/tasks/TaskManagerSection'
import { useTaskManager } from './features/tasks/useTaskManager'

function App() {
  const baseUrl = import.meta.env.BASE_URL
  const content = useSiteContent(baseUrl)
  const {
    session,
    isAuthenticated,
    authLoading,
    authBusy,
    authError,
    subjectInput,
    setSubjectInput,
    signIn,
    createUsername,
    signOut,
  } = useAuthSession()
  const {
    tasks,
    taskTitle,
    tasksLoading,
    taskError,
    submitting,
    workingTaskId,
    goalInput,
    plannedTasks,
    planning,
    creatingPlanTasks,
    plannerStatus,
    goalPlans,
    celebrationToken,
    pendingCount,
    setTaskTitle,
    setGoalInput,
    loadTasks,
    handleCreateTask,
    handleToggleTask,
    handleDeleteTask,
    handleGeneratePlan,
    handleCreatePlannedTasks,
  } = useTaskManager(isAuthenticated)

  const boardGoal = goalPlans[0]?.goal || 'Current Task Path'

  return (
    <main className="forge-grid relative min-h-screen overflow-hidden bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />
      <CelebrationOverlay trigger={celebrationToken} />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6">
        <SiteHeader
          content={content}
          isAuthenticated={isAuthenticated}
          authLoading={authLoading}
          authBusy={authBusy}
          authError={authError}
          subjectInput={subjectInput}
          currentSubject={session?.subject || ''}
          onSubjectInputChange={setSubjectInput}
          onSignIn={signIn}
          onCreateUsername={createUsername}
          onSignOut={signOut}
        />

        <TaskManagerSection
          authLocked={!isAuthenticated}
          pendingCount={pendingCount}
          tasksLoading={tasksLoading}
          taskError={taskError}
          goalInput={goalInput}
          planning={planning}
          creatingPlanTasks={creatingPlanTasks}
          plannerStatus={plannerStatus}
          plannedTasks={plannedTasks}
          taskTitle={taskTitle}
          submitting={submitting}
          tasks={tasks}
          workingTaskId={workingTaskId}
          onRefresh={loadTasks}
          onGoalInputChange={setGoalInput}
          onGeneratePlan={handleGeneratePlan}
          onCreatePlannedTasks={handleCreatePlannedTasks}
          onTaskTitleChange={setTaskTitle}
          onCreateTask={handleCreateTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
        />

        <GoalDiagramsSection goal={boardGoal} tasks={tasks} />
      </div>
    </main>
  )
}

export default App
